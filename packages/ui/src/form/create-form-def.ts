import type {
  TAtscriptAnnotatedType,
  TAtscriptTypeArray,
  TAtscriptTypeComplex,
  TAtscriptTypeObject,
} from "@atscript/typescript/utils";
import { flattenAnnotatedType } from "@atscript/typescript/utils";
import { isNavRelation, isServerStampedOnUpdate } from "@atscript/db/validator";
import type {
  FormArrayFieldDef,
  FormDef,
  FormFieldDef,
  FormObjectFieldDef,
  FormTupleFieldDef,
  FormUnionFieldDef,
  FormUnionVariant,
} from "./types";
import { getFieldMeta, hasComputedAnnotations } from "../shared/field-resolver";
import {
  DB_AMOUNT_CURRENCY,
  DB_AMOUNT_CURRENCY_REF,
  DB_COLUMN_DERIVED,
  DB_COLUMN_VERSION,
  DB_UNIT,
  DB_UNIT_REF,
  META_DESCRIPTION,
  META_LABEL,
  UI_FORM_COMPONENT,
  UI_FORM_FN_OPTIONS,
  UI_FORM_NS,
  UI_FORM_OPTIONS,
  UI_FORM_ORDER,
  UI_FORM_PREFIX,
  UI_FORM_PREFIX_ICON,
  UI_FORM_PREFIX_REF,
  UI_FORM_PUSH_DOWN,
  UI_FORM_SUFFIX,
  UI_FORM_SUFFIX_ICON,
  UI_FORM_SUFFIX_REF,
  UI_FORM_TYPE,
  UI_TYPE,
  UI_LITERAL_LABEL,
} from "../shared/annotation-keys";
import { isEmptyMember, isPureLiteralUnion } from "../value-help/extract-literals";
import { extractValueHelp } from "../value-help/extract-ref";
import { isSkippedNavField } from "./skipped-nav";

/** Known atscript primitive extension tags that map directly to field types. */
const UI_TAGS = new Set(["action", "paragraph", "select", "radio", "checkbox"]);

/** Options for {@link createFormDef}. */
export interface CreateFormDefOptions {
  /**
   * `meta.versionColumn` — the server-managed OCC version field (its LOGICAL
   * name; a `@db.column` rename changes only the storage column). Excluded
   * from `fields[]`; it stays in `flatMap` so the wire payload is unchanged.
   * Root-table concept; not propagated into nested recursive calls. With
   * `mode: "edit"` it defaults to the top-level `@db.column.version` field.
   */
  versionColumn?: string;
  /**
   * `meta.fields` of the `/meta` the type came from. A field it marks
   * `computed` (a computed view column, whose `@db.compute` annotation the
   * server does not send) is marked `derived` like a `@db.column.derived`
   * one: read-only, never validated, never sent. Root-table concept; not
   * propagated into nested recursive calls. Since 0.1.147.
   */
  metaFields?: Record<string, { computed?: boolean }>;
  /**
   * What the form is for. `"edit"` — the form edits a stored row and is sent
   * as an update: an `@db.onUpdate.now` field (`number.timestamp.updated`) or
   * an `@db.onUpdate.inc` change counter, which the server sets on every
   * update and whose sent value it ignores, is then marked `derived` —
   * read-only, never validated, never sent. Applies at every depth (embedded
   * objects, objects in arrays), except for a reference to another field, an
   * element of an array of numbers, and below a tuple or a union of several
   * types, where the server does not set the field (`@db.onUpdate.inc` is
   * top-level only). `"create"` (default) — the field stays editable: the
   * server only fills it when the value is left out and it has
   * `@db.default.now`, or is an `@db.onUpdate.inc` counter (`0`). Since
   * 0.1.154; `@db.onUpdate.inc` since 0.1.159.
   */
  mode?: "create" | "edit";
}

