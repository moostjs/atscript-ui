import type {
  AtscriptDoc,
  SemanticGroup,
  SemanticNode,
  SemanticPropNode,
  SemanticQueryComparisonNode,
  SemanticQueryFieldRefNode,
  SemanticRefNode,
  TAnnotationArgument,
  TMessages,
  TValueCandidate,
  Token,
} from "@atscript/core";
import {
  getFieldsForType,
  getSiblingAnnotation,
  isInterface,
  isProp,
  isRef,
  isQueryComparison,
  isQueryLogical,
  isStructure,
} from "@atscript/core";
import type { SemanticQueryExprNode } from "@atscript/core";
import {
  NOT_DIMENSION_REASON,
  annotationTarget,
  effectiveAnnotationNames,
  fkChainRef,
  getAnnotationAlias,
  getTypeFields,
  isAliasDecl,
  isDbSourceDecl,
  isNavProp,
  isStrictAggregateStruct,
  primitiveBaseType,
  siblingStringFields,
  validateExclusiveWith,
  validateQueryScope,
  validateRefArgument,
  validateSiblingStringField,
} from "@atscript/db/shared";

/**
 * Editor scopes + validators of `@ui.valueHelp`, `@ui.valueHelp.distinct` and
 * `@ui.literalLabel` (since 0.1.148), and of `@ui.valueHelp.fill`,
 * `@ui.valueHelp.column`, host references in a binding filter and
 * `@ui.valueLabel` (since 0.1.190). Scopes and validators share one source,
 * so a diagnostic and what the editor completes never diverge.
 */

const WARNING = 2;
const ERROR = 1;
const MAX_DEPTH = 8;

// ── Editor scopes ───────────────────────────────────────────

/** The target type text (first argument) of the annotation the argument belongs to. */
function targetOf(arg: Token): string | undefined {
  return getSiblingAnnotation(arg)?.args[0]?.text || undefined;
}

type TFieldScopeHook = NonNullable<TAnnotationArgument["fieldScope"]>;

export const valueHelpScopes = {
  /** `field`: a field of the target, named by a string. */
  field: (arg) => {
    const target = targetOf(arg);
    return target ? { allowedTypes: [], unqualifiedTarget: target } : undefined;
  },
  /**
   * `filter`: the target type; unqualified fields belong to it. The host
   * interface is in scope too: a right-hand `Host.field` is a host reference
   * (since 0.1.190).
   */
  filter: (arg, doc) => {
    const target = targetOf(arg);
    if (!target) return undefined;
    const host = hostOf(arg, doc);
    const allowedTypes =
      typeof host === "object" && host.name !== target ? [target, host.name] : [target];
    return { allowedTypes, unqualifiedTarget: target };
  },
  /** `@ui.valueHelp.fill`'s `local`: a field of the host interface (since 0.1.190). */
  hostField: (arg, doc) => {
    const host = hostOf(arg, doc);
    return typeof host === "object"
      ? { allowedTypes: [], unqualifiedTarget: host.name }
      : undefined;
  },
  /**
   * A field of the target of the field's own binding — `@ui.valueHelp.fill`'s
   * `targetField`, `@ui.valueHelp.column`'s `field` (since 0.1.190).
   */
  bindingField: (arg, doc) => {
    const binding = bindingOf(annotationTarget(arg, doc), doc);
    return binding ? { allowedTypes: [], unqualifiedTarget: binding.name } : undefined;
  },
} satisfies Record<string, TFieldScopeHook>;

/** `refFilter` of the binding target: an interface that is not a `@db.alias`. */
export function isValueHelpTarget(decl: SemanticNode): boolean {
  return isInterface(decl) && !isAliasDecl(decl);
}

// ── Type resolution helpers ─────────────────────────────────

type TDesign = "string" | "number" | "decimal" | "boolean" | "object" | "array" | "other";

/** A resolved leaf of a type expression, with the document that declares it. */
interface TLeaf {
  def: SemanticNode;
  doc: AtscriptDoc;
}

/**
 * The one resolver behind {@link designOf} and {@link collectLiterals}: the leaf
 * definitions of a type expression with refs, type aliases and unions unwound
 * (an intersection is one leaf). `null` marks a branch that cannot be resolved,
 * so the callers skip their check instead of guessing.
 */
function leavesOf(def: SemanticNode | undefined, doc: AtscriptDoc, depth = 0): (TLeaf | null)[] {
  if (!def || depth > MAX_DEPTH) return [null];
  switch (def.entity) {
    case "ref": {
      const ref = def as SemanticRefNode;
      const unwound = doc.unwindType(ref.id!, ref.chain);
      return unwound ? leavesOf(unwound.def, unwound.doc, depth + 1) : [null];
    }
    case "type":
      return leavesOf(def.getDefinition(), doc, depth + 1);
    case "group": {
      const group = def as SemanticGroup;
      if (group.op === "&") return [{ def, doc }];
      return group.unwrap().flatMap((item) => leavesOf(item, doc, depth + 1));
    }
    default:
      return [{ def, doc }];
  }
}

