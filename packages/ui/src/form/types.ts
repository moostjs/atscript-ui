import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";

export type { TFormEntryOptions } from "../value-help/types";

/** Form action metadata — the action id and display label. */
export interface TFormAction {
  id: string;
  label: string;
}

/**
 * A single form field definition — thin pointer to the ATScript prop.
 *
 * All metadata (label, disabled, options, etc.) lives in `prop.metadata`
 * and is resolved on demand via resolve utilities.
 */
export interface FormFieldDef {
  /** Dot-separated path relative to the parent data context. `''` = root. */
  path: string;
  prop: TAtscriptAnnotatedType;
  /**
   * Render-key the renderer dispatches on. For structured kinds (array,
   * object, tuple, multi-variant union) this stays the kind name so that
   * `isArrayField`/`isObjectField`/`isUnionField`/`isTupleField` keep
   * working downstream (validator resetValue, child path provide, AsArray
   * recursion). Primitives may store an `@ui.form.type`/`@ui.type`
   * override here directly — for those there is no structural behaviour
   * to preserve.
   */
  type: string;
  /**
   * Optional `@ui.form.type` (or `@ui.type`) override for structured
   * kinds. When set, the renderer looks this up in the `types` map FIRST
   * and falls back to `type` only when the map has no entry. Letting the
   * override live in a separate field keeps the structural type guards
   * (`isArrayField` et al.) on `type` honest while still allowing a
   * consumer to attach a flat custom widget to e.g. a `string[]`.
   */
  customType?: string;
  phantom: boolean;
  name: string;
  /** True when no `ui.fn.*` metadata keys exist. Vue perf flag. */
  allStatic: boolean;
  /**
   * `@ui.form.pushDown` — render this field below the submit button in its
   * own grid, instead of in the main field grid above submit. Set on
   * top-level form fields (typically secondary `ui.action` links). The field
   * stays in `fields[]` for validation/data; only its render slot moves.
   */
  pushDown: boolean;
}

/**
 * Complete form definition — produced by createFormDef().
 * Form-level metadata (title, submit) resolved on demand via resolveFormProp.
 */
export interface FormDef {
  type: TAtscriptAnnotatedType;
  /** Root field representing the entire form. For interface types this is `type='object'`; for single-type forms it is a leaf field. */
  rootField: FormFieldDef;
  fields: FormFieldDef[];
  /**
   * Render partition of `fields` by `@ui.form.pushDown`, precomputed once so
   * the renderer never re-scans per frame. `mainFields` (above submit) plus
   * `pushDownFields` (below submit) cover `fields` exactly once. In the common
   * case nothing is pushed down: `mainFields === fields` (same ref) and
   * `pushDownFields` is empty.
   */
  mainFields: FormFieldDef[];
  pushDownFields: FormFieldDef[];
  flatMap: Map<string, TAtscriptAnnotatedType>;
}

// ── Array, Object, Union, Tuple extensions ───────────────────

/** One branch of a union type — used by union fields and union array items. */
export interface FormUnionVariant {
  /** Display label — from @meta.label or auto-generated (e.g. "1. String") */
  label: string;
  /** The annotated type for this variant */
  type: TAtscriptAnnotatedType;
  /** Pre-built FormDef for object variants (undefined for primitives) */
  def?: FormDef;
  /** Pre-built field def for primitive variants (undefined for objects) */
  itemField?: FormFieldDef;
  /** Design type for primitive variants ('string', 'number', 'boolean') */
  designType?: string;
}

/** Extended field def for array-typed fields. */
export interface FormArrayFieldDef extends FormFieldDef {
  /** ATScript annotated type of array items (from TAtscriptTypeArray.of) */
  itemType: TAtscriptAnnotatedType;
  /** Pre-built template field def for items (path=''). */
  itemField: FormFieldDef;
}

/** Extended field def for object (interface/type) nested fields. */
export interface FormObjectFieldDef extends FormFieldDef {
  /** Pre-built FormDef for the nested object's fields */
  objectDef: FormDef;
}

/** Extended field def for union fields — standalone union props and union array items. */
export interface FormUnionFieldDef extends FormFieldDef {
  /** Available union branches. */
  unionVariants: FormUnionVariant[];
}

/** Extended field def for tuple fields — fixed-length with typed positions. */
export interface FormTupleFieldDef extends FormFieldDef {
  /** Pre-built field defs, one per tuple position. */
  itemFields: FormFieldDef[];
}

/** Type guard: checks if a field def is an array field. */
export function isArrayField(field: FormFieldDef): field is FormArrayFieldDef {
  return field.type === "array";
}

/** Type guard: checks if a field def is an object field. */
export function isObjectField(field: FormFieldDef): field is FormObjectFieldDef {
  return field.type === "object";
}

/** Type guard: checks if a field def is a union field. */
export function isUnionField(field: FormFieldDef): field is FormUnionFieldDef {
  return field.type === "union";
}

/** Type guard: checks if a field def is a tuple field. */
export function isTupleField(field: FormFieldDef): field is FormTupleFieldDef {
  return field.type === "tuple";
}
