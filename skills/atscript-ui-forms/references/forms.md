# forms

`<AsForm>` / `<AsField>` / `<AsIterator>` API, the built-in type map, the atscript primitive → field-type mapping, and the three-layer validation pipeline.

## Contents

- [AsForm](#asform)
- [AsField](#asfield)
- [AsIterator](#asiterator)
- [Default type map](#default-type-map)
- [Atscript primitive → field type](#atscript-primitive--field-type)
- [Validation](#validation)
- [firstValidation strategies](#firstvalidation-strategies)
- [Fresh-fields suppression](#fresh-fields-suppression)
- [External errors](#external-errors)
- [Form-level submit validator](#form-level-submit-validator)

## AsForm

Root component. Renders an HTML `<form>`, owns the form-state machine, wires provide/inject for all descendants, and dispatches all emits.

### Props

| Prop              | Type                                  | Default        | Description                                                                                                           |
| ----------------- | ------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------- |
| `def`             | `FormDef`                             | —              | Required. The form definition.                                                                                        |
| `formData`        | `{ value: TFormData }`                | internal `{}`  | External wrapped container.                                                                                           |
| `formContext`     | `TFormContext`                        | `undefined`    | App-wide context for validators / dynamic fn scope.                                                                   |
| `types`           | `TAsTypeComponents`                   | —              | Required. Built-in renderer-id → component map.                                                                       |
| `components`      | `Record<string, Component>`           | `undefined`    | Custom-name → component map. Targeted by `@ui.form.component`.                                                        |
| `errors`          | `Record<string, string \| undefined>` | `undefined`    | Server errors keyed by absolute path; `__form` for top-level.                                                         |
| `firstValidation` | `TFormState['firstValidation']`       | `'on-change'`  | See [firstValidation strategies](#firstvalidation-strategies).                                                        |
| `hideRootTitle`   | `boolean`                             | `false`        | Suppress the root field's `@meta.label` heading.                                                                      |
| `hideSubmit`      | `boolean`                             | `false`        | Suppress the default submit button. Required because an empty `<template #form.submit />` does not suppress fallback. |
| `loading`         | `boolean`                             | `false`        | Apply `inert` to the body + paint a loading overlay.                                                                  |
| `clientFactory`   | `ClientFactory`                       | global default | Per-form factory for value-help HTTP clients.                                                                         |

### Emits

| Event                | Payload                                                                | When                                                         |
| -------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| `submit`             | `(data: TFormData)`                                                    | Form submitted; validation passed.                           |
| `error`              | `(errors: { path: string; message: string }[])`                        | Submit attempted; validation failed.                         |
| `action`             | `(name: string, data: TFormData)`                                      | A `@ui.form.action` button (or `@wf.action.withData`) fires. |
| `unsupported-action` | `(name: string, data: TFormData)`                                      | Action name dispatched but no field declares it.             |
| `change`             | `(type: TAsChangeType, path: string, value: unknown, data: TFormData)` | Leaf blur / array add+remove / union switch.                 |

### Slots

All slots receive submit-related scoped bindings (`clearErrors`, `reset`, `setErrors`, `disabled`, `formContext`).

| Slot           | When                                                                                                                   | Default                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `form.header`  | Above everything inside `<form>`. Use for breadcrumbs / page-level chrome.                                             | empty                                  |
| `form.before`  | Above `<AsField :field="def.rootField" />`.                                                                            | empty                                  |
| `form.after`   | Below the root field; above the error banner.                                                                          | empty                                  |
| `form.error`   | Form-level `__form` banner. Receives `{ message, dismiss }`.                                                           | Built-in `<div role="alert">`.         |
| `form.submit`  | Submit button. Receives `{ disabled, text, ... }`. **Empty slot does not suppress fallback** — use `hide-submit` prop. | Built-in `<button>` with `submitText`. |
| `form.footer`  | Below submit.                                                                                                          | empty                                  |
| `form.loading` | Inside the loading overlay (when `loading=true`).                                                                      | Spinner icon.                          |

## AsField

Renders one field — resolves all annotations, picks the component, manages model binding, and dispatches change/blur events.

### Props

| Prop          | Type           | Description                                                                          |
| ------------- | -------------- | ------------------------------------------------------------------------------------ |
| `field`       | `FormFieldDef` | Required. The field definition from `def.fields[i]` or `def.rootField`.              |
| `error`       | `string`       | Inline override (rare — server errors usually go through `:errors` on AsForm).       |
| `onRemove`    | `() => void`   | Remove-this-item callback. Set by `AsArray` when iterating items.                    |
| `canRemove`   | `boolean`      | Whether removal is allowed (respects `@expect.minLength`).                           |
| `removeLabel` | `string`       | Label for the remove affordance.                                                     |
| `arrayIndex`  | `number`       | Zero-based index when rendered as a direct array item; drives the `#N` label suffix. |

### Component resolution

```typescript
const resolvedComponent = computed<Component | undefined>(() => {
  if (componentName) return components?.value?.[componentName];
  const map = types?.value;
  if (!map) return undefined;
  return (
    (props.field.customType ? map[props.field.customType] : undefined) ?? map[props.field.type]
  );
});
```

Precedence:

1. `@ui.form.component 'name'` → `:components[name]`
2. `@ui.form.type 'id'` / `@ui.type 'id'` → `:types[customType]` (for structured kinds — primitives fold the override into `field.type` at create-def time)
3. Structural `field.type` → `:types[type]`

If no entry matches, AsField renders an inline diagnostic `[Label] No component for type "X" (component "Y" not supplied)`.

### What AsField provides downward

When the field is structured (object/array/tuple) or a union, AsField provides:

- `PATH_PREFIX_KEY` — the absolute path of this field, so children compute `parent.child.grandchild`.
- `LEVEL_KEY` — incremented nesting level (root structure = 0, each nested struct/array/union increments).

## AsIterator

Renders all fields of a definition. Used to splice in additional fields under a specific path prefix, or to render the root field list manually.

### Props

| Prop          | Type         | Description                                                                                                                                |
| ------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `def`         | `FormDef`    | Definition whose `.fields` to iterate.                                                                                                     |
| `pathPrefix`  | `string`     | Optional extra path segment to nest under (appended to the inherited `PATH_PREFIX_KEY`). Use when iterating a sub-def under a custom path. |
| `onRemove`    | `() => void` | Forwarded to every AsField.                                                                                                                |
| `canRemove`   | `boolean`    | Forwarded.                                                                                                                                 |
| `removeLabel` | `string`     | Forwarded.                                                                                                                                 |

```vue
<AsIterator :def="def" path-prefix="address" />
```

## Path helpers

Form data is wrapped: `formData = { value: domainData }`. `getByPath` / `setByPath` from `@atscript/ui` read or write a value at a dotted path (array indices are numeric segments — e.g. `contacts.0.email`). Use them when wiring custom side-channels (programmatic mutation, deep links) that need to touch one leaf without remounting the form.

```ts
import { getByPath, setByPath } from "@atscript/ui";

const current = getByPath(formData, "address.street"); // unwraps `.value` automatically
setByPath(formData, "contacts.0.email", "new@example.com");
```

`createFormValueResolver(data, context)` returns a `(prop, path) => unknown` resolver suited to `createFormData(type, resolver)` — it folds `@ui.form.fn.value` (when ui-fns is installed) and `@meta.default` so new wrappers start with their declared defaults.

## Default type map

`createDefaultTypes()` returns this map. Spread it to extend, override individual entries to swap built-ins.

| Renderer id | Component     | Used for                                                                    |
| ----------- | ------------- | --------------------------------------------------------------------------- |
| `text`      | `AsInput`     | `<input type="text">` (default for `string`)                                |
| `textarea`  | `AsInput`     | `<textarea>` — set via `@ui.form.type 'textarea'`                           |
| `password`  | `AsInput`     | `<input type="password">` — set via `@ui.form.type 'password'`              |
| `number`    | `AsNumber`    | Integer / non-decimal numbers                                               |
| `decimal`   | `AsDecimal`   | Decimal numbers (`@db.amount.currency`, `@db.column.precision`, `@db.unit`) |
| `select`    | `AsSelect`    | `@expect.values [...]` or explicit `@ui.form.type 'select'`                 |
| `radio`     | `AsRadio`     | `@ui.form.type 'radio'`                                                     |
| `checkbox`  | `AsCheckbox`  | `boolean` (tri-state via `useAsTriStateCheckbox`)                           |
| `paragraph` | `AsParagraph` | Read-only display (`@ui.form.type 'paragraph'`)                             |
| `action`    | `AsAction`    | Phantom action button (`@ui.form.action 'id', 'label'`)                     |
| `object`    | `AsObject`    | Nested structures                                                           |
| `array`     | `AsArray`     | `T[]`                                                                       |
| `union`     | `AsUnion`     | `A \| B`                                                                    |
| `tuple`     | `AsTuple`     | `[A, B]`                                                                    |
| `ref`       | `AsRef`       | FK with `@db.rel.FK` + `@db.http.path`                                      |
| `date`      | `AsDate`      | `Date` storage                                                              |
| `datetime`  | `AsDatetime`  | `Date` with time (`@ui.form.type 'datetime'`)                               |
| `time`      | `AsTime`      | `HH:mm` (`@ui.form.type 'time'`)                                            |

## Atscript primitive → field type

| `.as` shape           | `field.type` | Default component | Notes                                                              |
| --------------------- | ------------ | ----------------- | ------------------------------------------------------------------ |
| `string`              | `text`       | `AsInput`         | Set `@ui.form.type 'textarea'` / `'password'` to swap renderer id. |
| `string.email`        | `text`       | `AsInput`         | `@expect.email` baked in via the atscript primitive.               |
| `number`              | `number`     | `AsNumber`        | `@db.column.precision` switches to `decimal` if present.           |
| `boolean`             | `checkbox`   | `AsCheckbox`      | Optional `boolean` → tri-state (true/false/undefined).             |
| `Date`                | `date`       | `AsDate`          | Use `@ui.form.type 'datetime'` / `'time'` for finer granularity.   |
| `T[]`                 | `array`      | `AsArray`         | `T` can be primitive, object, union, tuple.                        |
| `[A, B]`              | `tuple`      | `AsTuple`         | Fixed-length positional.                                           |
| `A \| B`              | `union`      | `AsUnion`         | Discriminated by required-prop fingerprint.                        |
| `interface { ... }`   | `object`     | `AsObject`        | Renders flat at root; collapsible when nested.                     |
| FK ref (`@db.rel.FK`) | `ref`        | `AsRef`           | Requires `@db.http.path` on the target type.                       |

A field carrying `@ui.form.type 'X'` forces `:types['X']` to render it (or `:components['Y']` via `@ui.form.component 'Y'`).

## Validation

Three layers, run in order on submit. Live (pre-submit) validation runs only the same checks per `firstValidation` policy.

| Layer                       | Source                                       | Runs at                                                                                                                                         |
| --------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `@expect.*` rules           | Atscript Validator (`getFormValidator(def)`) | Submit + live (when active). Built-in rules: `email`, `int`, `minLength`, `maxLength`, `minValue`, `maxValue`, `pattern`, `notEmpty`, `values`. |
| `@meta.required`            | Implicit non-empty check                     | Same as above. Renders the `*` marker.                                                                                                          |
| `@ui.form.validate '(...)'` | Custom validator strings (requires ui-fns)   | Same as above. Receives `TFnScope` with `v`/`data`/`context`/`entry`.                                                                           |

`@expect.*` rules live in the atscript skill — see `expect.md` there for the catalog.

Custom validator example (requires `installDynamicResolver()` from `@atscript/ui-fns`):

```atscript
@ui.form.validate '(v, data) => v.length > 500 ? "Too long" : true'
message: string
```

The `errorLimit` for the form-level validator is set to `MAX_SAFE_INTEGER` so descendant-count badges on collapsed objects reflect every nested error.

## firstValidation strategies

Field-level live validation is gated until one of these conditions matches. Once the first submit happens, every field is "active" regardless.

| Strategy            | Live validation activates when…                                                 |
| ------------------- | ------------------------------------------------------------------------------- |
| `'on-change'`       | First submit happened **or** the field's model has changed (touched). (default) |
| `'touched-on-blur'` | First submit happened **or** (blur happened AND touched).                       |
| `'on-blur'`         | First submit happened **or** blur happened.                                     |
| `'on-submit'`       | First submit happened. Live updates never run before then.                      |
| `'none'`            | Disable live validation entirely. Submit also skips per-field iteration.        |

## Fresh-fields suppression

A field that registers AFTER the first submit (e.g. newly-added array item) is marked "fresh". Live validation is suppressed for it until either:

- The user types into it (model watcher removes it from `freshFields`).
- The user tabs past it (`onBlur` removes it from `freshFields`).
- The next submit fires (entire set is cleared).

Without this, an array item with a `@meta.required` field would render with a red error the moment it mounts.

## External errors

Pass server-supplied errors keyed by absolute dotted path:

```vue
<AsForm
  :def="def"
  :form-data="formData"
  :types="types"
  :errors="{
    name: 'Already taken',
    'address.street': 'Missing house number',
    __form: 'Server is down — try again later',
  }"
/>
```

- Each leaf error renders next to its field.
- `__form` is reserved — it renders in the form-level banner slot (or default `<div role="alert">`), and never shows up at a leaf path.
- A leaf error is **dismissed locally** when the user edits that field (model watcher in AsField). The dismissal is in-component state — it resets when a fresh `:errors` object reference arrives.
- Dismissals do NOT reset on in-place mutation of the same errors object — only on identity change. Treat `errors` as immutable per server response.

Imperative dismissal from inside a custom component:

```vue
<script setup lang="ts">
import { useAsErrorDismiss } from "@atscript/vue-form";
const dismissAt = useAsErrorDismiss();
function pickDate(...) {
  // ...commit value via side channel...
  dismissAt(path);   // hide the server's error for this path
}
</script>
```

## Form-level submit validator

`useAsForm` accepts a `submitValidator` indirectly via `useAsState`. The default form validator runs atscript's `getFormValidator(def)` over the entire data tree on submit. To replace it with a custom check, drop down to `useAsState`:

```typescript
import { useAsState } from "@atscript/vue-form";

const { submit, clearErrors, reset, setErrors } = useAsState({
  formData,
  formContext,
  firstValidation: ref("on-change"),
  submitValidator: () => {
    const errors: Record<string, string> = {};
    if (data.value.password !== data.value.passwordConfirm) {
      errors["passwordConfirm"] = "Passwords don't match";
    }
    return errors; // empty = passed
  },
});
```

`submitValidator` is called with no args; it returns `Record<path, message>` (empty = passed). The composable also calls `setErrors(errors)` so per-field state stays in sync. The validator is responsible for reading data from its closure.

## reset / clearErrors / setErrors

Available on the return value of `useAsForm` AND scoped on all `<AsForm>` slots:

| Helper           | Effect                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `reset()`        | Run every registered field's `reset()` callback (re-applies defaults), then `clearErrors()`. Async — awaits `nextTick`. |
| `clearErrors()`  | Reset `firstSubmitHappened`, clear `freshFields`, clear external and submit errors on every registered field.           |
| `setErrors(map)` | Push `map` into per-field `externalError` state. Each field reads `map[path]` keyed on its absolute path.               |

`useAsForm` additionally exposes `internalErrors: Ref<Record<string, string>>` — the most-recent submit's validator output, merged with `:errors` to drive descendant error-count badges on collapsed objects.