function constDesign(def: SemanticNode): TDesign {
  const token = def.token("identifier");
  if (token?.type === "text") return "string";
  if (token?.type === "number") return "number";
  if (token?.text === "true" || token?.text === "false") return "boolean";
  return "other";
}

function leafDesign(def: SemanticNode): TDesign | undefined {
  switch (def.entity) {
    case "primitive": {
      const base = primitiveBaseType(def);
      if (base === "string" || base === "number" || base === "decimal" || base === "boolean") {
        return base;
      }
      if (base === "object") return "object";
      if (base === "array" || base === "tuple") return "array";
      return base ? "other" : undefined;
    }
    case "const":
      return constDesign(def);
    case "structure":
    case "interface":
    case "group":
      return "object";
    case "array":
    case "tuple":
      return "array";
    default:
      return undefined;
  }
}

/** A `null` / `undefined` / `void` leaf: it does not take part in a field's value kind. */
function isEmptyLeaf(def: SemanticNode): boolean {
  if (def.entity !== "primitive") return false;
  const base = primitiveBaseType(def) as string | undefined;
  return base === "null" || base === "void" || base === "undefined";
}

/** Design type of a resolved definition; `undefined` when it cannot be resolved (skip checks). */
function designOf(def: SemanticNode | undefined, doc: AtscriptDoc): TDesign | undefined {
  const leaves = leavesOf(def, doc);
  // `null` / `undefined` members (`string | null`) say nothing about the value kind
  const present = leaves.filter((leaf) => !leaf || !isEmptyLeaf(leaf.def));
  const kinds = new Set(
    (present.length > 0 ? present : leaves).map((leaf) =>
      leaf ? leafDesign(leaf.def) : undefined,
    ),
  );
  if (kinds.has(undefined)) return undefined;
  return kinds.size === 1 ? [...kinds][0] : "other";
}

/**
 * The definition an annotated node stands for, with the document that declares it: a prop /
 * type declaration's definition, or — in an `annotate` block — the entry's target type.
 */
function hostLeaves(node: SemanticNode | undefined, doc: AtscriptDoc): (TLeaf | null)[] {
  const host = doc.annotatedDefinition(node);
  return host ? leavesOf(host.def, host.doc) : [null];
}

/** Whether a resolved leaf is a `number.timestamp` (any extension of it): the primitive's tags say so. */
function isTimestampLeaf(def: SemanticNode): boolean {
  if (primitiveBaseType(def) !== "number") return false;
  const tags = (def as { tags?: Set<string> }).tags;
  return !!tags && (tags.has("timestamp") || tags.has("created") || tags.has("updated"));
}

function hostDesign(token: Token, doc: AtscriptDoc): TDesign | undefined {
  const host = doc.annotatedDefinition(token.parentNode);
  return host ? designOf(host.def, host.doc) : undefined;
}

/**
 * One value a host can be labelled for: its text, and the const node (and document)
 * that declares it — none for the two values of a `boolean`.
 */
interface TLiteral {
  text: string;
  def?: SemanticNode;
  doc?: AtscriptDoc;
}

/** The values of a `boolean` host, as `@ui.literalLabel` names them. */
const BOOLEAN_VALUES = ["true", "false"] as const;

/**
 * Collects the values of a pure literal union or a `boolean` (`'true'` / `'false'`), or
 * of an array of one; `null` / `undefined` members (`boolean | null`) have none. `false`
 * when the host is anything else, `undefined` when it cannot be resolved.
 */
function collectLiterals(
  def: SemanticNode | undefined,
  doc: AtscriptDoc,
  out: TLiteral[],
  depth = 0,
): boolean | undefined {
  let unresolved = false;
  const start = out.length;
  for (const leaf of leavesOf(def, doc, depth)) {
    if (!leaf) {
      unresolved = true;
    } else if (leaf.def.entity === "const") {
      const text = leaf.def.token("identifier")?.text;
      if (text === undefined) return false;
      out.push({ text, def: leaf.def, doc: leaf.doc });
    } else if (leaf.def.entity === "array") {
      const ok = collectLiterals(leaf.def.getDefinition(), leaf.doc, out, depth + 1);
      if (ok === false) return false;
      if (ok === undefined) unresolved = true;
    } else if (leaf.def.entity === "primitive" && primitiveBaseType(leaf.def) === "boolean") {
      for (const text of BOOLEAN_VALUES) out.push({ text });
    } else if (!isEmptyLeaf(leaf.def)) {
      return false;
    }
  }
  if (unresolved) return undefined;
  // only `null` / `undefined` members: nothing to label
  return out.length > start;
}

/** {@link collectLiterals} of the type an annotated node stands for. */
function collectHostLiterals(
  node: SemanticNode | undefined,
  doc: AtscriptDoc,
  out: TLiteral[],
): boolean | undefined {
  const host = doc.annotatedDefinition(node);
  return collectLiterals(host?.def, host?.doc ?? doc, out);
}

// ── Target resolution ───────────────────────────────────────

interface TTarget {
  doc: AtscriptDoc;
  decl: SemanticNode;
  props: Map<string, SemanticPropNode>;
}

