# @atscript/vue-form

Vue 3 form library backed by `@atscript/ui`. Three tiers of components, ~30 composables, two factories, and one auto-resolver entry. Every Tier-1 component you tag (`<AsForm>`, `<AsField>`, `<AsIterator>`) wraps a public composable, so apps can drop the renderer and rebuild their own form root without losing functionality.

## Contents

- [Tier 1 — Primary components](#tier-1-primary-components)
- [Tier 2 — Default field components](#tier-2-default-field-components)
- [Factories](#factories)
- [Composables — form / state](#composables-form-state)
- [Composables — change tracking](#composables-change-tracking)
- [Composables — field & structure](#composables-field-structure)
- [Composables — custom container renderers](#composables-custom-container-renderers)
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
  hideSubmit?: boolean;
  loading?: boolean;
  clientFactory?: ClientFactory;
  /** Opt into change tracking. OFF by default = zero overhead. Unlocks `isDirty` / `changes` / `getPatch` on slots, the `defineExpose` surface, and [`useAsFormPatch()`](#useasformpatch). See [Change tracking](/forms/change-tracking). */
  trackChanges?: boolean;
}
```

**Expose** (template ref): alongside the form's own controls, the instance carries the change-tracking surface — `submit()`, `reset()`, `isDirty`, `changes`, `getPatch(opts?)`, `getChanges()`, `rebase()`, `rebaseOnto(upstream, opts?)`. When `track-changes` is off these are safe no-ops (`isDirty` is `false`, `getPatch()` returns `{}`, `rebaseOnto()` returns an empty result). See [Change tracking — parent template ref](/forms/change-tracking#parent-template-ref-the-defineexpose-surface).

**Emits**:

- `submit(data)` — validation passed, data ready to ship.
- `error(errors)` — validation failed; payload is `{ path, message }[]`.
- `action(name, data)` — phantom `<AsAction>` button dispatched.
- `unsupportedAction(name, data)` — action name not declared on the form's type.
- `change(type, path, value, data)` — granular per-field change; `type` is `TAsChangeType`.

**Slots**: `form.header`, `form.before`, `form.after`, `form.error`, `form.submit`, `form.footer`, `form.loading`. Every slot receives the unified `slotProps` bag (see [`useAsForm` return](#useasform-options)); `form.error` also gets `message` / `dismiss`, `form.submit` also gets `text`. See [Forms — Slots & the slotProps bag](/forms/customization#slots-the-slotprops-bag).

### `AsField`

Renders a single field given a `FormFieldDef`. Use when laying out form fields manually instead of letting `AsForm` iterate.

```typescript
interface AsFieldProps {
  field: FormFieldDef;
  /** External validation error to surface on this field. */
  error?: string;
  /** Wires the array-item remove affordance when rendered inside an array. */
  onRemove?: () => void;
  canRemove?: boolean;
  removeLabel?: string;
  /** Index of this field within a parent array — drives the `#N` suffix on labels. */
  arrayIndex?: number;
}
```

### `AsIterator`

Iterates the fields of a `FormDef` and renders each through `AsField`. Used by `AsObject` for nested objects and exposed for advanced compositions.

```typescript
interface AsIteratorProps {
  def: FormDef;
  /** Optional dotted segment to prepend to every child field's path. */
  pathPrefix?: string;
  /** Explicit field list to render — defaults to `def.fields`. Feed a precomputed partition so each field renders once. */
  fields?: FormFieldDef[];
  /**
   * Bump the nesting level for rendered children RELATIVE to the injected
   * parent level (sugar over `provideAsNestedLevel`). For custom container
   * panes standing in for a structured field's section chrome. Setup-time /
   * non-reactive — an identity of the pane, like `pathPrefix`. See
   * [Container renderers](/forms/custom-components#level-alternation).
   */
  levels?: number;
  onRemove?: () => void;
  canRemove?: boolean;
  removeLabel?: string;
}
```

### `AsCollapsible`

Section chrome with a collapsible `<summary>` header plus
`actions` / `badges` / `title-extras` / `body` / `empty` slots.
`AsObject` / `AsArray` / `AsTuple` render nested structures through it.
Public so a custom `@ui.form.component` can own its own section header and
inject header-row actions. See [Collapsible Sections](/forms/collapsible-sections)
for the narrative.

```typescript
interface AsCollapsibleProps {
  /** Header heading text. */
  title?: string;
  /** Sub-text under the title. */
  description?: string;
  /** REQUIRED. ≤0 → root (no chrome), odd → section, even → island. */
  level: number;
  /** When true and not enabled, the `empty` slot renders instead of the section. Default `false`. */
  optional?: boolean;
  /** Gates the `empty` slot — shown when `optional && !optionalEnabled`. Default `false`. */
  optionalEnabled?: boolean;
  /** Unique key registered with the sections store (expand/collapse + auto-open). */
  path: string;
  /** Renders an alert row at the top of the body. */
  error?: string;
  /** Open on first mount. Defaults to `false`. */
  defaultOpen?: boolean;
  /** Hides via `v-show` — stays mounted and registered. */
  hidden?: boolean;
  /** Appends a `#N` suffix to the title. */
  arrayIndex?: number;
}
```

**Slots**: `title-extras`, `badges`, `actions` (all render inside `<summary>`),
`body`, `empty`.

**Expose**: `runAndFocus(fn)` / `runAndFocusNew(fn)` — open-then-focus helpers
(focus first / first-new focusable inside after toggle). Used by array/optional
add-flows; rarely needed directly.

## Tier 2 — Default field components

Default swap targets for the `types` map. Importable both via the package root and the kebab subpath used by `AsResolver`.

```typescript
import { AsInput, AsSelect } from "@atscript/vue-form";
// or, for tree-shake-friendly single imports
import AsInput from "@atscript/vue-form/as-input";
```

Every component implements `TAsComponentProps`. The columns below list the `@ui.type` value that maps to each component in `createDefaultTypes()`.

| Component       | Default `type` keys            | Notes                                                                                                    |
| --------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `AsFieldShell`  | (all)                          | Chrome wrapper — title, description, error, hint, prefix/suffix. Used internally by every other default. |
| `AsInput`       | `text`, `textarea`, `password` | Plain string input.                                                                                      |
| `AsNumber`      | `number`                       | Integer input with prefix/suffix, currency-aware.                                                        |
| `AsDecimal`     | `decimal`                      | Decimal-string input with `precisionScale` enforcement.                                                  |
| `AsSelect`      | `select`                       | `<select>` element fed by `options` / value-help.                                                        |
| `AsRadio`       | `radio`                        | Radio group.                                                                                             |
| `AsCheckbox`    | `checkbox`                     | Boolean checkbox or tri-state.                                                                           |
| `AsMultiSelect` | `multiselect`                  | Multi-select combobox with chip-style selections, bound to `T[]`.                                        |
| `AsDate`        | `date`                         | Date-only input.                                                                                         |
| `AsDatetime`    | `datetime`                     | Date-time input.                                                                                         |
| `AsTime`        | `time`                         | Time-of-day input.                                                                                       |
| `AsParagraph`   | `paragraph`                    | Phantom read-only field; renders `value` as text.                                                        |
| `AsAction`      | `action`                       | Phantom button — emits `action`.                                                                         |
| `AsObject`      | `object`                       | Iterates over a nested object's fields.                                                                  |
| `AsArray`       | `array`                        | Renders array items with add/remove affordances.                                                         |
| `AsUnion`       | `union`                        | Variant picker + nested fields for the active branch.                                                    |
| `AsTuple`       | `tuple`                        | Positional fields, fixed length.                                                                         |
| `AsRef`         | `ref`                          | FK input with value-help dropdown.                                                                       |

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

### `createAsFormDef(type, context?)`

Builds a `FormDef` from an `.as` annotated type and a fresh reactive `formData` container with `@meta.default` values applied. When `context` is provided and `@atscript/ui-fns` is installed, `@ui.form.fn.value` annotations evaluate against it during default-value resolution.

```typescript
function createAsFormDef<T extends TAtscriptAnnotatedType>(
  type: T,
  context?: Record<string, unknown>,
): { def: FormDef; formData: { value: unknown } };
```

For tables that opt into optimistic concurrency, call the lower-level `createFormDef(type, { versionColumn })` from `@atscript/ui` directly so the version field is excluded from `def.fields[]` (it stays in `flatMap` and form data so the wire payload still carries it). See the [Edit forms with optimistic concurrency](/tables/edit-form-occ) pattern guide.

### `formatIndexedLabelParts(label, arrayIndex)`

Splits a label into base + optional `#N` suffix for two-part rendering by `AsCollapsible` / `AsFieldShell`. Returns `undefined` when both the base and suffix are absent.

```typescript
function formatIndexedLabelParts(
  label: string | undefined,
  arrayIndex: number | undefined,
): { base: string; suffix?: string } | undefined;
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
  /** Busy flag — locks the form and disables submit while a round-trip is in flight (used by `AsWfForm`). */
  loading?: () => boolean | undefined;
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
  /** Resolved form-level title (`@ui.form.fn.title` / `@meta.label`); may be `undefined`. */
  title: ComputedRef<string | undefined>;
  /** Resolved form-level description (`@ui.form.fn.description` / `@meta.description`). */
  description: ComputedRef<string | undefined>;
  /** Unified slot-props bag spread onto every `<AsForm>` slot via `v-bind`. */
  slotProps: ComputedRef<{
    title: string | undefined;
    description: string | undefined;
    data: TFormData;
    errors: Record<string, string | undefined> | undefined;
    formError: string | undefined;
    disabled: boolean;
    loading: boolean;
    submitText: string;
    submit: () => void;
    reset: () => Promise<void>;
    clearErrors: () => void;
    setErrors: (errors: Record<string, string>) => void;
    dismissError: (path: string) => void;
    dismissFormError: () => void;
    formContext: TFormContext | undefined;
  }>;
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

## Composables — change tracking

### `useAsFormPatch()`

Injects the change-tracking handle from any descendant of an `<AsForm track-changes>` — e.g. a Save button living in a toolbar or dialog rather than a form slot. **Throws a clear error** when called outside a form, or inside a form that did not enable `track-changes`, rather than silently reporting "not dirty". Requires `track-changes` on the form; see [Change tracking](/forms/change-tracking).

```typescript
function useAsFormPatch(): AsFormPatchHandle;
```

The returned `AsFormPatchHandle` is the same surface spread onto every `<AsForm>` slot and `defineExpose`d on the instance:

```typescript
interface AsFormPatchHandle {
  /** Reactive dirtiness — `true` when current data differs from the baseline (revert-aware). */
  isDirty: ComputedRef<boolean>;
  /** Reactive per-field change list (revert-aware). `before` / `after` hold live references. */
  changes: ComputedRef<FormFieldChange[]>;
  /**
   * Builds the `@atscript/db` patch on demand against the baseline. Safe at submit
   * time (snapshots a frozen, proxy-free copy). `{}` when nothing changed; carries
   * `$cas` when the form has a `@db.column.version` column and `opts.cas` is on.
   */
  getPatch: (opts?: FormDiffOptions) => Record<string, unknown>;
  /** Builds the per-field change list on demand (same data as `changes`). */
  getChanges: () => FormFieldChange[];
  /**
   * Per-field dirty predicate over the reactive change list — `true` when the
   * field at dot-path `path` differs from the baseline (recomputes live). `() => false`
   * when tracking is off. See [Change tracking — per-field dirty](/forms/change-tracking#marking-changed-fields-per-field-dirty).
   */
  isDirtyPath: (path: string) => boolean;
  /** Re-baseline to the current data — call after a successful save so the form becomes clean again. */
  rebase: () => void;
  /**
   * 3-way rebase onto a fresh upstream snapshot: sets the baseline to `upstream`
   * and rewrites the live form to `upstream` + the local diff reapplied on top
   * (untouched fields adopt upstream, local edits survive). `upstream` is the
   * WRAPPED `{ value }` container. `opts.conflict` resolves both-sides edits
   * (`'ours'` default keeps local, `'theirs'` takes upstream). No-op returning an
   * empty result when tracking is inactive. See [Change tracking — `rebaseOnto()`](/forms/change-tracking#folding-in-fresh-server-data-rebaseonto).
   */
  rebaseOnto: (upstream: Record<string, unknown>, opts?: FormRebaseOptions) => RebaseOntoResult;
}
```

### `RebaseOntoResult`

Return value of `AsFormPatchHandle.rebaseOnto()`. Aliases the `@atscript/ui` rebase shape minus `next` (which is written into the live container rather than returned).

```typescript
interface RebaseOntoResult {
  /** Paths changed on BOTH sides to different values, plus ancestor-clear paths. */
  conflicts: string[];
  /** Local edits that survive on top of the new (upstream) baseline — same data `getChanges()` returns after the rebase. */
  reapplied: FormFieldChange[];
}
```

`FormRebaseOptions` (`{ conflict?: 'ours' | 'theirs' }`) is re-exported from `@atscript/ui` — see [@atscript/ui — Form diff engine](/api/ui#form-diff-engine).

## Composables — field & structure

### `useAsField(opts)`

Field-level state machine — model wrapper, validator pipeline, error resolution, blur tracking, and registration with the parent form. Call from a custom field that owns its own commit path instead of routing through `AsField`.

```typescript
interface UseAsFieldOptions<TValue, TFormData, TContext> {
  getValue: () => TValue;
  setValue: (v: TValue) => void;
  rules?: TFormRule<TValue, TFormData, TContext>[];
  path: () => string;
  /** Value to set on form reset. Defaults to `''`. Use `[]` for arrays, `{}` for objects. */
  resetValue?: TValue;
}

interface UseAsFieldReturn<TValue> {
  model: WritableComputedRef<TValue>;
  error: ComputedRef<string | undefined>;
  onBlur: () => void;
  /**
   * Reactive "changed-since-baseline" flag for THIS field — `true` when the form
   * has `track-changes` on AND the field at `opts.path()` differs from the
   * baseline. Always `false` when tracking is off (never throws). Bind it to mark
   * the field visually. See [Change tracking — per-field dirty](/forms/change-tracking#marking-changed-fields-per-field-dirty).
   */
  isDirty: ComputedRef<boolean>;
}

function useAsField<TValue, TFormData, TContext>(
  opts: UseAsFieldOptions<TValue, TFormData, TContext>,
): UseAsFieldReturn<TValue>;
```

### `useAsArray(field, disabled?)`

Powers `AsArray`. Manages stable item keys, add/remove respecting `@expect.minLength` / `@expect.maxLength`, and union-item variant resolution.

```typescript
function useAsArray(field: FormArrayFieldDef, disabled?: ComputedRef<boolean>): UseAsArrayReturn;

interface UseAsArrayReturn {
  arrayValue: ComputedRef<unknown[]>;
  itemKeys: string[];
  isUnion: boolean;
  unionVariants: FormUnionVariant[];
  isOptional: boolean;
  isEmpty: ComputedRef<boolean>;
  getItemField: (index: number, name?: string) => FormFieldDef;
  addItem: (variantIndex?: number) => void;
  removeItem: (index: number) => void;
  clear: () => void;
  canAdd: ComputedRef<boolean>;
  canRemove: ComputedRef<boolean>;
}
```

### `useAsTuple(field)`

Powers `AsTuple`. Fixed-length positional fields; auto-fills missing positions on mount unless the tuple is optional.

```typescript
function useAsTuple(field: FormTupleFieldDef): UseAsTupleReturn;

interface UseAsTupleReturn {
  itemFields: FormFieldDef[];
  positionLabeled: boolean[];
  isOptional: boolean;
  isEmpty: ComputedRef<boolean>;
  clear: () => void;
  fillMissing: () => void;
}
```

### `useAsUnion(props)`

Powers `AsUnion`. Owns the locally-selected variant index and stashes per-variant data so toggling back restores prior input. Pass the component's resolved `TAsComponentProps` (`AsUnion` reads `props.field` + `props.model`).

```typescript
function useAsUnion(props: TAsComponentProps): UseAsUnionReturn;

interface UseAsUnionReturn {
  unionField: ComputedRef<FormUnionFieldDef | undefined>;
  hasMultipleVariants: ComputedRef<boolean>;
  localUnionIndex: Ref<number>;
  innerField: ComputedRef<FormFieldDef | undefined>;
  changeVariant: (newIndex: number) => void;
  optionalEnabled: ComputedRef<boolean>;
}
```

### `useAsUnionVariant()`

Reads the current union context (`TAsUnionContext`) injected by the closest `AsUnion`. Returns `undefined` outside a union.

```typescript
function useAsUnionVariant(): TAsUnionContext | undefined;
```

## Composables — custom container renderers

Primitives for a custom `@ui.form.component` that **replaces a structured
(object) field's chrome** — a tabbed shell, side-nav, or wizard — and
re-renders the object's children itself. See [Container renderers](/forms/custom-components#container-renderers)
for the narrative and a worked example.

### `useAsLevel()`

Reactive read-only access to the structured-field nesting level at the current
point in the `<AsForm>` tree. `-1` outside any structured field; the root
structured field renders at `0`, its structured children at `1`, and so on.
Drives the section/island alternation (odd → section, even → island).

```typescript
function useAsLevel(): ComputedRef<number>;
```

### `provideAsNestedLevel(levels?)`

Bump the structured-field nesting level for the current Vue subtree,
**relative** to the injected parent level. Call it in a container renderer that
stands in for a structural section and mounts the children directly, so those
children resume the stock section/island alternation instead of landing a level
too shallow. `levels` is the number of section slots your chrome absorbs
(default `1`). Because the bump is relative, the same renderer stays correct at
any depth. `AsIterator`'s [`levels` prop](#asiterator) is sugar over this.

```typescript
function provideAsNestedLevel(levels?: number): void; // default 1
```

::: warning BREAKING
`provideAsNestedLevel` changed from **absolute** to **relative** semantics. It
now reads the injected parent level and provides `parent + levels`, where
`levels` defaults to `1`. A previous call site that hardcoded
`provideAsNestedLevel(1)` for a root-level container keeps identical behavior at
root **and** becomes correct when the container is nested (where the old
absolute value was wrong).
:::

### `useAsFieldScope()`

Child-field scope building + annotation resolution for a container renderer,
without mounting `<AsField>` per child. Returns plain (non-reactive) functions —
wrap calls in your own `computed` to inherit reactivity over form data.

```typescript
interface TResolveFieldPropOptions<T> extends TResolveOptions<T> {
  /** Layer the field's evaluated `entry` into the fn scope (display-style fns). */
  withEntry?: boolean;
}

interface UseAsFieldScopeReturn {
  /** Absolute dotted path of a child field (current prefix + `field.path`). */
  absolutePath: (field: FormFieldDef) => string;
  /** Fn scope `{ v, data, context }` with `v` at the child's absolute path; `withEntry` layers the evaluated field entry on top. */
  scopeFor: (field: FormFieldDef, opts?: { withEntry?: boolean }) => TFnScope;
  /**
   * Resolve a `fnKey`/`staticKey` annotation pair, presence-gated like AsField:
   * neither key present → `undefined` (no reactive read); only the static key →
   * resolved against a shared inert scope; the fn key present → resolved against
   * the full reactive scope. Resolving the `fn` key needs `installDynamicResolver()`
   * from `@atscript/ui-fns`.
   */
  resolveProp: <T>(
    field: FormFieldDef,
    fnKey?: string,
    staticKey?: string,
    opts?: TResolveFieldPropOptions<T>,
  ) => T | undefined;
}

function useAsFieldScope(): UseAsFieldScopeReturn;
```

`TResolveOptions` and `TFnScope` come from `@atscript/ui` and `@atscript/ui-fns`
respectively.

### `useAsOptionalField(field)`

Enable / clear an optional structured child — the same behavior `AsField` wires
onto its optional toggle, usable from your own chrome.

```typescript
interface UseAsOptionalFieldReturn {
  /** Whether the field is declared optional in its atscript type. */
  optional: boolean;
  /** Whether the optional field currently holds a value (`!= null`). */
  enabled: ComputedRef<boolean>;
  /** `true` → initialize with annotated defaults; `false` → clear to `undefined`. Emits the blur-committed `update` change. */
  toggle: (enabled: boolean) => void;
}

function useAsOptionalField(field: FormFieldDef): UseAsOptionalFieldReturn;
```

### `useAsVisibleFields(fields)`

Partition a field list down to the currently visible fields with AsField's exact
hidden semantics: static `@ui.form.hidden` hides unconditionally; dynamic
`@ui.form.fn.hidden` resolves against the field's live fn scope. Subscribes to
form data only when some field actually carries a `fn.hidden` key. `fields` is a
`MaybeRefOrGetter` — pass a getter to stay reactive. `fn.hidden` resolution
requires `installDynamicResolver()` from `@atscript/ui-fns`.

```typescript
function useAsVisibleFields(
  fields: MaybeRefOrGetter<FormFieldDef[] | undefined>,
): ComputedRef<FormFieldDef[]>;
```

## Composables — value help / dropdown

### `useAsValueHelp(options)`

Lazily resolves a `ValueHelpInfo` descriptor on mount, then exposes a debounced search API for FK pickers. Reads the active `ClientFactory` from the nearest `<AsForm :client-factory>` (or the global default) automatically.

```typescript
interface UseAsValueHelpOptions {
  /** Resolved value-help descriptor (read from `props.valueHelp`). */
  info: ValueHelpInfo;
  /** The model whose `.value` the picker writes to on select. */
  model: { value: unknown };
  /** Called after a selection commits so AsField can run blur-time validation. */
  onBlur: () => void;
}

interface UseAsValueHelpReturn {
  resolved: ShallowRef<ResolvedValueHelp | null>;
  status: Ref<"loading" | "ready" | "error">;
  searchText: Ref<string>;
  results: ShallowRef<Record<string, unknown>[]>;
  searching: Ref<boolean>;
  labelIsFkValue: ComputedRef<boolean>;
  kickoff: () => Promise<void>;
  selectItem: (item: Record<string, unknown>) => void;
  clear: () => void;
}

function useAsValueHelp(options: UseAsValueHelpOptions): UseAsValueHelpReturn;
```

### `useAsDropdown(containerRef)`

Click-outside-aware dropdown state. The listener is lazy — attached only while open.

```typescript
function useAsDropdown(containerRef: Ref<HTMLElement | null>): {
  isOpen: Ref<boolean>;
  toggle: () => void;
  close: () => void;
  /** Run the callback and close immediately — convenience for option-click handlers. */
  select: (callback: () => void) => void;
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

### `useAsLocale()` / `provideAsLocale(getter)`

Provide / inject the BCP-47 locale used by date and decimal composables. The getter shape lets reactive sources flow through without an extra `computed()` at the call site.

```typescript
function provideAsLocale(getter: () => string | undefined): void;

interface UseAsLocaleReturn {
  /** Resolved locale; `undefined` when no provider is mounted. */
  locale: ComputedRef<string | undefined>;
}

function useAsLocale(): UseAsLocaleReturn;
```

### `useAsPath()` / `useAsTypeMap()` / `useAsData()`

Read-only context wrappers. Useful in deeply nested custom components that need the current field path, the form's `:types` map, or reactive read access to form data.

```typescript
function useAsPath(): UseAsPathReturn; // { path: ComputedRef<string> }
function useAsTypeMap(): UseAsTypeMapReturn; // { types: ComputedRef<TAsTypeComponents> }

interface UseAsDataReturn {
  /** Domain data — the unwrapped inner value of the form's `{ value }` container. */
  rootData: ComputedRef<unknown>;
  /** Read the value at an absolute dotted path inside the form. */
  getValueAt: (path: string) => ComputedRef<unknown>;
  /** Read a sibling field relative to the current `useAsPath()` prefix. */
  siblingValue: <T = unknown>(name: string) => ComputedRef<T | undefined>;
}

function useAsData(): UseAsDataReturn;
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

### `useAsDescendantErrorCounts()`

Injects the same `Map<absolutePath, errorCount>` `AsObject` reads for its collapsed-section error badges — keyed by every dotted-path prefix that has at least one error at or below it. Read it from a custom section renderer (tabbed shell, side-nav) to badge your own chrome or jump to the first errored section. Returns `undefined` when no `AsForm` is in scope.

```typescript
function useAsDescendantErrorCounts(): ComputedRef<Map<string, number>> | undefined;
```

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

### `TAsCollapsibleProps`

Exported. Public props contract for the standalone [`AsCollapsible`](#ascollapsible)
section component — see that entry for the annotated interface.

### `TAsCollapsibleSlots`

Exported. Slot contract for `AsCollapsible`: `title-extras`, `badges`,
`actions`, `body`, `empty` — every header slot renders inside `<summary>`.

```typescript
interface TAsCollapsibleSlots {
  "title-extras"(): unknown;
  badges(): unknown;
  actions(): unknown;
  body(): unknown;
  empty(): unknown;
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

### `AsFormPatchHandle`

Return type of [`useAsFormPatch()`](#useasformpatch) — the change-tracking surface also spread onto every `<AsForm>` slot and `defineExpose`d on the instance. Documented inline with the composable above. See [Change tracking](/forms/change-tracking).

### Re-exports from `@atscript/ui`

`setDefaultClientFactory`, `getDefaultClientFactory`, `resetDefaultClientFactory`, `ClientFactory` — see [@atscript/ui — Client factory](/api/ui#client-factory).

`FormFieldChange`, `FormDiffOptions`, `FormRebaseOptions` — change-tracking value shapes, re-exported so `useAsFormPatch()` consumers can type holding variables, `getPatch` options, and `rebaseOnto` options without reaching into the transitive `@atscript/ui` dep. See [@atscript/ui — Form diff engine](/api/ui#form-diff-engine).

`joinPath`, `hasFieldMeta`, `isFieldHidden` — framework-agnostic path/metadata helpers re-exported so container-renderer code can join dotted paths and check hidden state alongside the container composables without a second import. See [@atscript/ui — Path utilities](/api/ui#path-utilities) and [Field resolver](/api/ui#field-resolver).

## Cross-links

- [Forms — Hello World](/forms/hello-world)
- [Forms — Annotations Reference](/forms/annotations)
- [Forms — Field Types & Type Map](/forms/field-types)
- [Forms — Validation](/forms/validation)
- [Forms — Change tracking](/forms/change-tracking)
- [Forms — Arrays](/forms/arrays), [Nested Objects](/forms/nested-objects), [Unions](/forms/unions), [Tuples](/forms/tuples)
- [Forms — Dynamic Fields](/forms/dynamic-fields)
- [Forms — Grid Layout](/forms/grid-layout)
- [Forms — Actions](/forms/actions)
- [Forms — References (FK)](/forms/references)
- [Forms — Three Levels of Override](/forms/customization), [Custom Components](/forms/custom-components), [Locale & Currency](/forms/locale)
- [@atscript/ui](/api/ui), [@atscript/ui-fns](/api/ui-fns)