/**
 * The object defs, and the array / union / tuple field defs, under
 * construction (innermost last). A recursive type reached again inside its own
 * build reuses the def being built, so the def graph gets a cycle instead of
 * an endless expansion: a tree's `children` items are the same def at every
 * depth, built once. A field def is reused only at the same path relative to
 * its object def, so a reused field always sits where it was built. Both are
 * per mode (`edit`), which shapes the defs.
 */
const defsInProgress: { type: TAtscriptAnnotatedType; edit: boolean; def: FormDef }[] = [];
const fieldsInProgress: {
  prop: TAtscriptAnnotatedType;
  path: string;
  edit: boolean;
  field: FormFieldDef;
  /** Unnamed copies of `field` (see `unnamed`), filled once it is built. */
  copies: FormFieldDef[];
}[] = [];

/**
 * `field` without its name (a tuple item). A field def still under
 * construction (a recursion back to it) gets a copy filled when it is built.
 */
function unnamed(field: FormFieldDef): FormFieldDef {
  const building = fieldsInProgress.find((e) => e.field === field);
  if (!building) return { ...field, name: "" };
  const copy = { name: "" } as FormFieldDef;
  building.copies.push(copy);
  return copy;
}

/**
 * Converts an ATScript annotated type into a FormDef.
 *
 * - **Object types** (`kind === 'object'`): produces an object root with nested fields.
 * - **Non-object types** (primitive, array, union, etc.): produces a single leaf root field
 *   with `path: ''`.
 *
 * A `@db.column.derived` field is marked `derived` straight from its metadata;
 * a computed view column, from `opts.metaFields`; an update-stamped field
 * (see `CreateFormDefOptions.mode`), when `opts.mode` is `"edit"`.
 *
 * A navigation field (`@db.rel.from` / `.to` / `.via`) is left out unless it
 * carries a `@ui.form.*` annotation of its own (see {@link isSkippedNavField}).
 *
 * Recursive types are safe at any depth: a type reached again inside its own
 * build reuses the def being built (the def graph is cyclic, not infinite).
 * A recursive object that would otherwise render inline (no `@ui.form.*`)
 * becomes a nested object field, since inlining it would never end.
 */
export function createFormDef(type: TAtscriptAnnotatedType, opts?: CreateFormDefOptions): FormDef {
  return buildFormDef(type, opts?.mode === "edit", opts ?? {});
}

/**
 * The def of an object (or a leaf) type. `root`: the caller's options, for the
 * form's own type only — nested objects get none of the root-table ones.
 */
function buildFormDef(
  type: TAtscriptAnnotatedType,
  edit: boolean,
  root?: CreateFormDefOptions,
): FormDef {
  // Non-object types: single leaf field (never pushed down)
  if (type.type.kind !== "object") {
    const rootField = createFieldDef("", type, edit);
    const fields = [rootField];
    return { type, rootField, fields, mainFields: fields, pushDownFields: [], flatMap: new Map() };
  }

  // A nested def reached again inside its own build is the one being built.
  // The root's is never reused (root options shape it alone).
  if (!root) {
    const reached = defsInProgress.find((e) => e.type === type && e.edit === edit);
    if (reached) return reached.def;
  }

  // Object types: flatten and iterate props
  const objectType = type as TAtscriptAnnotatedType<TAtscriptTypeObject>;
  const flatMap = flattenAnnotatedType(objectType, { excludePhantomTypes: false });
  const opts: CreateFormDefOptions | undefined = root && {
    ...root,
    versionColumn: root.versionColumn ?? (edit ? findVersionColumn(flatMap) : undefined),
  };

  const fields: FormFieldDef[] = [];
  const rootField = {
    path: "",
    prop: type,
    type: "object",
    phantom: false,
    name: "",
    allStatic: false,
    pushDown: false,
  } as FormObjectFieldDef;
  const def: FormDef = { type, rootField, fields, mainFields: fields, pushDownFields: [], flatMap };
  rootField.objectDef = def;

  let collected: CollectedField[];
  if (!root) defsInProgress.push({ type, edit, def });
  try {
    collected = collectFields(objectType, flatMap, edit, opts);
  } finally {
    if (!root) defsInProgress.pop();
  }

  // Sort by `@ui.form.order` (stable: flatMap order among equals).
  collected.sort((a, b) => a.order - b.order);
  for (const c of collected) fields.push(c.field);

  // Partition by `@ui.form.pushDown` once. Common case (nothing pushed down):
  // reuse `fields` as `mainFields` to avoid a copy; only split when needed.
  if (collected.some((c) => c.pushDown)) {
    def.mainFields = [];
    for (const c of collected) (c.pushDown ? def.pushDownFields : def.mainFields).push(c.field);
  }

  return def;
}