function resolveTarget(name: string, doc: AtscriptDoc): TTarget | undefined {
  const owner = doc.getDeclarationOwnerNode(name);
  if (!owner?.node || !isInterface(owner.node)) return undefined;
  const props = new Map<string, SemanticPropNode>();
  for (const prop of getFieldsForType(doc, name)) {
    if (prop.id) props.set(prop.id, prop);
  }
  return { doc: owner.doc, decl: owner.node, props };
}

/** The prop an annotation sits on, its dotted path and the struct / declaration that own it. */
interface TAnnotatedField {
  prop: SemanticNode;
  path: string;
  struct?: SemanticNode;
  owner?: SemanticNode;
}

/**
 * The annotated TARGET prop: the prop itself for an inline annotation, or — for an `annotate`
 * entry — the prop of the target type the entry names. Its owning struct and declaration are
 * resolved the same way as for an inline prop. `undefined` when the entry does not resolve.
 */
function annotatedField(
  node: SemanticNode | undefined,
  doc: AtscriptDoc,
): TAnnotatedField | undefined {
  if (!node) return undefined;
  let prop: SemanticNode | undefined = node;
  let path = node.id ?? "";
  if (isRef(node)) {
    const idToken = node.token("identifier");
    const block = idToken
      ? doc.annotateBlockAt(idToken.range.start.line, idToken.range.start.character)
      : undefined;
    if (block) {
      const chain = [node.id!, ...node.chain.map((c) => c.text)];
      path = chain.join(".");
      const parent = doc.unwindType(block.targetName, chain.slice(0, -1))?.def as
        | { props?: Map<string, SemanticPropNode> }
        | undefined;
      prop = parent?.props?.get(chain.at(-1)!);
    }
  }
  if (!prop || !isProp(prop)) return undefined;
  // Walk up to the declaring interface: a nested prop (`addr.city`) belongs to the table that
  // declares `addr`, and its strictness is the table's top-level structure's.
  let struct: SemanticNode | undefined;
  let up: SemanticNode | undefined = prop.ownerNode;
  while (up && !isInterface(up)) {
    if (isStructure(up)) struct = up;
    up = up.ownerNode;
  }
  const owner = up && isInterface(up) ? up : struct;
  return { prop, path, struct, owner };
}

/** Top-level conjuncts of a predicate (an `and` chain flattened). */
function conjuncts(expr: SemanticQueryExprNode): SemanticQueryExprNode[] {
  if (isQueryLogical(expr) && expr.operator === "and") return expr.operands.flatMap(conjuncts);
  return [expr];
}

/** The right-hand field reference of a comparison, if it compares two fields. */
function rightRef(cmp: SemanticQueryComparisonNode): SemanticQueryFieldRefNode | undefined {
  return cmp.right && "fieldRef" in cmp.right
    ? (cmp.right as SemanticQueryFieldRefNode)
    : undefined;
}

/**
 * Fields the filter pins with a top-level `=` against a literal value. The
 * compile-time twin of `pinnedOf` in `value-help/filter-tree.ts` (which reads
 * the emitted tree at runtime) — keep the two rules in step.
 */
function pinnedFields(filter: Token | undefined): Set<string> {
  const pinned = new Set<string>();
  const expr = filter?.queryNode?.expression;
  if (!expr) return pinned;
  for (const c of conjuncts(expr)) {
    if (!isQueryComparison(c) || c.operator !== "=" || !c.right) continue;
    if (!rightRef(c)) pinned.add(c.left.fieldRef.text);
  }
  return pinned;
}

/**
 * The target fields the filter's host references pin (`targetField =
 * Host.field`), each with its host field — pinned only while that host field
 * has a value.
 */
function hostPins(filter: Token | undefined, hostName: string): Map<string, string> {
  const pins = new Map<string, string>();
  const expr = filter?.queryNode?.expression;
  if (!expr) return pins;
  for (const c of conjuncts(expr)) {
    if (!isQueryComparison(c) || c.operator !== "=") continue;
    const ref = rightRef(c);
    if (ref?.typeRef?.text === hostName) pins.set(c.left.fieldRef.text, ref.fieldRef.text);
  }
  return pins;
}

// ── Host interface and binding of a bound field (since 0.1.190) ──

/**
 * The form a bound field is edited in: the host interface — its name as a
 * filter names it (`Host.field`) and its fields, declared or inherited — and
 * the field itself. In a mutating `annotate` block: the annotated interface,
 * and the field the entry lands on (atscript-db's `annotationTarget`, the one
 * resolver db's own checks read an entry's field through).
 */
interface THost {
  name: string;
  fields: ReadonlyMap<string, SemanticPropNode>;
  field: SemanticNode;
}

/**
 * Where host references and fills are refused: `"inline"` — a field that is
 * no top-level field of an interface (an inline structure's, a nested
 * `annotate` entry's, a type's); `"copy"` — an entry of an `annotate … as`
 * copy.
 */
type THostRefusal = "inline" | "copy";

/**
 * The {@link THost} of the field the annotation (or argument) `token` sits
 * on; `undefined` when it sits on no field (a type-level binding, an entry
 * that lands nowhere).
 */
