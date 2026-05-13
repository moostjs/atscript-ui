# @atscript/vue-form

Vue 3 form library backed by `@atscript/ui`. Three tiers of components, ~30 composables, two factories, and one auto-resolver entry. Every Tier-1 component you tag (`<AsForm>`, `<AsField>`, `<AsIterator>`) wraps a public composable, so apps can drop the renderer and rebuild their own form root without losing functionality.

## Contents

- [Tier 1 — Primary components](#tier-1-primary-components)
- [Tier 2 — Default field components](#tier-2-default-field-components)
- [Factories](#factories)
- [Composables — form / state](#composables-form-state)
- [Composables — field & structure](#composables-field-structure)
- [Composables — value help / dropdown](#composables-value-help-dropdown)
- [Composables — choreography](#composables-choreography)
- [Composables — date / number / decimal](#composables-date-number-decimal)
- [Composables — context / utility](#composables-context-utility)
- [Component prop & emit types](#component-prop-emit-types)
- [Other types](#other-types)

## Tier 1 — Primary components

Imported automatically by `AsResolver()` (see [@atscript/ui-styles](/api/ui-styles)).

### `AsForm`

Top-level form renderer.

**Props** (subset — see `useAsForm` for full reactive contract):

```typescript
interface AsFormProps {
  def: FormDef;
  formData?: { value: unknown };
  formContext?: unknown;
  types: TAsTypeComponents;
  components?: Record<string, Component>;
  errors?: Record<string, string | undefined>;
  firstValidation?: "on-change" | "touched-on-blur" | "on-blur" | "on-submit";
  hideRootTitle?: boolean;
  loading?: boolean;
  clientFactory?: ClientFactory;
}
```

**Emits**:

- `submit(data)` — validation passed, data ready to ship.
- `error(errors)` — validation failed; payload is `{ path, message }[]`.
- `action(name, data)` — phantom `<AsAction>` button dispatched.
- `unsupportedAction(name, data)` — action name not declared on the form's type.
- `change(type, path, value, data)` — granular per-field change; `type` is `TAsChangeType`.

**Slots**: `form.header`, `form.before`, `form.after`, `form.submit`, `form.footer`.

### `AsField`

Renders a single field given a `FormFieldDef`. Use when laying out form fields manually instead of letting `AsForm` iterate.

```typescript
interface AsFieldProps {
  field: FormFieldDef;
  /** Optional override of the parent data context. */
  data?: { value: unknown };
}
```

### `AsIterator`

Iterates over a `FormObjectFieldDef`'s child fields and renders each through `AsField`. Used internally by `AsObject` and exposed for advanced compositions.

```typescript
interface AsIteratorProps {
  fields: FormFieldDef[];
  prefix?: string;
}
```

## Tier 2 — Default field components

Default swap targets for the `types` map. Importable both via the package root and the kebab subpath used by `AsResolver`.

```typescript
import { AsInput, AsSelect } from "@atscript/vue-form";
// or, for tree-shake-friendly single imports
import AsInput from "@atscript/vue-form/as-input";
```

Every component implements `TAsComponentProps`. The columns below list the `@ui.type` value that maps to each component in `createDefaultTypes()`.

| Component | Default `type` keys | Notes |
| --- | --- | --- |
| `AsFieldShell` | (all) | Chrome wrapper — title, description, error, hint, prefix/suffix. Used internally by every other default. |
| `AsInput` | `text`, `textarea`, `password` | Plain string input. |
| `AsNumber` | `number` | Integer input with prefix/suffix, currency-aware. |
| `AsDecimal` | `decimal` | Decimal-string input with `precisionScale` enforcement. |
| `AsSelect` | `select` | `<select>` element fed by `options` / value-help. |
| `AsRadio` | `radio` | Radio group. |
| `AsCheckbox` | `checkbox` | Boolean checkbox or tri-state. |
| `AsDate` | `date` | Date-only input. |
| `AsDatetime` | `datetime` | Date-time input. |
| `AsTime` | `time` | Time-of-day input. |
| `AsParagraph` | `paragraph` | Phantom read-only field; renders `value` as text. |
| `AsAction` | `action` | Phantom button — emits `action`. |
| `AsObject` | `object` | Iterates over a nested object's fields. |
| `AsArray` | `array` | Renders array items with add/remove affordances. |
| `AsUnion` | `union` | Variant picker + nested fields for the active branch. |
| `AsTuple` | `tuple` | Positional fields, fixed length. |
| `AsRef` | `ref` | FK input with value-help dropdown. |

All defaults accept the full `TAsComponentProps` contract — see [Component prop & emit types](#component-prop-emit-types).

## Factories

### `createDefaultTypes()`

Returns a pre-populated `TAsTypeComponents` map with every default in the table above.

```typescript
function createDefaultTypes(): TAsTypeComponents;
```

```typescript
import { createDefaultTypes } from "@atscript/vue-form";

const types = createDefaultTypes();
types.text = MyCustomTextInput; // swap one entry
```

### `createAsFormDef(type)`

Thin wrapper over `createFormDef(type)` from `@atscript/ui`. Caches by type identity so re-rendering doesn't rebuild the def.

```typescript
function createAsFormDef(type: TAtscriptAnnotatedType): FormDef;
```

### `formatIndexedLabelParts(parts)`

Helper for union/array variant labels. Joins `["Item", "2"]` → `"Item · 2"` with the framework's separator. Re-exported from `use-form-context.ts`.

```typescript
function formatIndexedLabelParts(parts: string[]): string;
```

## Composables — form / state

### `useAsForm(options)`

Powers `<AsForm>`. Owns the data container, internal validator, external-error dismissal, action routing, change merging, descendant counts, auto-open, and all provide/inject wiring. Use this when building a custom form root.

```typescript
function useAsForm<TFormData = unknown, TFormContext = unknown>(
  options: UseAsFormOptions<TFormData, TFormContext>,
): UseAsFormReturn<TFormData, TFormContext>;
```

`UseAsFormOptions` accepts **getters** for every reactive prop so `defineProps()` accessors thread in without an extra `ref`:

```typescript
interface UseAsFormOptions<TFormData, TFormContext> {
  def: () => FormDef;
  formData?: () => TFormData | undefined;
  formContext?: () => TFormContext | undefined;
  firstValidation?: () => TFormState["firstValidation"] | undefined;
  components?: () => Record<string, Component<TAsComponentProps>> | undefined;
  types: () => TAsTypeComponents;
  errors?: () => Record<string, string | undefined> | undefined;
  clientFactory?: () => ClientFactory | undefined;
  hideRootTitle?: () => boolean | undefined;
  emits?: {
    submit?: (data: TFormData) => void;
    error?: (errors: { path: string; message: string }[]) => void;
    action?: (name: string, data: TFormData) => void;
    unsupportedAction?: (name: string, data: TFormData) => void;
    change?: (type: TAsChangeType, path: string, value: unknown, formData: TFormData) => void;
  };
}
```

Returns:

```typescript
interface UseAsFormReturn<TFormData, TFormContext> {
  data: ComputedRef<TFormData>;
  errors: ComputedRef<Record<string, string | undefined> | undefined>;
  formError: ComputedRef<string | undefined>;
  internalErrors: Ref<Record<string, string>>;
  reset: () => Promise<void>;
  clearErrors: () => void;
  setErrors: (errors: Record<string, string>) => void;
  onSubmit: () => void;
  submitText: ComputedRef<string>;
  submitDisabled: ComputedRef<boolean>;
  invokeAction: (name: string) => void;
  dismissError: (path: string) => void;
  dismissFormError: () => void;
  formContext: ComputedRef<TFormContext | undefined>;
  handleChange: (type: TAsChangeType, path: string, value: unknown) => void;
}
```

### `useAsState(options)`

Lower-level state plumbing: validators, error maps, first-validation strategy, freshness tracking. `useAsForm` builds on top of this.

```typescript
function useAsState<TFormData, TFormContext>(options: {
  formData: ComputedRef<TFormData>;
  formContext: ComputedRef<TFormContext | undefined>;
  firstValidation: ComputedRef<TFormState["firstValidation"] | undefined>;
  submitValidator: TFormSubmitValidator;
}): UseAsStateReturn;
```

`TFormSubmitValidator` returns `true` for success or an `{ path, message }[]` error list.

### `useAsExternalErrors(options)`

Reactive merge + per-path dismissal for server-supplied errors. `useAsForm` mounts this internally; pull it directly when consuming `<AsForm>` from a wrapper that owns its own error state.

```typescript
function useAsExternalErrors(options: UseAsExternalErrorsOptions): UseAsExternalErrorsReturn;

interface UseAsExternalErrorsOptions {
  source: () => Record<string, string | undefined> | undefined;
}

interface UseAsExternalErrorsReturn {
  effective: ComputedRef<Record<string, string | undefined> | undefined>;
  formError: ComputedRef<string | undefined>;
  dismissAt: (path: string) => void;
  dismissForm: () => void;
}
```

## Composables — field & structure

### `useAsField(opts)`

Field-level state machine (model, error, blur). Custom field components call this when building their own validator pipeline outside `AsField`.

```typescript
interface UseAsFieldOptions<TValue, TFormData, TContext> {
  getValue: () => TValue;
  setValue: (v: TValue) => void;
  rules?: TFormRule<TValue, TFormData, TContext>[];
  path: () => string;
  resetValue?: TValue;
}

interface UseAsFieldReturn<TValue> {
  model: WritableComputedRef<TValue>;
  error: ComputedRef<string | undefined>;
  onBlur: () => void;
}

function useAsField<TValue, TFormData, TContext>(
  opts: UseAsFieldOptions<TValue, TFormData, TContext>,
): UseAsFieldReturn<TValue>;
```

### `useAsArray()`

Powers `AsArray`. Returns add / remove / canRemove / minItems / itemSingularLabel + the iteration helpers.

```typescript
function useAsArray(): UseAsArrayReturn;
```

### `useAsTuple()`

Powers `AsTuple`. Exposes per-position fields and validator hooks.

```typescript
function useAsTuple(): UseAsTupleReturn;
```

### `useAsUnion()`

Powers `AsUnion`. Exposes `variants`, the reactive selected index, and `changeVariant(index)`.

```typescript
function useAsUnion(): UseAsUnionReturn;
```

### `useAsUnionVariant()`

Reads the current union context (`TAsUnionContext`) injected by the closest `AsUnion`. Returns `undefined` outside a union.

```typescript
function useAsUnionVariant(): TAsUnionContext | undefined;
```

## Composables — value help / dropdown

### `useAsValueHelp(options)`

Lazily resolves `ValueHelpInfo` and exposes a paginated search API for FK inputs.

```typescript
interface UseAsValueHelpOptions {
  /** Resolved value-help descriptor. */
  valueHelp: () => ValueHelpInfo | undefined;
  /** Per-form override of the global ClientFactory. */
  clientFactory?: () => ClientFactory | undefined;
  /** Initial query/filter applied on open. */
  initialQuery?: () => string | undefined;
}

interface UseAsValueHelpReturn {
  items: Ref<Record<string, unknown>[]>;
  total: Ref<number>;
  loading: Ref<boolean>;
  error: Ref<unknown>;
  query: Ref<string>;
  load: (opts?: { page?: number; itemsPerPage?: number }) => Promise<void>;
}

function useAsValueHelp(options: UseAsValueHelpOptions): UseAsValueHelpReturn;
```

### `useAsDropdown()`

Headless dropdown state machine — open/close, anchor positioning, keyboard nav, focus trap. Powers `AsSelect` and the value-help popover.

```typescript
function useAsDropdown(options?: { onOpen?: () => void; onClose?: () => void }): {
  open: Ref<boolean>;
  toggle: () => void;
  close: () => void;
  triggerRef: Ref<HTMLElement | undefined>;
  popoverRef: Ref<HTMLElement | undefined>;
};
```

## Composables — choreography

### `useAsOptionalAddFlow(options)`

Implements the "Add" affordance for an optional field. When the user clicks "Add", the value is set to its default; when they clear it, the field is set to `undefined`.

```typescript
function useAsOptionalAddFlow(options: UseAsOptionalAddFlowOptions): UseAsOptionalAddFlowReturn;
```

### `useAsTriStateCheckbox(options)`

Three-state checkbox (`true` / `false` / `undefined`) with keyboard support.

```typescript
function useAsTriStateCheckbox(options: UseAsTriStateCheckboxOptions): UseAsTriStateCheckboxReturn;
```

### `useAsFocusFirstAfter()` / `focusFirstAfter(...)` / `focusNewFocusableAfter(...)`

Focus utilities for "after-toggle" flows — moves DOM focus to the first focusable element added to a region after a toggle.

```typescript
function useAsFocusFirstAfter(): { focusAfter: () => void };
function focusFirstAfter(host: HTMLElement | undefined): void;
function focusNewFocusableAfter(prev: HTMLElement[], host: HTMLElement | undefined): void;
```

## Composables — date / number / decimal

### `useAsDate(options)`

Handles ISO ↔ display conversion for `<AsDate>` / `<AsDatetime>` / `<AsTime>`.

```typescript
function useAsDate(options: UseAsDateOptions): UseAsDateReturn;
```

### `useAsNumber(options)`

Integer input model — handles `select-all on focus`, prefix/suffix, optional toggle.

```typescript
function useAsNumber(options: UseAsNumberOptions): UseAsNumberReturn;
```

### `useAsDecimal(options)`

Decimal-string input model — enforces `precisionScale`, currency formatting, locale separators. Stores as string, never bounces through float.

```typescript
function useAsDecimal(options: UseAsDecimalOptions): UseAsDecimalReturn;
```

### `useAsDualInput(options)`

Powers the merged-shell `AsDecimal` / `AsNumber` layout — two visual inputs (integer and fraction) sharing a single model.

```typescript
function useAsDualInput(options: UseAsDualInputOptions): UseAsDualInputReturn;
```

## Composables — context / utility

### `useAsLocale()` / `provideAsLocale(value)`

Provide/inject the active locale used by date and decimal composables.

```typescript
function provideAsLocale(value: () => UseAsLocaleReturn): void;
function useAsLocale(): UseAsLocaleReturn;
```

### `useAsPath()` / `useAsTypeMap()` / `useAsData()`

Read-only context wrappers exposing the current field path, type map, and form data container respectively. Useful in deeply nested custom components.

```typescript
function useAsPath(): UseAsPathReturn;     // { path: ComputedRef<string> }
function useAsTypeMap(): UseAsTypeMapReturn; // { types: ComputedRef<TAsTypeComponents>, ... }
function useAsData(): UseAsDataReturn;     // { data: ComputedRef<unknown> }
```

### `useAsErrorDismiss()`

Returns the dismissal callback bound by the closest `AsForm`. Lets a custom error-banner component dismiss its own path without bubbling through props.

```typescript
function useAsErrorDismiss(): AsErrorDismiss; // (path: string) => void
```

### `useAsNestedSectionsStore()` / `provideAsNestedSectionsStore()`

Shared collapsible-section store used by `AsObject`. Provide your own when wiring "Expand all" / "Collapse all" controls outside `AsForm`.

```typescript
interface AsNestedSectionsStore {
  isOpen(path: string): boolean;
  setOpen(path: string, open: boolean): void;
  toggle(path: string): void;
  expandAll(paths: Iterable<string>): void;
  collapseAll(paths: Iterable<string>): void;
}

function provideAsNestedSectionsStore(): AsNestedSectionsStore;
function useAsNestedSectionsStore(): AsNestedSectionsStore | undefined;
```

### `useFormContext()`

Internal-ish helper that exposes the closest `<AsForm>`'s combined state (data, context, types, components). Re-exported via the `use-form-context.ts` module for advanced wrappers — most code should reach for the more specific composables.

## Component prop & emit types

### `TAsComponentProps<V>`

The full prop contract for custom field components. Implement this so `AsField` can pass every resolved field state.

Key fields (excerpt — full type lives in `components/types.ts`):

```typescript
interface TAsBaseComponentProps {
  disabled?: boolean;
  hidden?: boolean;
}

interface TAsComponentProps<V = unknown> extends TAsBaseComponentProps {
  onBlur: () => void;
  error?: string;
  model: { value: V };
  /** Phantom display value (paragraph/action). */
  value?: unknown;
  label?: string;
  description?: string;
  hint?: string;
  placeholder?: string;
  prefixIcon?: string;
  suffixIcon?: string;
  prefix?: string;
  suffix?: string;
  class?: Record<string, boolean> | string;
  style?: Record<string, string> | string;
  optional?: boolean;
  onToggleOptional?: (enabled: boolean) => void;
  required?: boolean;
  readonly?: boolean;
  type: string;
  formAction?: TFormAction;
  name?: string;
  field?: FormFieldDef;
  options?: TFormEntryOptions[];
  maxLength?: number;
  autocomplete?: string;
  title?: string;
  level?: number;
  onRemove?: () => void;
  canRemove?: boolean;
  removeLabel?: string;
  arrayIndex?: number;
  path: string;
  valueHelp?: ValueHelpInfo;
  singularLabel?: string;
  inputId: string;
  errorId: string;
  descId: string;
  ariaDescribedBy?: string;
  currencyCode?: string;
  unitCode?: string;
  precisionScale?: number;
  scale?: number;
  hasAdornment?: boolean;
}
```

### `TAsComponentEmits<V>`

```typescript
interface TAsComponentEmits<_V = unknown> {
  (e: "action", name: string): void;
}
```

### `TAsChangeType`

```typescript
type TAsChangeType = "update" | "array-add" | "array-remove" | "union-switch";
```

### `TAsTypeComponents`

Required keys for built-in types plus an open index signature.

```typescript
type TAsTypeComponents = {
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
```

### `TAsUnionContext`

```typescript
interface TAsUnionContext {
  variants: FormUnionVariant[];
  currentIndex: Ref<number>;
  changeVariant: (index: number) => void;
}
```

## Other types

### `TFormState` / `TFormRule` / `TFormFieldCallbacks` / `TFormFieldRegistration`

Internal-ish but exported for advanced wrappers building their own field renderer. `TFormRule` is the per-field validator signature:

```typescript
type TFormRule<TValue, TFormData, TContext> = (
  value: TValue,
  data: TFormData,
  context: TContext,
) => true | string;
```

### Re-exports from `@atscript/ui`

`setDefaultClientFactory`, `getDefaultClientFactory`, `resetDefaultClientFactory`, `ClientFactory` — see [@atscript/ui — Client factory](/api/ui#client-factory).

## Cross-links

- [Forms — Hello World](/forms/hello-world)
- [Forms — Annotations Reference](/forms/annotations)
- [Forms — Field Types & Type Map](/forms/field-types)
- [Forms — Validation](/forms/validation)
- [Forms — Arrays](/forms/arrays), [Nested Objects](/forms/nested-objects), [Unions](/forms/unions), [Tuples](/forms/tuples)
- [Forms — Dynamic Fields](/forms/dynamic-fields)
- [Forms — Grid Layout](/forms/grid-layout)
- [Forms — Actions](/forms/actions)
- [Forms — References (FK)](/forms/references)
- [Forms — Three Levels of Override](/forms/customization), [Custom Components](/forms/custom-components), [Locale & Currency](/forms/locale)
- [@atscript/ui](/api/ui), [@atscript/ui-fns](/api/ui-fns)