/**
 * A top-level field of an object def, with its own prop's placement read up
 * front: a recursive field def may still be under construction here.
 */
interface CollectedField {
  field: FormFieldDef;
  order: number;
  pushDown: boolean;
}

/** Builds the top-level fields of an object def from its flattened props, unsorted. */
function collectFields(
  objectType: TAtscriptAnnotatedType<TAtscriptTypeObject>,
  flatMap: Map<string, TAtscriptAnnotatedType>,
  edit: boolean,
  opts: CreateFormDefOptions | undefined,
): CollectedField[] {
  const fields: CollectedField[] = [];
  // Paths whose children are not fields of this def: a structured field owns
  // them, or a skipped navigation field drops them. Pre-suffixed with ".".
  const structuredPrefixes = new Set<string>();

  for (const [path, prop] of flatMap.entries()) {
    if (path === "") continue;
    if (path === opts?.versionColumn) continue;
    if (isChildOfStructured(path, structuredPrefixes)) continue;

    const originalProp = resolveOriginalProp(objectType, path) ?? prop;
    const kind = originalProp.type.kind;

    if (isSkippedNavField(originalProp)) {
      structuredPrefixes.add(path + ".");
      continue;
    }

    // Namespace objects: skip, children render inline. A recursive object
    // reached again is listed without children (`flattenAnnotatedType` does
    // not expand it), and an opted-in navigation object is another table's
    // row, so both render as a nested object field instead.
    if (
      kind === "object" &&
      !isStructuredObject(originalProp) &&
      !isNavRelation(originalProp) &&
      !isUnexpandedObject(path, originalProp, flatMap)
    ) {
      continue;
    }

    // Nested arrays without component: unsupported
    if (kind === "array") {
      const arrayType = originalProp.type as TAtscriptTypeArray;
      if (arrayType.of.type.kind === "array" && !getFieldMeta(originalProp, UI_FORM_COMPONENT))
        continue;
    }

    // Mark structured prefixes (pre-suffixed with "." for efficient child checks)
    if (kind === "array" || kind === "object" || kind === "union" || kind === "tuple") {
      structuredPrefixes.add(path + ".");
    }

    const field = createFieldDef(path, originalProp, edit);
    fields.push({
      // A copy: a recursive type's field defs may be shared with nested defs.
      field: opts?.metaFields?.[path]?.computed ? { ...field, derived: true } : field,
      order: (getFieldMeta(originalProp, UI_FORM_ORDER) as number | undefined) ?? Infinity,
      pushDown: getFieldMeta(originalProp, UI_FORM_PUSH_DOWN) !== undefined,
    });
  }
  return fields;
}

// ── Unified field def creation ───────────────────────────────

/**
 * Creates a FormFieldDef from any ATScript annotated type. `edit`: the form
 * edits a stored row (`CreateFormDefOptions.mode`).
 *
 * An array, union or tuple reached again at the same path inside its own
 * build (an array item, a union variant or a tuple item of a recursive alias)
 * gets the field def under construction. Every other recursion passes an
 * object def, which `defsInProgress` catches, so the build always ends.
 */
