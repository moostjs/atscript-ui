# customization

Four levels of customization, the `TAsComponentProps` contract for custom components, every composable available inside a swap component, and locale / currency / unit wiring.

## Contents

- [The two prop maps](#the-two-prop-maps)
- [Level 1 — Global type swap (built-in ids)](#level-1--global-type-swap-built-in-ids)
- [Level 2 — Per-field named component](#level-2--per-field-named-component)
- [Level 3 — Wrap with AsFieldShell](#level-3--wrap-with-asfieldshell)
- [Level 4 — Fully custom root](#level-4--fully-custom-root)
- [AsForm slot-props bag](#asform-slot-props-bag)
- [TAsComponentProps contract](#tascomponentprops-contract)
- [TAsComponentEmits](#tascomponentemits)
- [Custom component skeleton](#custom-component-skeleton)
- [Composables for custom components](#composables-for-custom-components)
- [Container renderers (custom section shells)](#container-renderers-custom-section-shells)
- [Grid layout](#grid-layout)
- [Locale & currency](#locale--currency)

## The two prop maps

`<AsForm>` accepts two maps:

| Prop          | Type                        | Keys                                          | Purpose                                                       |
| ------------- | --------------------------- | --------------------------------------------- | ------------------------------------------------------------- |
| `:types`      | `TAsTypeComponents`         | Built-in renderer ids (`text`, `select`, ...) | Replace the default component for every field of that type.   |
| `:components` | `Record<string, Component>` | Arbitrary custom names                        | Targeted by `@ui.form.component 'name'` on individual fields. |

API contract:

- **`:types` accepts built-in renderer ids only.** The reserved ids are `text`, `select`, `radio`, `checkbox`, `paragraph`, `action`, `object`, `array`, `union`, `tuple`, `ref`, `number`, `decimal`, `date`, `datetime`, `time`, plus textarea/password aliases. Putting a custom name here won't be matched by AsField's resolver.
- **Custom widgets go through `:components`** + `@ui.form.component 'name'`.

Resolution order at AsField:

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

1. `@ui.form.component 'name'` → `:components[name]`. Wins regardless of type.
2. `@ui.form.type 'X'` (structured kinds — `customType`) → `:types[X]`.
3. Structural `field.type` → `:types[type]`.

For primitive fields, `@ui.form.type 'textarea'` folds the override into `field.type` directly at create-def time, so the existing single-key `:types[type]` lookup still matches.

## Level 1 — Global type swap (built-in ids)

Replace every text input across the form:

```vue
<script setup lang="ts">
import { AsForm, createAsFormDef, createDefaultTypes } from "@atscript/vue-form";
import { MyDesignSystemInput } from "@/components/my-input.vue";
import { Contact } from "./contact.as";

const { def, formData } = createAsFormDef(Contact);
const types = {
  ...createDefaultTypes(),
  text: MyDesignSystemInput,
  textarea: MyDesignSystemInput,
  password: MyDesignSystemInput,
};
</script>

<template>
  <AsForm :def="def" :form-data="formData" :types="types" />
</template>
```

`MyDesignSystemInput` must accept `TAsComponentProps`. See [skeleton below](#custom-component-skeleton).

## Level 2 — Per-field named component

For one-off custom renderers (star rating, color picker, signature pad):

```atscript
@meta.label 'Rating'
@ui.form.component 'stars'
rating: number
```

```vue
<script setup lang="ts">
import { AsForm, createAsFormDef, createDefaultTypes } from "@atscript/vue-form";
import { StarRating } from "@/components/star-rating.vue";
import { Review } from "./review.as";

const { def, formData } = createAsFormDef(Review);
const types = createDefaultTypes();
const components = { stars: StarRating };
</script>

<template>
  <AsForm :def="def" :form-data="formData" :types="types" :components="components" />
</template>
```

`@ui.form.component` is the mechanism for custom renderer names; the resolver looks `stars` up in `:components`, not `:types`.

## Level 3 — Wrap with AsFieldShell

Re-use the default label / description / hint / error / optional-clear chrome:

```vue
<script setup lang="ts">
import { AsFieldShell } from "@atscript/vue-form";
import type { TAsComponentProps } from "@atscript/vue-form";

defineProps<TAsComponentProps<number>>();
</script>

<template>
  <AsFieldShell v-bind="$props">
    <template #default="{ inputId }">
      <!-- Your custom control. Bind `:id="inputId"` so the shell label points at it. -->
      <input
        :id="inputId"
        type="range"
        :value="model.value"
        @input="model.value = +($event.target as HTMLInputElement).value"
        @blur="onBlur"
      />
    </template>
  </AsFieldShell>
</template>
```

`AsFieldShell` props (extends `TAsComponentProps`):

| Prop                   | Purpose                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `fieldClass`           | Extra CSS class on the wrapper element.                                                                    |
| `chromeless`           | Hide all default chrome (label, description, optional clear). Inline-header fields like checkbox use this. |
| `hideEmptyPlaceholder` | Skip the empty-state placeholder when the optional field is unset (e.g. radio group).                      |

Slot `#header` overrides the default label + actions row. Slot `#default` receives `{ inputId, descId, optionalEnabled }`.

## Level 4 — Fully custom root

Drop `<AsForm>` entirely; render the field tree yourself with `useAsForm`:

```vue
<script setup lang="ts">
import { useAsForm, AsField, createDefaultTypes } from "@atscript/vue-form";
import { Contact } from "./contact.as";
import { createFormDef } from "@atscript/ui";

const props = defineProps<{ initial?: Contact }>();
const def = createFormDef(Contact);
const types = createDefaultTypes();

const form = useAsForm<Contact>({
  def: () => def,
  formData: () => ({ value: props.initial ?? {} }),
  types: () => types,
  emits: {
    submit: (data) => alert(JSON.stringify(data)),
  },
});
</script>

<template>
  <form @submit.prevent="form.onSubmit">
    <h1>Contact</h1>
    <AsField :field="def.rootField" />
    <div v-if="form.formError.value">{{ form.formError.value }}</div>
    <button :disabled="form.submitDisabled.value">{{ form.submitText.value }}</button>
  </form>
</template>
```

`useAsForm` MUST be called from `<script setup>` of a component (it issues `provide()` calls). Its return is shaped to back the `<AsForm>` template; reach for it only when you need a non-form root element or radically different layout.

`createFormDef(type, { versionColumn })` — pass the second argument when consuming meta from an OCC-protected table (`@db.column.version`). The version column is excluded from `fields[]` so renderers don't paint it as an input, but stays in `flatMap` + form data so the wire payload preserves it for the server's `$cas` lift. See the OCC edit pattern in [`atscript-ui-forms/SKILL.md`](../SKILL.md) and the `atscript-db` skill's OCC reference.

## AsForm slot-props bag

`useAsForm` returns a `slotProps` bag (a `ComputedRef`) that `<AsForm>` spreads onto **every** slot. Reach for it when overriding a form slot (custom header, error banner, submit button) or when building a fully custom root with `useAsForm` — read keys off the bag instead of re-deriving form state.

Bag keys (don't paste the TS type — read them off `slotProps`):

| Key                | What it is                                                                     |
| ------------------ | ------------------------------------------------------------------------------ |
| `title`            | Resolved root `@meta.label` heading (`undefined` when suppressed).             |
| `description`      | Resolved root description.                                                     |
| `data`             | Current unwrapped domain data (`TFormData`).                                   |
| `errors`           | External-errors map keyed by absolute path (`undefined` when none).            |
| `formError`        | Resolved `__form` banner message (`undefined` when none).                      |
| `disabled`         | Submit-disabled state (validation / `@ui.form.fn.submitDisabled` / `loading`). |
| `loading`          | `true` when the `loading` prop is set (overlay shown).                         |
| `submitText`       | Resolved submit-button label (`@ui.form.submit.text` / fn).                    |
| `submit`           | `() => void` — trigger submit.                                                 |
| `reset`            | `() => Promise<void>` — re-apply defaults + clear errors.                      |
| `clearErrors`      | `() => void`.                                                                  |
| `setErrors`        | `(errors: Record<string, string>) => void`.                                    |
| `dismissError`     | `(path: string) => void` — dismiss one leaf error.                             |
| `dismissFormError` | `() => void` — dismiss the `__form` banner.                                    |
| `formContext`      | The provided `formContext` (or `undefined`).                                   |

Per-slot extras layered on top of the bag:

| Slot                                                                          | Bag + extras               |
| ----------------------------------------------------------------------------- | -------------------------- |
| `form.header` / `form.before` / `form.after` / `form.footer` / `form.loading` | bag (no extras)            |
| `form.error`                                                                  | bag + `message`, `dismiss` |
| `form.submit`                                                                 | bag + `text`               |

Hide props (booleans on `<AsForm>`): `hideRootTitle`, `hideSubmit`, `loading`.

> **`hideRootTitle` hides the root TITLE only** — the root `@meta.description` still renders. No prop hides both; use the `form.header` slot for a fully custom header.

> **Empty slot ≠ hidden.** `<template #form.submit />` is read by Vue as "slot provided" and _suppresses the default submit button without rendering anything_. To hide the submit, use `hide-submit`; to hide the root title, use `hide-root-title`. Never blank a slot to hide its default.

## TAsComponentProps contract

Implement this interface in your custom component (or use it via `defineProps<TAsComponentProps>()`).

```typescript
export interface TAsComponentProps<V = unknown> extends TAsBaseComponentProps { ... }
```

| Prop               | Type                                | Source                                                                                                                                                                                                                                |
| ------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model`            | `{ value: V }`                      | Reactive wrapper. Bind `v-model="model.value"`.                                                                                                                                                                                       |
| `value`            | `unknown`                           | Phantom field display value (`@meta.default` / `@ui.form.fn.value`). `undefined` for data fields.                                                                                                                                     |
| `label`            | `string`                            | `@meta.label` or `@ui.form.fn.label`.                                                                                                                                                                                                 |
| `description`      | `string`                            | `@meta.description` or `@ui.form.fn.description`.                                                                                                                                                                                     |
| `hint`             | `string`                            | `@ui.form.hint` or `@ui.form.fn.hint`.                                                                                                                                                                                                |
| `placeholder`      | `string`                            | `@ui.form.placeholder` or `@ui.form.fn.placeholder`.                                                                                                                                                                                  |
| `disabled`         | `boolean`                           | `@ui.form.disabled` or `@ui.form.fn.disabled`.                                                                                                                                                                                        |
| `hidden`           | `boolean`                           | `@ui.form.hidden` or `@ui.form.fn.hidden`. AsField passes through `v-show`; some defaults also honor it.                                                                                                                              |
| `readonly`         | `boolean`                           | `@meta.readonly` or `@ui.form.fn.readonly`.                                                                                                                                                                                           |
| `required`         | `boolean`                           | `true` when `@meta.required` is present and field is not optional. `undefined` for phantom (action/paragraph).                                                                                                                        |
| `optional`         | `boolean`                           | `true` when the field is declared `optional?`.                                                                                                                                                                                        |
| `onToggleOptional` | `(enabled: boolean) => void`        | Present only when `optional === true`. `true` → set default; `false` → set `undefined`.                                                                                                                                               |
| `error`            | `string`                            | Merged external + props + form-composable error.                                                                                                                                                                                      |
| `onBlur`           | `() => void`                        | Activates `firstValidation` on-blur strategies + dismisses external error.                                                                                                                                                            |
| `type`             | `string`                            | Resolved input type (e.g. `'text'`, `'select'`, `'checkbox'`).                                                                                                                                                                        |
| `field`            | `FormFieldDef`                      | Full field def — escape hatch when you need metadata that isn't pre-resolved.                                                                                                                                                         |
| `formAction`       | `TFormAction`                       | `{ id, label }` for phantom action buttons. Set via `@ui.form.action 'id', 'label'`.                                                                                                                                                  |
| `name`             | `string`                            | Last path segment.                                                                                                                                                                                                                    |
| `options`          | `TFormEntryOptions[]`               | For select/radio/checkbox. Resolved from `@expect.values` / `@ui.form.options` / `@ui.form.fn.options`.                                                                                                                               |
| `class`            | `Record<string, boolean> \| string` | **Declared prop, not a fall-through attr.** Carries the grid footprint (`@ui.form.grid.colSpan`/`.rowSpan`) + `@ui.form.classes`. A bare root must bind `:class="props.class"` or the spans are silently dropped — see callout below. |
| `style`            | `Record<string, string> \| string`  | From `@ui.form.styles` / `@ui.form.fn.styles`. Like `class`, a bare root must bind `:style="props.style"` (AsFieldShell does it for you).                                                                                             |
| `path`             | `string`                            | Absolute dotted path. Empty string at root.                                                                                                                                                                                           |
| `level`            | `number`                            | Nesting level (0 = root structured; -1 = leaf). Set on structured/union fields only.                                                                                                                                                  |
| `inputId`          | `string`                            | Stable id for `<input>` / `<label :for>`. Always populated.                                                                                                                                                                           |
| `errorId`          | `string`                            | Stable id for error/hint container.                                                                                                                                                                                                   |
| `descId`           | `string`                            | Stable id for description container.                                                                                                                                                                                                  |
| `ariaDescribedBy`  | `string`                            | Pre-resolved — `errorId` when error/hint present, else `descId`, else `undefined`.                                                                                                                                                    |
| `maxLength`        | `number`                            | `@expect.maxLength`.                                                                                                                                                                                                                  |
| `autocomplete`     | `string`                            | `@ui.form.autocomplete`.                                                                                                                                                                                                              |
| `prefixIcon`       | `string`                            | CSS class to paint the left adornment glyph.                                                                                                                                                                                          |
| `suffixIcon`       | `string`                            | CSS class to paint the right adornment glyph.                                                                                                                                                                                         |
| `prefix`           | `string`                            | Resolved left adornment text (currency symbol / `@ui.form.prefix` / `@ui.form.prefix.ref`).                                                                                                                                           |
| `suffix`           | `string`                            | Resolved right adornment text (`@db.unit` / `@ui.form.suffix` / `@ui.form.suffix.ref`).                                                                                                                                               |
| `currencyCode`     | `string`                            | Resolved currency code (`@db.amount.currency` literal or `.ref`). Useful for tooltips.                                                                                                                                                |
| `unitCode`         | `string`                            | Resolved unit-of-measure code (`@db.unit` / `.ref`).                                                                                                                                                                                  |
| `scale`            | `number`                            | Effective display scale (`min(currencyDecimals, precisionScale)`).                                                                                                                                                                    |
| `precisionScale`   | `number`                            | DB column scale cap (`@db.column.precision`).                                                                                                                                                                                         |
| `hasAdornment`     | `boolean`                           | `true` when AsField saw any adornment-driving annotation. Keeps shell visible while ref-source is empty.                                                                                                                              |
| `valueHelp`        | `ValueHelpInfo`                     | FK value-help descriptor (`@db.rel.FK` + `@db.http.path`).                                                                                                                                                                            |
| `singularLabel`    | `string`                            | `@ui.form.label.singular` — drives "Add X" buttons in arrays.                                                                                                                                                                         |
| `arrayIndex`       | `number`                            | Zero-based index when rendered as a direct array item.                                                                                                                                                                                |
| `onRemove`         | `() => void`                        | Remove-this-item callback (array context).                                                                                                                                                                                            |
| `canRemove`        | `boolean`                           | Whether removal is allowed (respects `@expect.minLength`).                                                                                                                                                                            |
| `removeLabel`      | `string`                            | Label for the remove affordance.                                                                                                                                                                                                      |
| `title`            | `string`                            | For structured fields (object/array/union) — title in the collapsible header.                                                                                                                                                         |

> **`class` and `style` are declared props — a bare root must apply them.** Because they're declared on `TAsComponentProps`, Vue routes them to `props.class` / `props.style`, **not** `$attrs`, and does **not** auto-apply them to your component's root element. `AsFieldShell` — and the built-ins, which forward `$props` to it — binds `$props.class` for you, so any component rendered through the shell gets its grid placement automatically. A component with a **bare root** (no `AsFieldShell`) must bind them itself:
>
> ```vue
> <div class="…your styles…" :class="props.class" :style="props.style">
> ```
>
> Omit `:class="props.class"` and the field silently falls back to the default single-column grid slot: `@ui.form.grid.colSpan` / `.rowSpan` (and `@ui.form.classes`) appear ignored even though `AsField` computed them correctly. This is the most common reason a custom widget renders at the wrong width. Binding it is sufficient at every span — the default full-width placement and any `colSpan` / `rowSpan` override both ride on `props.class`, so you never add `as-grid-item` or `col-span-*` to the root yourself.

## TAsComponentEmits

```typescript
export interface TAsComponentEmits<_V = unknown> {
  (e: "action", name: string): void;
}
```

Only emit `action` from phantom buttons. `<AsField>` listens for it and routes through the form's action handler:

```vue
<button @click="emit('action', formAction!.id)">{{ formAction!.label }}</button>
```

## Custom component skeleton

```vue
<script setup lang="ts">
import { AsFieldShell } from "@atscript/vue-form";
import type { TAsComponentProps, TAsComponentEmits } from "@atscript/vue-form";

const props = defineProps<TAsComponentProps<number>>();
defineEmits<TAsComponentEmits<number>>();
</script>

<template>
  <AsFieldShell v-bind="$props">
    <template #default="{ inputId }">
      <input
        :id="inputId"
        :value="props.model.value"
        :placeholder="props.placeholder"
        :disabled="props.disabled"
        :readonly="props.readonly"
        :required="props.required"
        :aria-describedby="props.ariaDescribedBy"
        @input="props.model.value = +($event.target as HTMLInputElement).value"
        @blur="props.onBlur"
      />
    </template>
  </AsFieldShell>
</template>
```

Notes:

- Mutate `model.value`, not `props.model` (the wrapper is stable, the inner value is reactive).
- Wire `aria-describedby="ariaDescribedBy"` so screen readers reach the error/hint/description container set up by `AsFieldShell`.
- `inputId` / `descId` / `errorId` are pre-resolved on the props — AsFieldShell defaults use them, custom components should too.

## Custom field-level rules from inside a component

`useAsField` is safe to call from any custom field component rendered as
a descendant of `<AsForm>` — even one that already lives under an
`<AsField>` parent. Field-state registrations are keyed by symbol, so
multiple registrations at the same path coexist; every registered rule
runs at submit. Use this when a component owns a constraint that can't
be expressed as a single `@ui.form.validate` expression on the schema
(e.g. an array field whose items each carry their own per-item required
flag):

```ts
import { useAsField } from "@atscript/vue-form";

const { error, onBlur } = useAsField<string[]>({
  getValue: () => props.model.value ?? [],
  setValue: (v) => {
    props.model.value = v;
  },
  rules: [
    (value) => {
      for (const item of items.value) {
        if (item.required && !value.includes(item.id)) return item.required;
      }
      return true;
    },
  ],
  path: () => props.path,
  resetValue: [],
});
```

## Re-using the ui-fns compiler from a custom component

When a custom component receives an array of policy / rule objects via
`@ui.form.fn.attr` (i.e. the consumer supplies `{ rule: string, ... }[]`
where `rule` is itself a function string), evaluate those strings
through the same compiler the framework uses — don't allocate a new
`FNPool` or hand-roll `new Function`. `compileFieldFn` from
`@atscript/ui-fns` honors the shared cache and security model:

```ts
import { compileFieldFn } from "@atscript/ui-fns";

function evalRule(rule: string, value: string): boolean {
  return !!compileFieldFn<boolean>(rule)({
    v: value,
    data: {},
    context: {},
    entry: undefined,
  });
}
```

The scope object must include every key the compiled body references —
the compiler wraps the call in a `with()` block, so missing keys throw a
`ReferenceError` at evaluation time. Pass `entry: undefined` even when
the rule body doesn't read it.

## Composables for custom components

Available from `@atscript/vue-form`:

| Composable                    | Returns                                                                                                                    | Use case                                                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `useAsField(opts)`            | `{ model, error, onBlur }`                                                                                                 | Build a field that isn't backed by an AsField parent.                                                                              |
| `useAsForm(opts)`             | Full form state (see [forms.md](forms.md))                                                                                 | Custom form root.                                                                                                                  |
| `useAsState(opts)`            | `{ formState, clearErrors, reset, submit, setErrors }`                                                                     | Low-level form-state machine without provide/inject.                                                                               |
| `useAsPath()`                 | `{ path: ComputedRef<string> }`                                                                                            | Read absolute path prefix without other context.                                                                                   |
| `useAsTypeMap()`              | `{ types: ComputedRef<Record<string, Component>> }`                                                                        | Read the form's `:types` map (for components that compose).                                                                        |
| `useAsData()`                 | `{ rootData, getValueAt, siblingValue }`                                                                                   | Reactive read of any value in the form, by path or sibling name.                                                                   |
| `useAsLocale()`               | `{ locale: ComputedRef<string \| undefined> }`                                                                             | Read provided locale for formatting.                                                                                               |
| `useAsErrorDismiss()`         | `(path: string) => void`                                                                                                   | Dismiss a server error from a custom commit path.                                                                                  |
| `useAsValueHelp(opts)`        | FK picker state (resolved, status, searchText, results, kickoff, selectItem, clear)                                        | Build a custom FK picker.                                                                                                          |
| `useAsDropdown(containerRef)` | `{ isOpen, toggle, close, select }`                                                                                        | Click-outside-aware dropdown state.                                                                                                |
| `useAsOptionalAddFlow(opts)`  | `{ composeAction, runAndFocusNew }`                                                                                        | Choreograph "enable optional + add + focus first new field".                                                                       |
| `useAsTriStateCheckbox(opts)` | `{ checked, indeterminate, inputRef, onChange }`                                                                           | Boolean field whose model may be `undefined`.                                                                                      |
| `useAsDate(opts)`             | `{ inputType, displayValue, setFromInput }`                                                                                | HTML5 date / datetime / time mechanics.                                                                                            |
| `useAsNumber(opts)`           | `{ decimalSeparator, displayValue, rawValue, setFromInput }`                                                               | Locale-aware single-input number control.                                                                                          |
| `useAsDecimal(opts)`          | `{ scale, storageScale, decimalSeparator, thousandsSeparator, displayValue, rawValue, parts, setFromInput, setFromParts }` | Decimal mechanics with scale + currency awareness.                                                                                 |
| `useAsDualInput(opts)`        | Integer/decimal half input refs + handlers                                                                                 | Bank-UX two-input pattern (integer + decimal halves).                                                                              |
| `useAsExternalErrors(opts)`   | `{ effective, formError, isFormDismissed, dismissAt, dismissForm, reset }`                                                 | Manage server errors with local dismissal (used internally by useAsForm).                                                          |
| `useAsNestedSectionsStore()`  | `AsNestedSectionsStore \| undefined`                                                                                       | Read the open/closed registry for collapsible sections.                                                                            |
| `useAsUnionVariant()`         | `TAsUnionContext \| undefined`                                                                                             | Consume and clear the union variant picker injection inside a custom variant renderer.                                             |
| `useAsVisibleFields(fields)`  | `ComputedRef<FormFieldDef[]>`                                                                                              | [Container renderer](#container-renderers-custom-section-shells): partition out hidden children (`@ui.form.hidden` + `fn.hidden`). |
| `useAsFieldScope()`           | `{ absolutePath, scopeFor, resolveProp }`                                                                                  | Container renderer: child path + custom-annotation resolution (static + `fn`).                                                     |
| `useAsOptionalField(field)`   | `{ optional, enabled, toggle }`                                                                                            | Container renderer: enable/clear an optional object child.                                                                         |
| `useAsLevel()`                | `ComputedRef<number>`                                                                                                      | Read structured-field nesting level (odd=section / even=island).                                                                   |
| `provideAsNestedLevel(n=1)`   | `void`                                                                                                                     | Bump nesting level RELATIVE to parent for a mounted-children subtree.                                                              |

## Container renderers (custom section shells)

A `@ui.form.component` on a **structured (object) field** replaces that field's whole section chrome (the stock `AsObject` collapsible). The component gets the object's `FormObjectFieldDef` on `props.field` and re-renders the children itself — tabbed shell, side-nav, wizard, split. Children stay first-class fields (data binding, validation, path, level alternation) as long as you route them back through `AsIterator` / `AsField`.

AsField already provides two things to the custom component's subtree (`packages/vue-form/src/components/as-field.vue`): `PATH_PREFIX_KEY` = the object's **absolute path**, and `LEVEL_KEY` = the object's **level**. So an `AsIterator` with no `:path-prefix` / `:levels` re-renders the object's own direct children exactly as `AsObject` would.

Primitives (all exported from `@atscript/vue-form`):

| Primitive                          | Signature / returns                                                              | Use                                                                                                                                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useAsVisibleFields(fields)`       | `(MaybeRefOrGetter<FormFieldDef[] \| undefined>) => ComputedRef<FormFieldDef[]>` | Partition out hidden children. Static `@ui.form.hidden` hides unconditionally; `@ui.form.fn.hidden` resolved against live scope. Subscribes to form data only when some child carries `fn.hidden`. |
| `useAsFieldScope()`                | `{ absolutePath, scopeFor, resolveProp }`                                        | Child path + annotation resolution. Plain functions — wrap in your own `computed` for reactivity.                                                                                                  |
| `useAsOptionalField(field)`        | `{ optional: boolean, enabled: ComputedRef<boolean>, toggle(on): void }`         | Enable (annotated defaults) / clear (`undefined`) an optional object child. `toggle` emits the blur-committed `update` change. `null` counts as unset.                                             |
| `useAsLevel()`                     | `ComputedRef<number>`                                                            | Read current nesting level (`-1` outside a structured field; root struct = `0`). Drives odd=section / even=island.                                                                                 |
| `provideAsNestedLevel(levels = 1)` | `void`                                                                           | Bump level RELATIVE to parent for the current subtree. Call it when your chrome absorbs a structural section and mounts children directly.                                                         |

`useAsFieldScope()` returns:

- `absolutePath(field)` → current prefix joined with `field.path`.
- `scopeFor(field, { withEntry? })` → fn scope `{ v, data, context }` with `v` at the child's abs path; `withEntry` layers the evaluated field `entry` (display fns take entry scope, constraint fns take bare — AsField's dual-scope pattern).
- `resolveProp<T>(field, fnKey?, staticKey?, opts?)` → resolve a custom annotation pair, presence-gated like AsField: neither key → `undefined` (no reactive read); only static → inert scope; `fn` present → full reactive scope. For tab icons, group keys, layout hints on children.

`AsIterator` props for re-rendering a slice:

| Prop           | Effect                                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `:def`         | The `FormDef` to iterate. Object you replaced: `(props.field as FormObjectFieldDef).objectDef`. Descend into a child object: pass its `.objectDef`.   |
| `:fields`      | Explicit field list overriding `def.fields` — feed a precomputed partition (visible leaves, one tab's children).                                      |
| `:path-prefix` | Dotted segment prepended to children's paths. When `:def` is a child object's `.objectDef`, set `:path-prefix="child.name"`. Identity / non-reactive. |
| `:levels`      | Sugar for `provideAsNestedLevel(n)` scoped to these children. Identity / non-reactive.                                                                |

**Level rule.** When your chrome stands in for a structural section — you render a child object's fields directly instead of letting it render its own section — the children land one level too shallow and break alternation. Bump with `provideAsNestedLevel(1)` (or `AsIterator :levels="1"`) per absorbed section level. The bump is **relative**, so the renderer is correct at any depth.

> **BREAKING:** `provideAsNestedLevel` was **absolute**, now **relative** (`parent + levels`, `levels` default `1`). A `provideAsNestedLevel(1)` call at root is unchanged; nested it now computes the correct (not shallow) level.

**`fn` resolution needs the dynamic resolver.** `@ui.form.fn.hidden` in `useAsVisibleFields`, and any `fn` key in `resolveProp`, only evaluate when `installDynamicResolver()` from `@atscript/ui-fns` ran at startup. Static keys resolve either way.

**Delegate arrays/unions to `<AsField>`.** Don't hand-layout array/union children — `<AsField :field="child" />` carries add/remove (honoring `@expect.minLength`/`.maxLength`), per-item variant pickers, and the within-mount variant stash for free. It reads the same provided prefix + level, so no extra props.

**Chrome extras (already public):** `useAsDescendantErrorCounts()` → `Map<absolutePath, count>` to badge tabs/nav items; `useAsNestedSectionsStore()` → shared expand/collapse registry. Both covered in [structural-fields.md](structural-fields.md#provideasnestedsectionsstore--useasnestedsectionsstore).

Tabbed-shell skeleton:

```vue
<script setup lang="ts">
import { computed, ref } from "vue";
import {
  AsIterator,
  useAsVisibleFields,
  useAsFieldScope,
  type TAsComponentProps,
} from "@atscript/vue-form";
import {
  isObjectField,
  META_LABEL,
  UI_FORM_FN_LABEL,
  type FormFieldDef,
  type FormObjectFieldDef,
} from "@atscript/ui";

const props = defineProps<TAsComponentProps>();
const objectDef = computed(() => (props.field as FormObjectFieldDef).objectDef);
const visible = useAsVisibleFields(() => objectDef.value.fields);
const tabs = computed(() => visible.value.filter(isObjectField));
const leaves = computed(() => visible.value.filter((f) => !isObjectField(f)));
const { resolveProp } = useAsFieldScope();
const tabLabel = (f: FormFieldDef) =>
  resolveProp<string>(f, UI_FORM_FN_LABEL, META_LABEL) ?? f.name;
const active = ref(0);
</script>

<template>
  <div :class="props.class">
    <AsIterator v-if="leaves.length" :def="objectDef" :fields="leaves" />
    <nav role="tablist">
      <button
        v-for="(t, i) of tabs"
        :key="t.path"
        type="button"
        role="tab"
        :aria-selected="i === active"
        @click="active = i"
      >
        {{ tabLabel(t) }}
      </button>
    </nav>
    <AsIterator
      v-if="tabs[active]"
      :def="(tabs[active] as FormObjectFieldDef).objectDef"
      :path-prefix="tabs[active].name"
      :levels="1"
    />
  </div>
</template>
```

Bare root → bind `:class="props.class"` for grid placement. Framework-agnostic helpers `joinPath`, `hasFieldMeta`, `isFieldHidden` are also re-exported from `@atscript/vue-form` for container code.

## Grid layout

Every `AsObject` renders a 12-column CSS grid; fields default to the full row. Two annotations set the footprint:

```atscript
@ui.form.grid.colSpan '6'          // columns: '1'..'12' or aliases 'full' (12), 'half' (6), 'third' (4)
@ui.form.grid.rowSpan '2'          // rows: positive numeric strings only, no aliases
@ui.form.grid.colSpan '4', '6'     // optional 2nd arg = span on narrow containers
```

| Rule                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invalid values (`'0'`, negatives, decimals, unknown aliases) silently fall back to the default (col 12 / row 1). Parser: `packages/ui/src/form/grid.ts`.                                                                                |
| Responsiveness is **container-query** driven, not viewport: `as-narrow:` compiles to `@container as-grid (max-width: 480px)`. The grid registers `container-name: as-grid` via the `as-form-grid` shortcut.                             |
| Narrow span defaults to `'12'` (auto-stack) regardless of desktop span — never write `'6', '12'` by hand. The narrow 2nd arg exists to opt into something other than full-width.                                                        |
| A nested `AsObject` re-checks its **own** width: a `colSpan '6'` struct whose inner field is `colSpan '6'` auto-stacks on desktop because the inner container is `< 480px`.                                                             |
| `col-span-1..12` / `row-span-1..6` (+ `as-narrow:` flavours) are pre-safelisted by `@atscript/ui-styles` — arbitrary spans need no preset edits.                                                                                        |
| The generated classes ride on the `class` prop — a custom component with a bare root MUST bind `:class="props.class"` or the spans are silently dropped (see the callout in [TAsComponentProps contract](#tascomponentprops-contract)). |

Docs: https://ui.atscript.dev/forms/grid-layout

## Locale & currency

Provide the locale once at the root of your app (or inside a layout above forms):

```typescript
import { provideAsLocale } from "@atscript/vue-form";

provideAsLocale(() => userPrefs.value?.language); // BCP-47, e.g. "en-GB", "de-DE"
```

The signature accepts a getter so reactive sources don't need wrapping in computeds.

`useAsLocale()` inside any component returns `{ locale: ComputedRef<string | undefined> }`. AsDecimal / AsNumber use it for `Intl.NumberFormat`-driven separators.

### Currency

```atscript
amount: number     // backed by @db.column.precision 10, 2 in many setups

@db.amount.currency 'EUR'
amount: number

// Sibling-driven:
currencyCode: string
@db.amount.currency.ref 'currencyCode'
amount: number
```

AsField resolves the chain at setup: literal wins, else sibling-ref. AsDecimal then renders the locale-narrow currency symbol as the prefix.

### Units

```atscript
@db.unit 'kg'
weight: number

unitCode: string
@db.unit.ref 'unitCode'
weight: number
```

Resolved by the same chain; rendered as the suffix.

### Precision

```atscript
@db.column.precision 10, 2   // precision, scale — 10 total digits, 2 after the decimal
amount: number
```

`scale` is exposed to components as `precisionScale` (storage cap). The effective display `scale` is `min(currencyDecimals, precisionScale)` when a currency is resolved.

AsField hands these as plain props on `TAsComponentProps` — your custom component reads them like any other prop without touching annotations.

### Decimal helpers

When writing a custom decimal renderer (or formatting decimals in a cell), `@atscript/ui` exposes the storage-string-safe primitives the built-in `AsDecimal` uses. Storage values are strings so DB-precision decimals never bounce through floats.

```ts
import {
  enforceScale,
  parseDecimalInput,
  formatDecimalForDisplay,
  getCurrencyDisplayParts,
} from "@atscript/ui";

const normalized = enforceScale("123.4567", 2); // "123.45"
const stored = parseDecimalInput("1 234,56", "de-DE"); // "1234.56" (locale-aware) or null
const display = formatDecimalForDisplay({
  value: stored ?? "0",
  scale: 2,
  locale: "de-DE",
  group: true,
});
const { symbol, placement } = getCurrencyDisplayParts("EUR", "de-DE"); // { symbol: "€", placement: "suffix" }
```

`parseDecimalInput` returns `null` on garbage input; `formatDecimalForDisplay` accepts `{ value, scale?, locale?, group? }`. Use these instead of `Intl.NumberFormat` directly when you need to round-trip through a string-typed model and preserve the user's locale for separators.
