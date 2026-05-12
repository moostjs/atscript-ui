import type {
  FormFieldDef,
  FormUnionVariant,
  TFormAction,
  TFormEntryOptions,
  ValueHelpInfo,
} from "@atscript/ui";
import type { Component, Ref } from "vue";

/**
 * Shared base props available to all custom form components.
 */
export interface TAsBaseComponentProps {
  /** Whether this component is disabled. */
  disabled?: boolean;
  /** Whether this component is hidden. */
  hidden?: boolean;
}

/**
 * Props contract for custom field components used with `AsForm` / `AsField`.
 *
 * Implement this interface in your UI components so that `AsField` can pass
 * all resolved field state (value, label, validation errors, etc.) as props.
 *
 * @typeParam V - The field value type
 * @typeParam TFormData - The full form data object type
 * @typeParam TFormContext - The external context object type
 */
export interface TAsComponentProps<V = unknown> extends TAsBaseComponentProps {
  /** Called on field blur — triggers validation. */
  onBlur: () => void;
  /** Validation error message for this field, if any. */
  error?: string;
  /** Reactive model wrapping the field value. Bind with `v-model="model.value"`. */
  model: { value: V };
  /** Phantom field display value from `@meta.default` / `@ui.form.fn.value` (paragraphs, actions). `undefined` for data fields. */
  value?: unknown;
  /** Resolved field label from `@meta.label` or `@ui.form.fn.label`. */
  label?: string;
  /** Resolved field description from `@meta.description` or `@ui.form.fn.description`. */
  description?: string;
  /** Resolved hint text from `@ui.form.hint` or `@ui.form.fn.hint`. */
  hint?: string;
  /** Resolved placeholder from `@ui.form.placeholder` or `@ui.form.fn.placeholder`. */
  placeholder?: string;
  /** Resolved CSS class painting the prefix icon glyph from `@ui.form.prefix.icon`. Consumer manages safelist / preset coverage. Rendered as the leftmost adornment, before the `prefix` text. */
  prefixIcon?: string;
  /** Resolved CSS class painting the suffix icon glyph from `@ui.form.suffix.icon`. Consumer manages safelist / preset coverage. Rendered as the rightmost adornment, after the `suffix` text. */
  suffixIcon?: string;
  /** CSS class(es) from `@ui.form.classes` or `@ui.form.fn.classes`. */
  class?: Record<string, boolean> | string;
  /** Inline styles from `@ui.form.styles` or `@ui.form.fn.styles`. */
  style?: Record<string, string> | string;
  /** Whether the field is optional (not required). */
  optional?: boolean | undefined;
  /** Toggle an optional field on/off. `true` sets default value; `false` sets `undefined`. Only present when `optional` is true. */
  onToggleOptional?: (enabled: boolean) => void;
  /** Whether the field is required (inverse of optional). */
  required?: boolean | undefined;
  /** Whether the field is read-only. */
  readonly?: boolean | undefined;
  /** The resolved field input type (e.g., `'text'`, `'select'`, `'checkbox'`). */
  type: string;
  /** Form action from `@ui.form.action`. Contains the action id and display label. */
  formAction?: TFormAction;
  /** The field name (last segment of the dot-separated path). */
  name?: string;
  /** The full FormFieldDef for advanced use cases. */
  field?: FormFieldDef;
  /** Resolved options for select/radio/checkbox fields. */
  options?: TFormEntryOptions[];
  /** Max length constraint from `@expect.maxLength`. */
  maxLength?: number;
  /** Autocomplete hint from `@ui.form.autocomplete`. */
  autocomplete?: string;
  /** Resolved title from `@ui.form.fn.title` / `@meta.label` for structure/array fields. */
  title?: string;
  /** Nesting level for structure/array fields. Root structure is 0, each nested structure/array increments by 1. */
  level?: number;
  /** Callback to remove this item from its parent array. Present when rendered inside an array. */
  onRemove?: () => void;
  /** Whether removal is allowed (respects minLength constraints). */
  canRemove?: boolean;
  /** Label for the remove button (from `@ui.array.remove.label`). */
  removeLabel?: string;
  /** Zero-based index when rendered as a direct array item. `undefined` otherwise. */
  arrayIndex?: number;
  /** Absolute dotted path to this field inside the form data. Empty string at the root. */
  path: string;
  /** Resolved value-help descriptor for FK ref fields (`@db.rel.FK` → `@db.http.path`). */
  valueHelp?: ValueHelpInfo;
  /** Singular label for array fields (`@ui.form.label.singular`) — used in "Add <singular>" affordances. */
  singularLabel?: string;
  /** Stable input element id, suitable for `<label :for>`. Co-resolved with `errorId` / `descId` so a11y wiring is consistent. Always populated by AsField. */
  inputId: string;
  /** Stable id for the error/hint container. Pair with `aria-describedby` (already resolved as `ariaDescribedBy`). Always populated by AsField. */
  errorId: string;
  /** Stable id for the description container. Always populated by AsField. */
  descId: string;
  /** Pre-resolved `aria-describedby` target — `errorId` when error/hint is present, else `descId`, else `undefined`. */
  ariaDescribedBy?: string;
  /**
   * Resolved currency code (post-sibling resolution).
   *
   * Resolution chain at AsField: `@db.amount.currency 'EUR'` literal →
   * `@db.amount.currency.ref 'fieldName'` sibling-field read → `undefined`.
   * Useful for tooltips/titles (e.g. hovering an AsDecimal shell shows
   * "USD"). Note: when `prefix` is also resolved from currency, the
   * `currencyCode` here is the symbolic identifier; `prefix` carries
   * the locale-aware narrow symbol.
   */
  currencyCode?: string;
  /**
   * Resolved unit-of-measure code (post-sibling resolution).
   *
   * Resolution chain at AsField: `@db.unit 'kg'` literal →
   * `@db.unit.ref 'fieldName'` sibling-field read → `undefined`. Useful
   * for tooltips. Note: when `suffix` is also resolved from `@db.unit*`,
   * `unitCode` and `suffix` carry the same string.
   */
  unitCode?: string;
  /**
   * Decimal scale storage cap (the DB column's fractional-digit limit) —
   * raw second arg of `@db.column.precision precision, scale`. The
   * composables pad outgoing strings to this; for display, use `scale`
   * (which may be tighter due to currency natural digits).
   */
  precisionScale?: number;
  /**
   * Resolved input prefix adornment.
   *
   * Resolution chain at AsField: explicit `@ui.form.prefix 'value'` →
   * `@ui.form.prefix.ref 'fieldName'` sibling-field read → currency
   * symbol (locale-narrow form, when currency is resolved) → `undefined`.
   * Applied by AsInput, AsNumber, AsDecimal.
   */
  prefix?: string;
  /**
   * Resolved input suffix adornment.
   *
   * Resolution chain at AsField: explicit `@ui.form.suffix 'value'` →
   * `@ui.form.suffix.ref 'fieldName'` sibling-field read → unit code
   * (resolved `unitCode`) → `undefined`. Applied by AsInput, AsNumber,
   * AsDecimal.
   */
  suffix?: string;
  /**
   * Effective display scale (fractional digits) — composables enforce
   * this when editing decimals.
   *
   * Resolution: `min(currencyDecimals, precisionScale)` when currency is
   * resolved, else `currencyDecimals` (currency only), else
   * `precisionScale` (DB only), else `undefined`. Smaller than
   * `precisionScale` is fine — storage stays at the DB cap, display
   * truncates to this.
   */
  scale?: number;
  /**
   * Whether AsField found at least one adornment-driving annotation on
   * this field (`@db.amount.currency*`, `@db.unit*`, `@ui.form.prefix*`,
   * `@ui.form.suffix*`). Used by AsNumber / AsDecimal to keep the
   * merged-chrome shell visible even when a sibling-ref source is
   * currently empty — without this flag, the shell would flicker as
   * the user picks a source value.
   *
   * Always populated by AsField; defaults to `false` when no adornment
   * annotation is present on the prop.
   */
  hasAdornment?: boolean;
}