function hostOf(token: Token, doc: AtscriptDoc): THost | THostRefusal | undefined {
  const node = token.parentNode;
  if (!node) return undefined;
  if (isRef(node)) {
    const at = node.token("identifier")?.range.start;
    const block = at ? doc.annotateBlockAt(at.line, at.character) : undefined;
    if (!block) return undefined;
    if (!block.isMutating) return "copy";
    if (node.hasChain) return "inline";
    const field = annotationTarget(token, doc);
    const fields = getTypeFields(field?.ownerNode, doc);
    return field && fields ? { name: block.targetName, fields, field } : undefined;
  }
  if (!isProp(node)) return undefined;
  const iface = node.ownerNode?.ownerNode;
  if (!isStructure(node.ownerNode) || !iface || !isInterface(iface)) return "inline";
  const fields = getTypeFields(iface, doc);
  return fields && iface.id ? { name: iface.id, fields, field: node } : undefined;
}

const REFUSED: Record<THostRefusal, string> = {
  inline:
    "a top-level field of an interface, not a field of an inline structure, a type or a nested annotate entry",
  copy: "a field of an interface or of a mutating annotate block, not of an `annotate … as` copy",
};

/** The target of a field's own binding (fills and columns belong to it). */
interface TBinding {
  /** The target's name as written. */
  name: string;
  target?: TTarget;
}

/**
 * The binding a field's fills and columns belong to: its own `@ui.valueHelp`
 * (for an `annotate` entry's field, the landed one — the entry's wins), else its
 * own `@db.rel.FK` help. A binding the field only gets through its type or a
 * chain reference takes no fills or columns.
 */
function bindingOf(field: SemanticNode | undefined, doc: AtscriptDoc): TBinding | undefined {
  if (!field) return undefined;
  const own = field.annotations?.find((a) => a.name === "ui.valueHelp");
  if (own) {
    const name = own.args[0]?.text;
    return name ? { name, target: resolveTarget(name, doc) } : undefined;
  }
  if (field.countAnnotations("db.rel.FK") > 0) {
    const ref = fkChainRef(field.getDefinition());
    if (ref?.id) return { name: ref.id, target: resolveTarget(ref.id, doc.refOrigin(ref)) };
  }
  return undefined;
}

const SCALAR = "a scalar (not an object, an array, a navigation or @db.json)";

/** Whether a field holds no scalar: an object, an array, `@db.json` or a navigation. */
function isNotScalar(prop: SemanticNode, doc: AtscriptDoc): boolean {
  if (prop.countAnnotations("db.json") > 0 || isNavProp(prop)) return true;
  const design = designOf(prop.getDefinition(), doc.declaringDoc(prop, doc));
  return design === "object" || design === "array";
}

/** FL3 / CL2: why `name` is no top-level scalar field of the binding's target. */
function targetFieldProblem(binding: TBinding, name: string): string | undefined {
  if (name.includes(".")) {
    return `'${name}' must be a top-level field of '${binding.name}', not a dotted path`;
  }
  const target = binding.target;
  if (!target) return undefined;
  const prop = target.props.get(name);
  if (!prop) return `Field '${name}' does not exist on '${binding.name}'`;
  if (isNotScalar(prop, target.doc)) return `'${binding.name}.${name}' must be ${SCALAR}`;
  return undefined;
}

/** FL4 / VH9: why the host field `local` cannot take the target field `name`'s values. */
function designMismatch(
  host: THost,
  local: string,
  binding: TBinding,
  name: string,
  doc: AtscriptDoc,
): string | undefined {
  const localProp = host.fields.get(local);
  const targetProp = binding.target?.props.get(name);
  if (!localProp || !targetProp || !binding.target) return undefined;
  const a = designOf(targetProp.getDefinition(), binding.target.doc);
  const b = designOf(localProp.getDefinition(), doc.declaringDoc(localProp, doc));
  if (!a || !b || a === "other" || b === "other" || a === b) return undefined;
  return `'${binding.name}.${name}' is ${a}, '${host.name}.${local}' is ${b}`;
}

// ── @ui.valueHelp ───────────────────────────────────────────