function createFieldDef(path: string, prop: TAtscriptAnnotatedType, edit: boolean): FormFieldDef {
  const kind = prop.type.kind;
  if (kind === "" || kind === "object") return buildFieldDef(path, prop, edit);
  const reached = fieldsInProgress.find(
    (e) => e.prop === prop && e.path === path && e.edit === edit,
  );
  if (reached) return reached.field;
  const building = { prop, path, edit, field: {} as FormFieldDef, copies: [] as FormFieldDef[] };
  fieldsInProgress.push(building);
  try {
    const field = Object.assign(building.field, buildFieldDef(path, prop, edit));
    for (const copy of building.copies) Object.assign(copy, field, { name: "" });
    return field;
  } finally {
    fieldsInProgress.pop();
  }
}

function buildFieldDef(path: string, prop: TAtscriptAnnotatedType, edit: boolean): FormFieldDef {
  const kind = prop.type.kind;
  const name = path.slice(path.lastIndexOf(".") + 1);
  const allStatic = !hasComputedAnnotations(prop);
  const declaredType =
    (getFieldMeta(prop, UI_FORM_TYPE) as string | undefined) ??
    (getFieldMeta(prop, UI_TYPE) as string | undefined);
  // `tags` edits an array; elsewhere it would mount with a scalar.
  const uiType = declaredType === "tags" && kind !== "array" ? undefined : declaredType;
  const pushDown = getFieldMeta(prop, UI_FORM_PUSH_DOWN) !== undefined;
  // Resolved ONCE per field and carried on the def (mirrors `ColumnDef` on the
  // table side). The `ref` chain walk used to run twice — here as a boolean
  // dispatch test, and again in `<AsField>`'s setup for the actual url /
  // targetField — so the renderer now reads `field.valueHelpInfo` instead.
  const valueHelpInfo = extractValueHelp(prop);
  // `@db.column.derived` is valid only on a top-level `@db.table` field, so
  // the annotation alone marks the field — no path bookkeeping. An edit form's
  // update stamp is just as server-owned — on a property only (`path`): the
  // server stamps no array element / union member (`T | null`'s is the
  // property's own, read by `isUpdateStamped`).
  const derived =
    getFieldMeta(prop, DB_COLUMN_DERIVED) !== undefined ||
    (edit && path !== "" && isUpdateStamped(prop));
  const base = {
    path,
    prop,
    phantom: false,
    name,
    allStatic,
    pushDown,
    valueHelpInfo,
    ...(derived && { derived: true as const }),
  };
  // Structured kinds (array, object, tuple, multi-variant union) need to
  // keep `type` equal to the kind so the `isArrayField` / `isObjectField`
  // / `isTupleField` / `isUnionField` guards (and the validator / path-
  // provide / item-recursion logic that branches on them) stay honest.
  // The `@ui.form.type` / `@ui.type` override therefore lives on a
  // separate `customType` field — AsField checks it first when resolving
  // the types-map entry and falls back to `type` only when there is no
  // match. Primitives keep the original behaviour (uiType folded into
  // `type` directly) because they have no structural contract to
  // preserve.
  const customType = uiType;

  // Array
  if (kind === "array") {
    const arrayType = prop.type as TAtscriptTypeArray;
    // Multiselect dispatch: keep structural `type: 'array'` so isArrayField
    // and validator/path logic stay honest; route the renderer via
    // customType. Eligibility: explicit @ui.form.type multiselect, OR
    // array carries @ui.form.options / @ui.form.fn.options, OR item is a
    // pure literal union. Free entry (`tags`): explicit @ui.form.type tags,
    // OR an explicit multiselect with nothing to pick from.
    const hasOptions =
      getFieldMeta(prop, UI_FORM_OPTIONS) !== undefined ||
      getFieldMeta(prop, UI_FORM_FN_OPTIONS) !== undefined ||
      isPureLiteralUnion(arrayType.of);
    const isTags = customType === "tags" || (customType === "multiselect" && !hasOptions);
    const isMultiselect = customType === "multiselect" || hasOptions;
    return {
      ...base,
      type: "array",
      customType: isTags ? "tags" : isMultiselect ? "multiselect" : customType,
      itemType: arrayType.of,
      itemField: labelledBy(createFieldDef("", arrayType.of, edit), prop),
    } as FormArrayFieldDef;
  }

  // Object
  if (kind === "object") {
    return {
      ...base,
      type: "object",
      customType,
      objectDef: buildFormDef(prop, edit),
    } as FormObjectFieldDef;
  }

  // Union → select (pure literals) or union (multi) or unwrap (single)
  if (kind === "union") {
    if (isPureLiteralUnion(prop)) {
      return { ...base, type: uiType ?? "select" };
    }

    // The server sets an update stamp below `T | null`, not below a union of
    // several value types.
    const unionVariants = createUnionVariants(prop, edit && soleValueMember(prop) !== undefined);
    if (unionVariants.length > 1) {
      return { ...base, type: "union", customType, unionVariants } as FormUnionFieldDef;
    }
    const v = unionVariants[0];
    if (v?.itemField) {
      return {
        ...v.itemField,
        path,
        name,
        allStatic,
        pushDown,
        ...(derived && { derived: true as const }),
      };
    }
    if (v?.def) {
      return {
        ...base,
        type: "object",
        customType,
        objectDef: v.def,
      } as FormObjectFieldDef;
    }
  }

  // Tuple → fixed-length array with typed positions
  if (kind === "tuple") {
    const tupleType = prop.type as TAtscriptTypeComplex;
    return {
      ...base,
      type: "tuple",
      customType,
      // Not `edit`: the server stamps no field below a tuple.
      itemFields: tupleType.items.map((item, i) => unnamed(createFieldDef(String(i), item, false))),
    } as FormTupleFieldDef;
  }

  if (valueHelpInfo) {
    return { ...base, type: uiType ?? "ref" };
  }

  // Primitive / intersection / fallback
  const tags = kind === "" ? prop.type.tags : undefined;
  let uiTag: string | undefined;
  let isTimestamp = false;
  if (tags) {
    for (const t of tags) {
      if (uiTag === undefined && UI_TAGS.has(t)) uiTag = t;
      if (t === "timestamp") isTimestamp = true;
    }
  }
  const dt = kind === "" ? prop.type.designType : undefined;
  // Numeric dispatcher — `@db.amount.currency` / `@db.unit` / `@ui.form.prefix` /
  // `@ui.form.suffix` (literal or `.ref`) automatically dispatch the field to
  // `decimal` (bank-UX two-input chrome) or `number` (single-input with
  // prefix/suffix adornments). Mirrors the table-side cell dispatch where the
  // same `@db.amount.*` / `@db.unit.*` annotations drive currency/unit
  // formatting.
  //
  // Precedence chain inside the dispatcher:
  //   1. Currency present → decimal (forces bank-UX chrome regardless of dt)
  //   2. Native `decimal` design type → decimal
  //   3. Native `number` with @db.unit OR @ui.form.prefix OR @ui.form.suffix → number
  //      (adornment chrome lives in AsNumber; otherwise falls through to plain
  //       AsInput type=number via the designType branch below)
  let numericType: "decimal" | "number" | undefined;
  if (kind === "") {
    const hasCurrency =
      getFieldMeta(prop, DB_AMOUNT_CURRENCY) !== undefined ||
      getFieldMeta(prop, DB_AMOUNT_CURRENCY_REF) !== undefined;
    const isDecimalDesign = dt === "decimal";
    if (hasCurrency) {
      numericType = "decimal";
    } else if (isDecimalDesign) {
      numericType = "decimal";
    } else if (dt === "number") {
      const hasUnit =
        getFieldMeta(prop, DB_UNIT) !== undefined || getFieldMeta(prop, DB_UNIT_REF) !== undefined;
      const hasPrefix =
        getFieldMeta(prop, UI_FORM_PREFIX) !== undefined ||
        getFieldMeta(prop, UI_FORM_PREFIX_REF) !== undefined ||
        getFieldMeta(prop, UI_FORM_PREFIX_ICON) !== undefined;
      const hasSuffix =
        getFieldMeta(prop, UI_FORM_SUFFIX) !== undefined ||
        getFieldMeta(prop, UI_FORM_SUFFIX_REF) !== undefined ||
        getFieldMeta(prop, UI_FORM_SUFFIX_ICON) !== undefined;
      if (hasUnit || hasPrefix || hasSuffix) numericType = "number";
    }
  }
  // `number.timestamp` (epoch-ms primitive) → render as datetime out of
  // the box, matching the cell-side `inferDisplayType` rule.
  const tagType = isTimestamp ? "datetime" : undefined;
  return {
    ...base,
    type:
      uiType ??
      uiTag ??
      numericType ??
      tagType ??
      (dt === "number" ? "number" : dt === "boolean" ? "checkbox" : "text"),
    phantom: kind === "" && dt === "phantom",
  };
}

