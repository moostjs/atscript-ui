---
outline: deep
---

# Field Types & the Type Map

Every field rendered by `<AsForm>` is resolved against a **type map** —
a record from string keys (the field's `type` / `customType`) to Vue
components. The map is supplied as the `:types` prop. `createDefaultTypes()`
ships a complete set of unstyled defaults; you override entries to
plug in your own design system.

## The default type map

[`createDefaultTypes()`](/api/vue-form#createdefaulttypes) is a small factory that
returns a fresh map of every built-in type to a Tier-2 default
component:

| Key           | Default component | Renders                                                         |
| ------------- | ----------------- | --------------------------------------------------------------- |
| `text`        | `AsInput`         | `<input type="text">`                                           |
| `textarea`    | `AsInput`         | `<textarea>` variant                                            |
| `password`    | `AsInput`         | `<input type="password">`                                       |
| `number`      | `AsNumber`        | numeric input with optional currency/unit chrome                |
| `decimal`     | `AsDecimal`       | fixed-point decimal with split integer/fraction halves          |
| `select`      | `AsSelect`        | `<select>` for static option lists                              |
| `radio`       | `AsRadio`         | radio-button group                                              |
| `checkbox`    | `AsCheckbox`      | single boolean checkbox / tri-state for optional booleans       |
| `multiselect` | `AsMultiSelect`   | combobox popup with chip-style selections, bound to `T[]`       |
| `tags`        | `AsMultiSelect`   | free entry: typed values become chips, bound to `T[]`           |
| `date`        | `AsDate`          | date picker (`YYYY-MM-DD`)                                      |
| `datetime`    | `AsDatetime`      | date + time picker                                              |
| `time`        | `AsTime`          | time picker (`HH:MM` / `HH:MM:SS`)                              |
| `paragraph`   | `AsParagraph`     | read-only paragraph — value from `@meta.default` / `fn.value`   |
| `action`      | `AsAction`        | left-aligned link-styled button that emits `action` on the form |
| `object`      | `AsObject`        | nested object renderer (collapsible at depth)                   |
| `array`       | `AsArray`         | dynamic +/− array of items                                      |
| `union`       | `AsUnion`         | variant picker + dispatch to selected variant                   |
| `tuple`       | `AsTuple`         | fixed-position positional list                                  |
| `ref`         | `AsRef`           | searchable FK picker (driven by `@db.rel.FK` + `@db.http.path`) |

All Tier-2 defaults are exported from `@atscript/vue-form` and can be
imported by name when you want to reuse one inside a custom renderer.

### A narrow type map

`createDefaultTypes()` imports every default component, and the
`@atscript/ui-styles` extractor then keeps every default's CSS. An app whose
forms use a few field kinds can list just those: import each default by
name (or from its `@atscript/vue-form/as-*` subpath) and build the map
yourself. Only the imported components reach the bundle, and the extractor
keeps only their CSS.

```ts
import { AsInput, AsNumber, AsObject, AsSelect } from "@atscript/vue-form";
import type { TAsTypeComponents } from "@atscript/vue-form";

export const types: TAsTypeComponents = {
  object: AsObject, // always: renders the form's root
  text: AsInput,
  textarea: AsInput,
  number: AsNumber,
  select: AsSelect,
};
```

Every key of `TAsTypeComponents` is optional. A field whose type has no
entry renders a "No component for type" notice — add the entry, or use
`createDefaultTypes()` while the forms are still changing. Don't call
`createDefaultTypes()` anywhere in the app if you want the narrow CSS: the
extractor treats the call as "all defaults".

## Atscript primitive → field type

`createFormDef` maps atscript primitive types onto these keys without
any annotation:

| `.as` type                 | → field type  | Notes                                                                  |
| -------------------------- | ------------- | ---------------------------------------------------------------------- |
| `string`                   | `text`        | also `string.email`, `string.url`, `string.uuid`, …                    |
| `number`                   | `number`      | use `@db.column.precision` for decimal placement                       |
| `boolean`                  | `checkbox`    | optional booleans render tri-state                                     |
| `Date`                     | `date`        | flip to `datetime` / `time` with `@ui.form.type`                       |
| `T[]`                      | `array`       | item type recurses                                                     |
| `('a' \| 'b')[]`           | `multiselect` | array of a literal union — options extracted from the item type        |
| `T[]` + `@ui.form.options` | `multiselect` | primitive-item array with an option list — `T` is `string` or `number` |
| `[A, B]`                   | `tuple`       | fixed-length positional                                                |
| `A \| B \| C`              | `union`       | discriminated union by required-prop fingerprint                       |
| `{ … }`                    | `object`      | nested structure — renders via AsObject                                |
| `RefToTable`               | `ref`         | only when `@db.rel.FK` + `@db.http.path` are present                   |

`string.email` carries the `email` format constraint through to the
atscript validator; the rendered control is still a `text` input. Use
`@ui.form.component` if you want to wire a dedicated email widget — see
[Custom Components](/forms/custom-components).

## Flipping to a different built-in renderer

`@ui.form.type` (and the cross-cutting `@ui.type`) overrides the
default structural lookup, but the value **must be one of the built-in
ids above**. Use it to switch a primitive between built-in renderers:

```atscript
@ui.form.type 'password'
password: string             // would default to 'text'; rendered as password

@ui.form.type 'select'
@ui.form.options 'admin'
@ui.form.options 'user'
@ui.form.options 'guest'
role: string                 // static options

@ui.form.type 'textarea'
bio?: string                 // multi-line input

@ui.form.type 'datetime'
when: Date                   // upgrade Date → datetime picker
```

## Multi-select arrays

`multiselect` renders a combobox popup with chip-style selected
values inside the trigger — pick zero or more options from a fixed
list. The structural type stays `array` (so `@expect.minLength` /
`@expect.maxLength` still validate at the array level); only
`customType` flips to `multiselect`.
The two auto-dispatch cases are the last two `T[]` rows in the
primitive-type table above. Other `T[]` shapes fall back to the
dynamic +/- `array` renderer unless you tag them with
`@ui.form.type 'multiselect'`.

```atscript
colors: ('red' | 'green' | 'blue')[]       // auto → multiselect

@ui.form.options 'a'
@ui.form.options 'b'
@ui.form.options 'c'
tags: string[]                              // auto → multiselect (via options)

@ui.form.type 'multiselect'
@ui.form.options 'Small', 'S'
@ui.form.options 'Medium', 'M'
@ui.form.options 'Large', 'L'
sizes: string[]                             // explicit tag (same renderer)
```

Value model is the array itself (`T[]`) — no wrapping, no positional
sentinel. Swap the default `AsMultiSelect` through the `:types` map
under the `multiselect` key.

For **custom** renderers — anything outside the built-in id list — use
`@ui.form.component` instead, with the name registered in the
`:components` prop map. The `:types` map is reserved for built-ins.

## Free-entry arrays (tags)

`@ui.form.type 'tags'` on a `string[]` (or `number[]`) lets the user type
the values — synonyms, keywords, e-mail lists. A `multiselect` with no
options to pick from (no `@ui.form.options`, no `@ui.form.fn.options`, no
literal-union items) gets the same renderer. Since 0.1.164.

```atscript
@ui.form.type 'tags'
@expect.array.uniqueItems
synonyms: string[]
```

| Input                        | Effect                                                    |
| ---------------------------- | --------------------------------------------------------- |
| Enter or `,`                 | adds the typed value (trimmed; an empty value is ignored) |
| Paste                        | splits the text on `,` and adds each part                 |
| Leaving the input            | adds a value still in the input                           |
| Backspace in the empty input | selects the last chip; a second Backspace removes it      |

Duplicates are refused when the array is `@expect.array.uniqueItems`;
otherwise they are kept, as the type allows them. `number[]` items are
stored as numbers. The `tags` key falls back to the `array` renderer in a
`:types` map that has no `tags` entry. `'tags'` on a field that is not an
array is a compile error (and ignored at runtime).

## Component resolution

When `<AsField>` mounts it picks a component in this order:

```text
1. @ui.form.component  →  components[name]
2. @ui.form.type / @ui.type  →  types[customType]   (built-in id)
3. field.type  →  types[type]
```

- `@ui.form.component` resolves a **named** component from the
  `:components` prop map. Highest precedence — the dedicated mechanism
  for custom widgets.
- `@ui.form.type` (and `@ui.type` on structured fields) resolves a
  **built-in type entry** in the `:types` map. Use it to swap built-in
  renderers, not to wire custom components.

If no match is found, `<AsField>` renders a small in-place diagnostic
message rather than erroring out — useful for catching typos without
crashing the whole form.

## Overriding by type — replace a default

The most common customization: keep the entire default map but swap
one entry for your design system's component.

```vue
<script setup lang="ts">
import { AsForm, createDefaultTypes, createAsFormDef } from "@atscript/vue-form";
import MyInput from "./MyInput.vue";
import { BasicForm } from "../forms/BasicForm.as";

const types = { ...createDefaultTypes(), text: MyInput, password: MyInput };
const { def, formData } = createAsFormDef(BasicForm);
</script>

<template>
  <AsForm :def="def" :form-data="formData" :types="types" @submit="onSubmit" />
</template>
```

`MyInput` is a normal Vue component that accepts the
`TAsComponentProps` interface (model, label, error, ...). Wrapping it
in `<AsFieldShell>` is the fastest way to inherit the label /
description / error chrome — see
[Custom Components](/forms/custom-components).

## Wiring a custom component

When you have a one-off custom field (an RGB color picker, a chip
selector, a map widget), give it a name and register it in the
`:components` prop map. Tag the field with `@ui.form.component`:

```ts
import RgbPicker from "./RgbPicker.vue";

const components = {
  "rgb-picker": RgbPicker,
};
```

```atscript
@meta.label 'Brand color'
@ui.form.component 'rgb-picker'
logoRgb: [number, number, number]
```

The structural type stays `tuple`, so removing the
`@ui.form.component` annotation falls back to `AsTuple` automatically.

`@ui.form.component` is the dedicated mechanism for custom renderers
and the highest-precedence resolution path. It ignores the type map
entirely — the same custom name will not be looked up in `:types`,
which keeps the two maps cleanly separated.

:::tip Convention

- `:types` map — built-in renderer ids only (`text`, `textarea`, `date`, …).
  Touched by `@ui.form.type` / `@ui.type`.
- `:components` map — your custom renderers. Touched by `@ui.form.component`.

Don't mix the two: don't put custom components in `:types`, and don't
duplicate built-in renderers in `:components`. The runtime allows it,
but the convention keeps schemas predictable.
:::

## Built-in defaults — at a glance

| Component       | Use it when                                                              |
| --------------- | ------------------------------------------------------------------------ |
| `AsInput`       | text / password / textarea — the workhorse                               |
| `AsNumber`      | integer-y `number` fields, optionally with currency/unit chrome          |
| `AsDecimal`     | fixed-point inputs with controlled scale (money, percentages)            |
| `AsSelect`      | small static option lists                                                |
| `AsRadio`       | small option lists where seeing all options matters                      |
| `AsCheckbox`    | boolean — tri-state for optional booleans                                |
| `AsMultiSelect` | array of literal-union or option-list values — combobox popup with chips |
| `AsDate`        | date-only                                                                |
| `AsDatetime`    | date + time                                                              |
| `AsTime`        | time-only                                                                |
| `AsParagraph`   | read-only displayed text (no input)                                      |
| `AsAction`      | form-embedded button (fires `action` event)                              |
| `AsObject`      | nested record fields                                                     |
| `AsArray`       | dynamic-length lists                                                     |
| `AsUnion`       | discriminated unions / "pick one of N shapes"                            |
| `AsTuple`       | fixed-position positional arrays                                         |
| `AsRef`         | FK pickers driven by `@db.rel.FK` + `@db.http.path`                      |
| `AsFieldShell`  | wrapper providing label/description/error chrome inside custom renderers |

## Next steps

- [Validation](/forms/validation) — how the atscript validator wires
  into every type.
- [Customization](/forms/customization) — bigger-picture overrides,
  per-form `clientFactory`, theme integration.
- [Custom Components](/forms/custom-components) — building a Tier-2
  swap target from scratch.