export function validateValueHelp(token: Token, args: Token[], doc: AtscriptDoc): TMessages {
  const errors: TMessages = [];
  const [targetArg, fieldArg, filterArg] = args;
  const host = token.parentNode;
  const field = annotatedField(host, doc);

  // VH8: navigation field (`@db.rel.store` included) / `.distinct` on the same node
  const navNode = field?.prop ?? host;
  if (navNode && isNavProp(navNode)) {
    errors.push({
      message: "@ui.valueHelp is not valid on a navigation field — bind the foreign-key field",
      severity: ERROR,
      range: token.range,
    });
  }
  errors.push(
    ...validateExclusiveWith(token, "@ui.valueHelp", [{ key: "ui.valueHelp.distinct" }], doc),
  );

  if (!targetArg) return errors;

  // VH1: target is an interface (not a @db.alias)
  const targetErrors = validateRefArgument(targetArg, doc, {
    accept: isValueHelpTarget,
    expected: "must be an interface — a value-help dictionary.",
  });
  errors.push(...targetErrors);
  if (targetErrors.length > 0) return errors;

  const targetName = targetArg.text;
  const target = resolveTarget(targetName, doc);
  if (!target) return errors;

  // The binding needs a controller path. A @db.table / @db.view is served by a DB controller
  // that stamps the path at runtime, so only a target that is neither (and declares no path)
  // is ignored: the runtime falls back to the FK.
  if (!isDbSourceDecl(target.decl) && target.decl.countAnnotations("db.http.path") === 0) {
    errors.push({
      message: `'${targetName}' is not a @db.table / @db.view and has no @db.http.path — the binding is ignored and the field falls back to its foreign key`,
      severity: WARNING,
      range: targetArg.range,
    });
  }

  // VH2: field resolves to a scalar on the target
  const fieldName = fieldArg?.text;
  let fieldDesign: TDesign | undefined;
  let fieldProp: SemanticPropNode | undefined;
  if (fieldArg && fieldName !== undefined) {
    fieldProp = fieldName.includes(".") ? undefined : target.props.get(fieldName);
    if (!fieldProp) {
      errors.push({
        message: fieldName.includes(".")
          ? `Value-help field '${fieldName}' must be a top-level field of '${targetName}', not a dotted path`
          : `Field '${fieldName}' does not exist on '${targetName}'`,
        severity: ERROR,
        range: fieldArg.range,
      });
    } else {
      fieldDesign = designOf(fieldProp.getDefinition(), target.doc);
      if (
        fieldProp.countAnnotations("db.json") > 0 ||
        fieldDesign === "object" ||
        fieldDesign === "array"
      ) {
        errors.push({
          message: `Value-help field '${targetName}.${fieldName}' must be a scalar (not an object, array or @db.json)`,
          severity: ERROR,
          range: fieldArg.range,
        });
        fieldDesign = undefined;
      }
    }
  }

  // VH3: host design type equals the target field's
  if (fieldDesign && fieldDesign !== "other") {
    const hostType = hostDesign(token, doc);
    if (hostType && hostType !== fieldDesign) {
      errors.push({
        message: `Value-help field '${targetName}.${fieldName}' is ${fieldDesign}, '${field?.path || host?.id || "this field"}' is ${hostType}`,
        severity: ERROR,
        range: token.range,
      });
    }
  }

  const filterQuery = filterArg?.queryNode;
  // The form the field is edited in: a right-hand field reference names its field (since 0.1.190).
  const formHost = hostOf(token, doc);
  const validHost = typeof formHost === "object" ? formHost : undefined;
  if (filterArg && filterQuery) {
    // VH4: filter references the target — and, on the right-hand side, the host
    errors.push(
      ...validateQueryScope(
        filterArg,
        {
          allowedTypes:
            validHost && validHost.name !== targetName
              ? [targetName, validHost.name]
              : [targetName],
          unqualifiedTarget: targetName,
        },
        doc,
      ),
    );

    // VH5 / VH9: field-to-value comparisons, plus host references `targetField = Host.field`
    errors.push(
      ...validateHostRefs(filterQuery.expression, {
        host: formHost,
        binding: { name: targetName, target },
        doc,
      }),
    );
  }

  // VH6: values may repeat in the picker
  if (fieldProp && fieldName !== undefined) {
    const idFields = [...target.props.entries()].filter(
      ([, p]) => p.countAnnotations("meta.id") > 0,
    );
    const isUnique =
      fieldProp.countAnnotations("db.index.unique") > 0 ||
      (fieldProp.countAnnotations("meta.id") > 0 && idFields.length === 1);
    let ok = isUnique;
    if (!ok && fieldProp.countAnnotations("meta.id") > 0) {
      // The other key members are constant in the picker when the filter pins them to a
      // literal. A host reference pins one only while the host field has a value — an
      // empty one lists every member's rows — unless a fill writes the host field back
      // from the picked row.
      const literal = pinnedFields(filterArg);
      const byHost = validHost ? hostPins(filterArg, validHost.name) : undefined;
      const fills = (validHost?.field.annotations ?? []).filter(
        (a) => a.name === "ui.valueHelp.fill",
      );
      const writtenBack = (member: string) => {
        const local = byHost?.get(member);
        return (
          local !== undefined &&
          fills.some((a) => a.args[0]?.text === local && a.args[1]?.text === member)
        );
      };
      ok = idFields.every(([name]) => name === fieldName || literal.has(name) || writtenBack(name));
    }
    if (!ok) {
      errors.push({
        message: `values may repeat in the picker — '${targetName}.${fieldName}' is not unique (a sole @meta.id, @db.index.unique, or a composite key member with the other members pinned by '=' to a literal in the filter, or to a host field a fill writes back from the picked row)`,
        severity: WARNING,
        range: token.range,
      });
    }
  }

  // VH7: manual filterable table — filter fields need @db.column.filterable. Only the
  // left-hand fields are the dictionary's: a right-hand one is a host reference.
  if (filterQuery && getAnnotationAlias(target.decl, "db.table.filterable") === "manual") {
    const seen = new Set<string>();
    for (const { left: ref } of comparisons(filterQuery.expression)) {
      if (ref.typeRef && ref.typeRef.text !== targetName) continue;
      const name = ref.fieldRef.text;
      if (seen.has(name)) continue;
      seen.add(name);
      const prop = target.props.get(name.split(".")[0]);
      if (prop && prop.countAnnotations("db.column.filterable") === 0) {
        errors.push({
          message: `the dictionary controller will reject this filter ('${name}' needs @db.column.filterable)`,
          severity: WARNING,
          range: ref.fieldRef.range,
        });
      }
    }
  }

  // An `annotate` entry that replaces the binding re-checks the fills and columns the field
  // already carries against the new target (its own ones are checked by their validators).
  if (validHost && isRef(host)) {
    const binding = { name: targetName, target };
    for (const a of validHost.field.annotations ?? []) {
      if (a.token.parentNode === host) continue;
      const isFill = a.name === "ui.valueHelp.fill";
      if (!isFill && a.name !== "ui.valueHelp.column") continue;
      const local = isFill ? a.args[0]?.text : undefined;
      const name = a.args[isFill ? 1 : 0]?.text;
      if (name === undefined) continue;
      const problem =
        targetFieldProblem(binding, name) ??
        (local === undefined ? undefined : designMismatch(validHost, local, binding, name, doc));
      if (problem) {
        errors.push({
          message: `@${a.name} '${a.args.map((t) => t.text).join("', '")}' of this field: ${problem}`,
          severity: ERROR,
          range: token.range,
        });
      }
    }
  }

  return errors;
}