// ── Helpers ─────────────────────────────────────────────────

/** Non-`ui.form.*` keys that still address the object itself. */
const OBJECT_IDENTITY_KEYS = new Set<string>([META_LABEL, META_DESCRIPTION, UI_TYPE]);
/** `ui.form.*` keys that place a field rather than give it an identity. */
const UI_FORM_PLACEMENT_NS = "ui.form.grid.";

/**
 * Whether an object prop renders as a field of its own rather than being
 * flattened into its parent.
 *
 * Any `@ui.form.*` annotation (plus `@meta.label` / `@meta.description` /
 * `@ui.type`) means the author addressed the object itself, so it needs a
 * field to carry that instruction to a renderer — a collapsible section, or
 * whatever `@ui.form.component` / `@ui.form.type` names. An object with none
 * of them is a pure namespace: it is dropped and its children render inline
 * in the parent grid, which keeps DB-flattened structs (`addr.street` stored
 * as `addr__street`) from growing chrome nobody asked for. `@db.*`,
 * `@expect.*` and the rest of `@meta.*` stay out for exactly that reason —
 * they are what such a struct carries.
 *
 * Placement keys (`@ui.form.order`, `@ui.form.grid.*`) are excluded: they
 * position a field among its siblings, and a namespace has no position of its
 * own — its children carry their own.
 *
 * A prefix rule rather than a list because the list was wrong the moment it
 * was written. Matching on `@meta.label` and `@ui.form.component` alone left
 * every other key to be read off a prop that never became a field: a
 * `@meta.description` went missing, a `@ui.form.type` component silently
 * never mounted, `@ui.form.pushDown` never pushed down, and — the one that
 * mattered — `@ui.form.hidden` on a struct left every child on screen.
 */