/**
 * Public emits contract for custom field components used with `AsForm` /
 * `AsField`. Type your `defineEmits` against this interface so the
 * action-button surface stays compatible with the framework.
 *
 * `_V` is reserved for forward-compat with value-typed emits in Phase 4
 * (e.g. `(e: 'change-value', value: _V)`); the underscore prefix marks it
 * as deliberately unused under both biome and eslint conventions.
 *
 * @typeParam _V - The field value type (reserved for future emits)
 */
export interface TAsComponentEmits<_V = unknown> {
  /**
   * Action invocation — emitted by phantom action buttons. The form
   * routes the named action through its `@action` handler.
   */
  (e: "action", name: string): void;
}

/**
 * Discriminated type for the `change` event emitted by `AsForm`.
 *
 * - `'update'` — leaf field value committed (blur)
 * - `'array-add'` — array item added
 * - `'array-remove'` — array item removed
 * - `'union-switch'` — union variant switched
 */
export type TAsChangeType = "update" | "array-add" | "array-remove" | "union-switch";

/**
 * Type-to-component map for `AsForm`. Lists all built-in field types as
 * required keys and accepts additional custom types via index signature.
 *
 * Use {@link createDefaultTypes} to get a pre-built map with all defaults.
 */
export type TAsTypeComponents = {
  text: Component;
  select: Component;
  radio: Component;
  checkbox: Component;
  paragraph: Component;
  action: Component;
  object: Component;
  array: Component;
  union: Component;
  tuple: Component;
  ref: Component;
  decimal: Component;
  number: Component;
  date: Component;
  datetime: Component;
  time: Component;
} & Record<string, Component>;

/**
 * Union context provided by `AsUnion` via `UNION_CONTEXT_KEY`.
 * Consumed by `AsFieldShell` to render the variant picker inline with the
 * item's own header.
 */
export interface TAsUnionContext {
  /** All available union variant branches. */
  variants: FormUnionVariant[];
  /** Reactive index of the currently selected variant. */
  currentIndex: Ref<number>;
  /** Switch to a different variant (rewrites model data). */
  changeVariant: (index: number) => void;
}