/** Every comparison of a predicate, depth-first. */
function comparisons(expr: SemanticQueryExprNode): SemanticQueryComparisonNode[] {
  if (isQueryLogical(expr)) return expr.operands.flatMap(comparisons);
  return isQueryComparison(expr) ? [expr] : [];
}

/**
 * VH5 / VH9 (since 0.1.190): a field-to-field comparison is a host reference —
 * a top-level `and` conjunct `targetField = Host.field` naming an existing
 * scalar field of the host of the same design type that is not the bound
 * field. Anything else that compares two fields or names the host is an error.
 */
function validateHostRefs(
  expr: SemanticQueryExprNode,
  ctx: { host: THost | THostRefusal | undefined; binding: TBinding; doc: AtscriptDoc },
): TMessages {
  const errors: TMessages = [];
  const { host, binding, doc } = ctx;
  const targetName = binding.name;
  const error = (message: string, range: Token["range"]) =>
    errors.push({ message, severity: ERROR, range });

  const visit = (node: SemanticQueryExprNode, topLevel: boolean) => {
    if (isQueryLogical(node)) {
      const chain = topLevel && node.operator === "and";
      for (const operand of node.operands) visit(operand, chain);
      return;
    }
    if (!isQueryComparison(node)) return;
    const hostName = typeof host === "object" ? host.name : undefined;
    // the left side names the dictionary — a self-bound dictionary's own name is the target's
    if (hostName && hostName !== targetName && node.left.typeRef?.text === hostName) {
      error(
        `the left side names a field of '${targetName}'; a host field belongs on the right ('field = ${hostName}.${node.left.fieldRef.text}')`,
        node.left.typeRef.range,
      );
    }
    const ref = rightRef(node);
    if (!ref) return;
    if (typeof host !== "object") {
      error(
        host === undefined
          ? "a value-help filter compares target fields with literal values"
          : `a host reference (a right-hand field reference) needs ${REFUSED[host]}`,
        ref.fieldRef.range,
      );
      return;
    }
    const typeName = ref.typeRef?.text;
    // another type: VH4 already reports it out of scope
    if (typeName !== host.name) {
      if (typeName === undefined || typeName === targetName) {
        error(
          `a value-help filter compares target fields with literal values, or with a field of the host: '${host.name}.${ref.fieldRef.text}'`,
          ref.fieldRef.range,
        );
      }
      return;
    }
    if (!topLevel) {
      error(
        "a host reference must be a top-level 'and' conjunct of the filter (not under 'or' / 'not')",
        ref.fieldRef.range,
      );
    }
    if (node.operator !== "=") {
      error(`a host reference compares with '=' (got '${node.operator}')`, ref.fieldRef.range);
    }
    const name = ref.fieldRef.text;
    const prop = name.includes(".") ? undefined : host.fields.get(name);
    if (!prop) {
      error(
        name.includes(".")
          ? `a host reference names a top-level field of '${host.name}', not a dotted path`
          : `Field '${name}' does not exist on '${host.name}'`,
        ref.fieldRef.range,
      );
      return;
    }
    if (name === host.field.id) {
      error("a host reference cannot name the bound field itself", ref.fieldRef.range);
    } else if (isNotScalar(prop, doc)) {
      error(`host field '${host.name}.${name}' must be ${SCALAR}`, ref.fieldRef.range);
    } else {
      const mismatch = designMismatch(host, name, binding, node.left.fieldRef.text, doc);
      if (mismatch) error(mismatch, ref.fieldRef.range);
    }
  };
  visit(expr, true);
  return errors;
}

// ── @ui.valueHelp.fill / @ui.valueHelp.column (since 0.1.190) ──