function isStructuredObject(prop: TAtscriptAnnotatedType): boolean {
  for (const key of prop.metadata.keys()) {
    if (OBJECT_IDENTITY_KEYS.has(key)) return true;
    if (!key.startsWith(UI_FORM_NS)) continue;
    if (key === UI_FORM_ORDER || key.startsWith(UI_FORM_PLACEMENT_NS)) continue;
    return true;
  }
  return false;
}

/** The top-level `@db.column.version` field of a flattened type, if any. */
export function findVersionColumn(
  flatMap: Map<string, TAtscriptAnnotatedType>,
): string | undefined {
  for (const [path, prop] of flatMap) {
    if (path && !path.includes(".") && prop.metadata.has(DB_COLUMN_VERSION)) return path;
  }
  return undefined;
}

/**
 * An object prop that `flattenAnnotatedType` listed without expanding it: a
 * recursive type reached again. Its children are absent from the flat map.
 */
function isUnexpandedObject(
  path: string,
  prop: TAtscriptAnnotatedType,
  flatMap: Map<string, TAtscriptAnnotatedType>,
): boolean {
  const first = (prop.type as TAtscriptTypeObject).props.keys().next();
  return !first.done && !flatMap.has(`${path}.${first.value}`);
}

/** Resolves the original annotated type from the type hierarchy by path. */
function resolveOriginalProp(
  type: TAtscriptAnnotatedType<TAtscriptTypeObject>,
  path: string,
): TAtscriptAnnotatedType | undefined {
  const parts = path.split(".");
  let current: TAtscriptTypeObject = type.type;
  for (let i = 0; i < parts.length - 1; i++) {
    const prop = current.props.get(parts[i]!);
    if (!prop || prop.type.kind !== "object") return undefined;
    current = prop.type as TAtscriptTypeObject;
  }
  return current.props.get(parts[parts.length - 1]!);
}

