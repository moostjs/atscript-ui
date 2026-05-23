# customization

Four levels of customization, the `TAsComponentProps` contract for custom components, every composable available inside a swap component, and locale / currency / unit wiring.

## Contents

- [The two prop maps](#the-two-prop-maps)
- [Level 1 — Global type swap (built-in ids)](#level-1--global-type-swap-built-in-ids)
- [Level 2 — Per-field named component](#level-2--per-field-named-component)
- [Level 3 — Wrap with AsFieldShell](#level-3--wrap-with-asfieldshell)
- [Level 4 — Fully custom root](#level-4--fully-custom-root)
- [TAsComponentProps contract](#tascomponentprops-contract)
- [TAsComponentEmits](#tascomponentemits)
- [Custom component skeleton](#custom-component-skeleton)
- [Composables for custom components](#composables-for-custom-components)
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

## TAsComponentProps contract

Implement this interface in your custom component (or use it via `defineProps<TAsComponentProps>()`).

```typescript
export interface TAsComponentProps<V = unknown> extends TAsBaseComponentProps { ... }
```

| Prop               | Type                                | Source                                                                                                         |
| ------------------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `model`            | `{ value: V }`                      | Reactive wrapper. Bind `v-model="model.value"`.                                                                |
| `value`            | `unknown`                           | Phantom field display value (`@meta.default` / `@ui.form.fn.value`). `undefined` for data fields.              |
| `label`            | `string`                            | `@meta.label` or `@ui.form.fn.label`.                                                                          |
| `description`      | `string`                            | `@meta.description` or `@ui.form.fn.description`.                                                              |
| `hint`             | `string`                            | `@ui.form.hint` or `@ui.form.fn.hint`.                                                                         |
| `placeholder`      | `string`                            | `@ui.form.placeholder` or `@ui.form.fn.placeholder`.                                                           |
| `disabled`         | `boolean`                           | `@ui.form.disabled` or `@ui.form.fn.disabled`.                                                                 |
| `hidden`           | `boolean`                           | `@ui.form.hidden` or `@ui.form.fn.hidden`. AsField passes through `v-show`; some defaults also honor it.       |
| `readonly`         | `boolean`                           | `@meta.readonly` or `@ui.form.fn.readonly`.                                                                    |
| `required`         | `boolean`                           | `true` when `@meta.required` is present and field is not optional. `undefined` for phantom (action/paragraph). |
| `optional`         | `boolean`                           | `true` when the field is declared `optional?`.                                                                 |
| `onToggleOptional` | `(enabled: boolean) => void`        | Present only when `optional === true`. `true` → set default; `false` → set `undefined`.                        |
| `error`            | `string`                            | Merged external + props + form-composable error.                                                               |
| `onBlur`           | `() => void`                        | Activates `firstValidation` on-blur strategies + dismisses external error.                                     |
| `type`             | `string`                            | Resolved input type (e.g. `'text'`, `'select'`, `'checkbox'`).                                                 |
| `field`            | `FormFieldDef`                      | Full field def — escape hatch when you need metadata that isn't pre-resolved.                                  |
| `formAction`       | `TFormAction`                       | `{ id, label }` for phantom action buttons. Set via `@ui.form.action 'id', 'label'`.                           |
| `name`             | `string`                            | Last path segment.                                                                                             |
| `options`          | `TFormEntryOptions[]`               | For select/radio/checkbox. Resolved from `@expect.values` / `@ui.form.options` / `@ui.form.fn.options`.        |
| `class`            | `Record<string, boolean> \| string` | Forwarded by AsField (vue's class-binding flattens grid + dynamic classes).                                    |
| `style`            | `Record<string, string> \| string`  | From `@ui.form.styles` / `@ui.form.fn.styles`.                                                                 |
| `path`             | `string`                            | Absolute dotted path. Empty string at root.                                                                    |
| `level`            | `number`                            | Nesting level (0 = root structured; -1 = leaf). Set on structured/union fields only.                           |
| `inputId`          | `string`                            | Stable id for `<input>` / `<label :for>`. Always populated.                                                    |
| `errorId`          | `string`                            | Stable id for error/hint container.                                                                            |
| `descId`           | `string`                            | Stable id for description container.                                                                           |
| `ariaDescribedBy`  | `string`                            | Pre-resolved — `errorId` when error/hint present, else `descId`, else `undefined`.                             |
| `maxLength`        | `number`                            | `@expect.maxLength`.                                                                                           |
| `autocomplete`     | `string`                            | `@ui.form.autocomplete`.                                                                                       |
| `prefixIcon`       | `string`                            | CSS class to paint the left adornment glyph.                                                                   |
| `suffixIcon`       | `string`                            | CSS class to paint the right adornment glyph.                                                                  |
| `prefix`           | `string`                            | Resolved left adornment text (currency symbol / `@ui.form.prefix` / `@ui.form.prefix.ref`).                    |
| `suffix`           | `string`                            | Resolved right adornment text (`@db.unit` / `@ui.form.suffix` / `@ui.form.suffix.ref`).                        |
| `currencyCode`     | `string`                            | Resolved currency code (`@db.amount.currency` literal or `.ref`). Useful for tooltips.                         |
| `unitCode`         | `string`                            | Resolved unit-of-measure code (`@db.unit` / `.ref`).                                                           |
| `scale`            | `number`                            | Effective display scale (`min(currencyDecimals, precisionScale)`).                                             |
| `precisionScale`   | `number`                            | DB column scale cap (`@db.column.precision`).                                                                  |
| `hasAdornment`     | `boolean`                           | `true` when AsField saw any adornment-driving annotation. Keeps shell visible while ref-source is empty.       |
| `valueHelp`        | `ValueHelpInfo`                     | FK value-help descriptor (`@db.rel.FK` + `@db.http.path`).                                                     |
| `singularLabel`    | `string`                            | `@ui.form.label.singular` — drives "Add X" buttons in arrays.                                                  |
| `arrayIndex`       | `number`                            | Zero-based index when rendered as a direct array item.                                                         |
| `onRemove`         | `() => void`                        | Remove-this-item callback (array context).                                                                     |
| `canRemove`        | `boolean`                           | Whether removal is allowed (respects `@expect.minLength`).                                                     |
| `removeLabel`      | `string`                            | Label for the remove affordance.                                                                               |
| `title`            | `string`                            | For structured fields (object/array/union) — title in the collapsible header.                                  |

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

## Composables for custom components

Available from `@atscript/vue-form`:

| Composable                    | Returns                                                                                                                    | Use case                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `useAsField(opts)`            | `{ model, error, onBlur }`                                                                                                 | Build a field that isn't backed by an AsField parent.                                  |
| `useAsForm(opts)`             | Full form state (see [forms.md](forms.md))                                                                                 | Custom form root.                                                                      |
| `useAsState(opts)`            | `{ formState, clearErrors, reset, submit, setErrors }`                                                                     | Low-level form-state machine without provide/inject.                                   |
| `useAsPath()`                 | `{ path: ComputedRef<string> }`                                                                                            | Read absolute path prefix without other context.                                       |
| `useAsTypeMap()`              | `{ types: ComputedRef<Record<string, Component>> }`                                                                        | Read the form's `:types` map (for components that compose).                            |
| `useAsData()`                 | `{ rootData, getValueAt, siblingValue }`                                                                                   | Reactive read of any value in the form, by path or sibling name.                       |
| `useAsLocale()`               | `{ locale: ComputedRef<string \| undefined> }`                                                                             | Read provided locale for formatting.                                                   |
| `useAsErrorDismiss()`         | `(path: string) => void`                                                                                                   | Dismiss a server error from a custom commit path.                                      |
| `useAsValueHelp(opts)`        | FK picker state (resolved, status, searchText, results, kickoff, selectItem, clear)                                        | Build a custom FK picker.                                                              |
| `useAsDropdown(containerRef)` | `{ isOpen, toggle, close, select }`                                                                                        | Click-outside-aware dropdown state.                                                    |
| `useAsOptionalAddFlow(opts)`  | `{ composeAction, runAndFocusNew }`                                                                                        | Choreograph "enable optional + add + focus first new field".                           |
| `useAsTriStateCheckbox(opts)` | `{ checked, indeterminate, inputRef, onChange }`                                                                           | Boolean field whose model may be `undefined`.                                          |
| `useAsDate(opts)`             | `{ inputType, displayValue, setFromInput }`                                                                                | HTML5 date / datetime / time mechanics.                                                |
| `useAsNumber(opts)`           | `{ decimalSeparator, displayValue, rawValue, setFromInput }`                                                               | Locale-aware single-input number control.                                              |
| `useAsDecimal(opts)`          | `{ scale, storageScale, decimalSeparator, thousandsSeparator, displayValue, rawValue, parts, setFromInput, setFromParts }` | Decimal mechanics with scale + currency awareness.                                     |
| `useAsDualInput(opts)`        | Integer/decimal half input refs + handlers                                                                                 | Bank-UX two-input pattern (integer + decimal halves).                                  |
| `useAsExternalErrors(opts)`   | `{ effective, formError, isFormDismissed, dismissAt, dismissForm, reset }`                                                 | Manage server errors with local dismissal (used internally by useAsForm).              |
| `useAsNestedSectionsStore()`  | `AsNestedSectionsStore \| undefined`                                                                                       | Read the open/closed registry for collapsible sections.                                |
| `useAsUnionVariant()`         | `TAsUnionContext \| undefined`                                                                                             | Consume and clear the union variant picker injection inside a custom variant renderer. |

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