export function validateFill(token: Token, args: Token[], doc: AtscriptDoc): TMessages {
  const errors: TMessages = [];
  const [localArg, targetArg] = args;
  const host = hostOf(token, doc);
  if (typeof host !== "object") {
    if (host) {
      errors.push({
        message: `@ui.valueHelp.fill needs ${REFUSED[host]}`,
        severity: ERROR,
        range: token.range,
      });
    }
    return errors;
  }

  // FL1: the field's own binding
  const binding = bindingOf(host.field, doc);
  if (!binding) {
    errors.push({
      message:
        "@ui.valueHelp.fill needs a binding of this field's own (@ui.valueHelp or @db.rel.FK)",
      severity: ERROR,
      range: token.range,
    });
    return errors;
  }

  // FL2 / FL5: a scalar sibling of the host, written by the pick
  const local = localArg?.text;
  let localOk = false;
  if (localArg && local !== undefined) {
    const prop = local.includes(".") ? undefined : host.fields.get(local);
    if (!prop || local === host.field.id) {
      errors.push({
        message: local.includes(".")
          ? `'${local}' must be a top-level field of '${host.name}', not a dotted path`
          : prop
            ? "@ui.valueHelp.fill cannot fill the bound field itself"
            : `Field '${local}' does not exist on '${host.name}'`,
        severity: ERROR,
        range: localArg.range,
      });
    } else if (isNavProp(prop)) {
      errors.push({
        message: `'${local}' is a navigation field — a pick never writes it`,
        severity: WARNING,
        range: localArg.range,
      });
    } else if (isNotScalar(prop, doc)) {
      errors.push({
        message: `'${host.name}.${local}' must be ${SCALAR}`,
        severity: ERROR,
        range: localArg.range,
      });
    } else {
      localOk = true;
      const effective = effectiveAnnotationNames(prop, doc);
      const why = effective.has("db.column.derived")
        ? "@db.column.derived"
        : effective.has("meta.readonly")
          ? "@meta.readonly"
          : undefined;
      if (why) {
        errors.push({
          message: `'${local}' is ${why} — a pick never writes it`,
          severity: WARNING,
          range: localArg.range,
        });
      }
    }
  }

  // FL3 / FL4: a scalar field of the target, of the sibling's type
  const name = targetArg?.text;
  if (targetArg && name !== undefined) {
    const problem =
      targetFieldProblem(binding, name) ??
      (localOk && local !== undefined
        ? designMismatch(host, local, binding, name, doc)
        : undefined);
    if (problem) errors.push({ message: problem, severity: ERROR, range: targetArg.range });
  }
  return errors;
}

export function validateColumn(token: Token, args: Token[], doc: AtscriptDoc): TMessages {
  const field = annotationTarget(token, doc);
  if (!field) return [];
  // CL1: the field's own binding
  const binding = bindingOf(field, doc);
  if (!binding) {
    return [
      {
        message:
          "@ui.valueHelp.column needs a binding of this field's own (@ui.valueHelp or @db.rel.FK)",
        severity: ERROR,
        range: token.range,
      },
    ];
  }
  // CL2: a scalar field of the target
  const name = args[0]?.text;
  const problem = name === undefined ? undefined : targetFieldProblem(binding, name);
  return problem ? [{ message: problem, severity: ERROR, range: args[0].range }] : [];
}

// ── @ui.valueHelp.distinct ──────────────────────────────────

export function validateDistinct(token: Token, _args: Token[], doc: AtscriptDoc): TMessages {
  const errors: TMessages = [];
  const host = token.parentNode;

  // DV1: scalar string / number
  const design = hostDesign(token, doc);
  const isTimestamp = hostLeaves(host, doc).some((leaf) => leaf && isTimestampLeaf(leaf.def));
  if (isTimestamp) {
    errors.push({
      message:
        "@ui.valueHelp.distinct requires a string or number field, got timestamp — a timestamp is not a value to pick from a list",
      severity: ERROR,
      range: token.range,
    });
  } else if (design && design !== "string" && design !== "number") {
    errors.push({
      message: `@ui.valueHelp.distinct requires a string or number field, got ${design}`,
      severity: ERROR,
      range: token.range,
    });
  }

  const field = annotatedField(host, doc);
  const owner = field?.owner;
  if (!owner || !field) return errors;

  // DV2: served by a DB controller
  if (!isDbSourceDecl(owner)) {
    errors.push({
      message:
        "distinct values are served by a DB controller — declare this on a @db.table/@db.view",
      severity: WARNING,
      range: token.range,
    });
    return errors;
  }

  // DV3: strict aggregate table — only dimensions group (the runtime rule of `$groupBy`)
  const struct = field.struct;
  if (
    struct &&
    isStructure(struct) &&
    field.prop.countAnnotations("db.column.dimension") === 0 &&
    isStrictAggregateStruct(struct, doc)
  ) {
    errors.push({
      message: `$groupBy rejects this field of a strict aggregate table: ${NOT_DIMENSION_REASON} (add @db.column.dimension)`,
      severity: WARNING,
      range: token.range,
    });
  }
  return errors;
}