/** Check if a path is a child of any structured prefix (prefixes are pre-suffixed with "."). */
function isChildOfStructured(path: string, prefixes: Set<string>): boolean {
  for (const prefix of prefixes) {
    if (path.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Builds union variant definitions from a union annotated type.
 * Iterates top-level items directly — one variant per item.
 */
export function buildUnionVariants(typeDef: TAtscriptAnnotatedType): FormUnionVariant[] {
  return createUnionVariants(typeDef, false);
}

/**
 * A scalar field inside `outer` (an array item, a union variant) also takes `outer`'s
 * `@ui.literalLabel` labels — `flags: boolean[]`, `active: boolean | null`.
 */
function labelledBy(field: FormFieldDef, outer: TAtscriptAnnotatedType): FormFieldDef {
  // `field.prop` is still unset on a recursive field that is being built (never a scalar)
  if (field.prop?.type.kind === "" && outer.metadata.has(UI_LITERAL_LABEL)) {
    field.labelsFrom = outer;
  }
  return field;
}

function createUnionVariants(typeDef: TAtscriptAnnotatedType, edit: boolean): FormUnionVariant[] {
  const complex = typeDef.type as TAtscriptTypeComplex;
  const items = complex.items ?? [typeDef];
  const variants: FormUnionVariant[] = [];

  for (const item of items) {
    const v = createVariant(item, edit);
    if (v.itemField) labelledBy(v.itemField, typeDef);
    if (items.length > 1) {
      v.label = `${String(variants.length + 1)}. ${v.label}`;
    }
    variants.push(v);
  }

  return variants;
}

/** Creates a single union variant from an annotated type item. */
function createVariant(def: TAtscriptAnnotatedType, edit: boolean): FormUnionVariant {
  const kind = def.type.kind;

  if (kind === "object") {
    const label = (getFieldMeta(def, META_LABEL) as string | undefined) ?? "Object";
    const hasComponent = getFieldMeta(def, UI_FORM_COMPONENT) !== undefined;
    return {
      label,
      type: def,
      def: buildFormDef(def, edit),
      itemField: hasComponent ? createFieldDef("", def, edit) : undefined,
    };
  }

  // Primitive (final or phantom)
  if (kind === "") {
    const dt = def.type.designType as string;
    return {
      label: capitalize(dt === "phantom" ? "item" : dt),
      type: def,
      itemField: createFieldDef("", def, edit),
      designType: dt,
    };
  }

  // Complex types (array, tuple, intersection) — delegate to createFieldDef
  return {
    label: capitalize(kind),
    type: def,
    itemField: createFieldDef("", def, edit),
  };
}

/**
 * An update-stamped field (see `CreateFormDefOptions.mode`). Read off the prop,
 * or — as `@atscript/db` does — off the one value member of `T | null`, unless
 * the prop references another field.
 */
function isUpdateStamped(prop: TAtscriptAnnotatedType): boolean {
  if (isServerStampedOnUpdate(prop.metadata)) return true;
  const member = prop.ref?.field ? undefined : soleValueMember(prop);
  return member !== undefined && isServerStampedOnUpdate(member.metadata);
}

/** The one non-`null` / `undefined` member of a (nested) union, if there is exactly one. */
function soleValueMember(prop: TAtscriptAnnotatedType): TAtscriptAnnotatedType | undefined {
  if (prop.type.kind !== "union") return undefined;
  const members = new Set<TAtscriptAnnotatedType>();
  const visit = (t: TAtscriptAnnotatedType): void => {
    if (t.type.kind === "union") {
      for (const item of (t.type as TAtscriptTypeComplex).items) visit(item);
    } else if (!isEmptyMember(t)) {
      members.add(t);
    }
  };
  visit(prop);
  return members.size === 1 ? members.values().next().value : undefined;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
