import type {
  AtscriptDoc,
  SemanticGroup,
  SemanticNode,
  SemanticPropNode,
  SemanticQueryComparisonNode,
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
  forEachFieldRef,
  getAnnotationAlias,
  isAliasDecl,
  isDbSourceDecl,
  isStrictAggregateStruct,
  primitiveBaseType,
  validateExclusiveWith,
  validateQueryScope,
  validateRefArgument,
} from "@atscript/db/shared";

/**
 * Editor scopes + validators of `@ui.valueHelp`, `@ui.valueHelp.distinct` and
 * `@ui.literalLabel` (since 0.1.148). Scopes and validators share one source,
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
  /** `filter`: the target type; unqualified fields belong to it. */
  filter: (arg) => {
    const target = targetOf(arg);
    return target ? { allowedTypes: [target], unqualifiedTarget: target } : undefined;
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

/** One literal of a union: its text, and the const node (and document) that declares it. */
interface TLiteral {
  text: string;
  def: SemanticNode;
  doc: AtscriptDoc;
}

/** Collects the literal values of a pure literal union; `undefined` when it cannot be resolved. */
function collectLiterals(
  def: SemanticNode | undefined,
  doc: AtscriptDoc,
  out: TLiteral[],
  depth = 0,
): boolean | undefined {
  let unresolved = false;
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
    } else {
      return false;
    }
  }
  return unresolved ? undefined : true;
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

function isNavigation(node: SemanticNode | undefined): boolean {
  return (
    !!node &&
    (node.countAnnotations("db.rel.to") > 0 ||
      node.countAnnotations("db.rel.from") > 0 ||
      node.countAnnotations("db.rel.via") > 0)
  );
}

/** Top-level conjuncts of a predicate (an `and` chain flattened). */
function conjuncts(expr: SemanticQueryExprNode): SemanticQueryExprNode[] {
  if (isQueryLogical(expr) && expr.operator === "and") return expr.operands.flatMap(conjuncts);
  return [expr];
}

/**
 * Fields the filter pins with a top-level `=` against a literal value. The
 * compile-time twin of `pinnedOf` in `value-help/filter-tree.ts` (which reads the
 * emitted tree at runtime) — keep the two rules in step.
 */
function pinnedFields(filter: Token | undefined): Set<string> {
  const pinned = new Set<string>();
  const expr = filter?.queryNode?.expression;
  if (!expr) return pinned;
  for (const c of conjuncts(expr)) {
    if (isQueryComparison(c) && c.operator === "=" && c.right && !("fieldRef" in c.right)) {
      pinned.add(c.left.fieldRef.text);
    }
  }
  return pinned;
}

// ── @ui.valueHelp ───────────────────────────────────────────

export function validateValueHelp(token: Token, args: Token[], doc: AtscriptDoc): TMessages {
  const errors: TMessages = [];
  const [targetArg, fieldArg, filterArg] = args;
  const host = token.parentNode;
  const field = annotatedField(host, doc);

  // VH8: navigation field / `.distinct` on the same node
  if (isNavigation(field?.prop ?? host)) {
    errors.push({
      message: "@ui.valueHelp is not valid on a navigation field — bind the foreign-key field",
      severity: ERROR,
      range: token.range,
    });
  }
  errors.push(...validateExclusiveWith(token, "@ui.valueHelp", [{ key: "ui.valueHelp.distinct" }]));

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
  if (filterArg && filterQuery) {
    // VH4: filter references the target only
    errors.push(
      ...validateQueryScope(
        filterArg,
        { allowedTypes: [targetName], unqualifiedTarget: targetName },
        doc,
      ),
    );

    // VH5: field-to-value comparisons only
    for (const cmp of comparisons(filterQuery.expression)) {
      if (cmp.right && "fieldRef" in cmp.right) {
        errors.push({
          message: "a value-help filter compares target fields with literal values",
          severity: ERROR,
          range: cmp.right.fieldRef.range,
        });
      }
    }
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
      const pinned = pinnedFields(filterArg);
      ok = idFields.every(([name]) => name === fieldName || pinned.has(name));
    }
    if (!ok) {
      errors.push({
        message: `values may repeat in the picker — '${targetName}.${fieldName}' is not unique (a sole @meta.id, @db.index.unique, or a composite key member with the other members pinned by '=' in the filter)`,
        severity: WARNING,
        range: token.range,
      });
    }
  }

  // VH7: manual filterable table — filter fields need @db.column.filterable
  if (filterQuery && getAnnotationAlias(target.decl, "db.table.filterable") === "manual") {
    const seen = new Set<string>();
    forEachFieldRef(filterQuery.expression, (ref) => {
      if (ref.typeRef && ref.typeRef.text !== targetName) return;
      const name = ref.fieldRef.text;
      if (seen.has(name)) return;
      seen.add(name);
      const prop = target.props.get(name.split(".")[0]);
      if (prop && prop.countAnnotations("db.column.filterable") === 0) {
        errors.push({
          message: `the dictionary controller will reject this filter ('${name}' needs @db.column.filterable)`,
          severity: WARNING,
          range: ref.fieldRef.range,
        });
      }
    });
  }

  return errors;
}

/** Every comparison of a predicate, depth-first. */
function comparisons(expr: SemanticQueryExprNode): SemanticQueryComparisonNode[] {
  if (isQueryLogical(expr)) return expr.operands.flatMap(comparisons);
  return isQueryComparison(expr) ? [expr] : [];
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
    isStrictAggregateStruct(struct)
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
 * offers them and go-to-definition on the value jumps to the literal.
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
    const token = def.token("identifier");
    candidates.push({ value: text, ...(token && { definition: { doc: declaring, token } }) });
  }
  return candidates.length > 0 ? candidates : undefined;
}

export function validateLiteralLabel(token: Token, args: Token[], doc: AtscriptDoc): TMessages {
  const errors: TMessages = [];
  const host = token.parentNode;
  const found: TLiteral[] = [];
  const pure = collectHostLiterals(host, doc, found);
  const literals = found.map((l) => l.text);

  // LL1: the host is a pure literal union (or an array of one)
  if (pure === false) {
    errors.push({
      message: "@ui.literalLabel requires a union of literal values (or an array of one)",
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