// ── @ui.literalLabel ────────────────────────────────────────

/**
 * `valueScope` of `@ui.literalLabel`'s `value`: the literals of the annotated
 * union (or array of one), each linked to the literal it declares — completion
 * offers them and go-to-definition on the value jumps to the literal. A `boolean`
 * host offers `'true'` / `'false'` (since 0.1.165).
 */
export function literalLabelValues(
  annotationToken: Token,
  doc: AtscriptDoc,
): TValueCandidate[] | undefined {
  const found: TLiteral[] = [];
  if (collectHostLiterals(annotationToken.parentNode, doc, found) === false) {
    return undefined;
  }
  const seen = new Set<string>();
  const candidates: TValueCandidate[] = [];
  for (const { text, def, doc: declaring } of found) {
    if (seen.has(text)) continue;
    seen.add(text);
    const token = def?.token("identifier");
    candidates.push({
      value: text,
      ...(token && declaring && { definition: { doc: declaring, token } }),
    });
  }
  return candidates.length > 0 ? candidates : undefined;
}

export function validateLiteralLabel(token: Token, args: Token[], doc: AtscriptDoc): TMessages {
  const errors: TMessages = [];
  const host = token.parentNode;
  const found: TLiteral[] = [];
  const pure = collectHostLiterals(host, doc, found);
  const literals = found.map((l) => l.text);

  // LL1: the host is a pure literal union or a boolean (or an array of one)
  if (pure === false) {
    errors.push({
      message:
        "@ui.literalLabel requires a union of literal values or a boolean (or an array of one)",
      severity: ERROR,
      range: token.range,
    });
    return errors;
  }

  const value = args[0];
  if (!value) return errors;

  // LL2: the value is one of the literals
  if (pure === true && !literals.includes(value.text)) {
    errors.push({
      message: `'${value.text}' is not one of the literals: ${literals.map((l) => `'${l}'`).join(", ")}`,
      severity: ERROR,
      range: value.range,
    });
  }

  // LL3: duplicate value (reported on the later one)
  const sameValue = (host?.annotations ?? []).filter(
    (a) => a.name === "ui.literalLabel" && a.args[0]?.text === value.text,
  );
  if (sameValue.findIndex((a) => a.token === token) > 0) {
    errors.push({
      message: `duplicate @ui.literalLabel for '${value.text}'`,
      severity: ERROR,
      range: value.range,
    });
  }
  return errors;
}

// ── @ui.valueLabel (since 0.1.190) ──────────────────────────

/**
 * `valueScope` of `@ui.valueLabel`'s `field`: the string-valued fields of the
 * type the annotated field belongs to, declared or inherited
 * (`siblingStringFields`: never the field itself, an object, a number or a
 * dotted path) — for an `annotate` entry, of the annotated interface.
 * Go-to-definition jumps to the field in the file that declares it.
 */
export function valueLabelFields(annotationToken: Token, doc: AtscriptDoc): TValueCandidate[] {
  return siblingStringFields(annotationToken, doc).map((prop) => {
    const token = prop.token("identifier");
    return Object.assign(
      { value: prop.id ?? `` },
      token && { definition: { doc: doc.declaringDoc(prop, doc), token } },
    );
  });
}

export function validateValueLabel(token: Token, args: Token[], doc: AtscriptDoc): TMessages {
  const errors: TMessages = [];
  const field = annotationTarget(token, doc);
  const name = args[0]?.text;

  // VL1: a string sibling of the field, not the field itself
  if (name !== undefined) {
    if (field?.id !== undefined && name === field.id) {
      errors.push({
        message: "@ui.valueLabel names the field holding this value's text, not this field",
        severity: ERROR,
        range: args[0].range,
      });
    } else {
      errors.push(...validateSiblingStringField(token, args, doc, "@ui.valueLabel"));
    }
  }

  // VL2: one way to label a value
  errors.push(...validateExclusiveWith(token, "@ui.valueLabel", [{ key: "ui.literalLabel" }], doc));

  // VL3: on a bound field, a pick changes the code — a text no pick fills goes stale
  if (field && name !== undefined && name !== field.id) {
    const binding = bindingOf(field, doc);
    const filled = (field.annotations ?? []).some(
      (a) => a.name === "ui.valueHelp.fill" && a.args[0]?.text === name,
    );
    if (binding && !filled) {
      errors.push({
        message: `a pick of this field's value help does not fill '${name}' — the text goes stale after a pick (add @ui.valueHelp.fill '${name}', '<a field of ${binding.name}>')`,
        severity: WARNING,
        range: token.range,
      });
    }
  }
  return errors;
}

/**
 * `@ui.form.type` / `@ui.type`: the free-entry `tags` renderer edits an array —
 * on any other field it would mount with a scalar value.
 */
export function validateFormType(token: Token, args: Token[], doc: AtscriptDoc): TMessages {
  if (args[0]?.text !== "tags") return [];
  const design = hostDesign(token, doc);
  if (design === undefined || design === "array") return [];
  return [
    {
      message: `'tags' requires an array field (e.g. string[]), got ${design}`,
      severity: ERROR,
      range: args[0].range,
    },
  ];
}
