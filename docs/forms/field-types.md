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

`createDefaultTypes()` is a six-line factory
(`packages/vue-form/src/composables/create-default-types.ts`) that
returns a fresh map of every built-in type to a Tier-2 default
component:

| Key         | Default component | Renders                                                          |
| ----------- | ----------------- | ---------------------------------------------------------------- |
| `text`      | `AsInput`         | `<input type="text">`                                            |
| `textarea`  | `AsInput`         | `<textarea>` variant                                             |
| `password`  | `AsInput`         | `<input type="password">`                                        |
| `number`    | `AsNumber`        | numeric input with optional currency/unit chrome                 |
| `decimal`   | `AsDecimal`       | fixed-point decimal with split integer/fraction halves           |
| `select`    | `AsSelect`        | `<select>` for static option lists                               |
| `radio`     | `AsRadio`         | radio-button group                                               |
| `checkbox`  | `AsCheckbox`      | single boolean checkbox / tri-state for optional booleans        |
| `date`      | `AsDate`          | date picker (`YYYY-MM-DD`)                                       |
| `datetime`  | `AsDatetime`      | date + time picker                                               |
| `time`      | `AsTime`          | time picker (`HH:MM` / `HH:MM:SS`)                               |
| `paragraph` | `AsParagraph`     | read-only paragraph — value from `@meta.default` / `fn.value`    |
| `action`    | `AsAction`        | button that emits `action` on the form                           |
| `object`    | `AsObject`        | nested object renderer (collapsible at depth)                    |
| `array`     | `AsArray`         | dynamic +/− array of items                                       |
| `union`     | `AsUnion`         | variant picker + dispatch to selected variant                    |
| `tuple`     | `AsTuple`         | fixed-position positional list                                   |
| `ref`       | `AsRef`           | searchable FK picker (driven by `@db.rel.FK` + `@db.http.path`)  |

All Tier-2 defaults are exported from `@atscript/vue-form` and can be
imported by name when you want to reuse one inside a custom renderer.

## Atscript primitive → field type

`createFormDef` maps atscript primitive types onto these keys without
any annotation:

| `.as` type        | → field type | Notes                                                |
| ----------------- | ------------ | ---------------------------------------------------- |
| `string`          | `text`       | also `string.email`, `string.url`, `string.uuid`, …  |
| `number`          | `number`     | use `@db.column.precision` for decimal placement     |
| `boolean`         | `checkbox`   | optional booleans render tri-state                   |
| `Date`            | `date`       | flip to `datetime` / `time` with `@ui.form.type`     |
| `T[]`             | `array`      | item type recurses                                   |
| `[A, B]`          | `tuple`      | fixed-length positional                              |
| `A \| B \| C`     | `union`      | discriminated union by required-prop fingerprint     |
| `{ … }`           | `object`     | nested structure — renders via AsObject              |
| `RefToTable`      | `ref`        | only when `@db.rel.FK` + `@db.http.path` are present |

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
@ui.form.options 'admin' | 'user' | 'guest'
role: string                 // string union extracted to options

@ui.form.type 'textarea'
bio?: string                 // multi-line input

@ui.form.type 'datetime'
when: Date                   // upgrade Date → datetime picker
```

For **custom** renderers — anything outside the built-in id list — use
`@ui.form.component` instead, with the name registered in the
`:components` prop map. The `:types` map is reserved for built-ins.

## Component resolution

When `<AsField>` mounts it picks a component in this order
(`packages/vue-form/src/components/as-field.vue:373-386`):

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

| Component       | Use it when                                                       |
| --------------- | ----------------------------------------------------------------- |
| `AsInput`       | text / password / textarea — the workhorse                        |
| `AsNumber`      | integer-y `number` fields, optionally with currency/unit chrome   |
| `AsDecimal`     | fixed-point inputs with controlled scale (money, percentages)     |
| `AsSelect`      | small static option lists                                         |
| `AsRadio`       | small option lists where seeing all options matters               |
| `AsCheckbox`    | boolean — tri-state for optional booleans                         |
| `AsDate`        | date-only                                                         |
| `AsDatetime`    | date + time                                                       |
| `AsTime`        | time-only                                                         |
| `AsParagraph`   | read-only displayed text (no input)                               |
| `AsAction`      | form-embedded button (fires `action` event)                       |
| `AsObject`      | nested record fields                                              |
| `AsArray`       | dynamic-length lists                                              |
| `AsUnion`       | discriminated unions / "pick one of N shapes"                     |
| `AsTuple`       | fixed-position positional arrays                                  |
| `AsRef`         | FK pickers driven by `@db.rel.FK` + `@db.http.path`               |
| `AsFieldShell`  | wrapper providing label/description/error chrome inside custom renderers |

## Next steps

- [Validation](/forms/validation) — how the atscript validator wires
  into every type.
- [Customization](/forms/customization) — bigger-picture overrides,
  per-form `clientFactory`, theme integration.
- [Custom Components](/forms/custom-components) — building a Tier-2
  swap target from scratch.
