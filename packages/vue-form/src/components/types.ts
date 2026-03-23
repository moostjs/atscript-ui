import type { FormFieldDef, FormUnionVariant, TFormAction, TFormEntryOptions } from "@atscript/ui";
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
  /** Phantom field display value from `@ui.value` / `@ui.fn.value` (paragraphs, actions). `undefined` for data fields. */
  value?: unknown;
  /** Resolved field label from `@label` or `@ui.fn.label`. */
  label?: string;
  /** Resolved field description from `@description` or `@ui.fn.description`. */
  description?: string;
  /** Resolved hint text from `@ui.hint` or `@ui.fn.hint`. */
  hint?: string;
  /** Resolved placeholder from `@ui.placeholder` or `@ui.fn.placeholder`. */
  placeholder?: string;
  /** CSS class(es) from `@ui.class` or `@ui.fn.class`. */
  class?: Record<string, boolean> | string;
  /** Inline styles from `@ui.style` or `@ui.fn.style`. */
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
  /** Autocomplete hint from `@ui.autocomplete`. */
  autocomplete?: string;
  /** Resolved title from `@ui.title` / `@ui.fn.title` / `@meta.label` for structure/array fields. */
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
} & Record<string, Component>;

/**
 * Union context provided by `AsUnion` via `__as_union` inject key.
 * Consumed by header components (AsStructuredHeader, AsFieldShell) to render
 * the variant picker inline with the item's own header.
 */
export interface TAsUnionContext {
  /** All available union variant branches. */
  variants: FormUnionVariant[];
  /** Reactive index of the currently selected variant. */
  currentIndex: Ref<number>;
  /** Switch to a different variant (rewrites model data). */
  changeVariant: (index: number) => void;
}
