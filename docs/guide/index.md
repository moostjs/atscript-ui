# Atscript UI

**Your types are your UI.** Annotate a `.as` type once and atscript-ui renders the form, the table, the workflow, and the validation — all from the same schema. No hand-wired field lists, no manual column configs, no duplicated validation rules between client and server.

## What is atscript-ui?

A set of UI packages that read [`.as`](https://atscript.dev) annotated types and render forms, tables, and HTTP workflows on top of Vue 3. The packages share a framework-agnostic core, so the same metadata that drives a Vue table today can drive a React or Solid binding tomorrow without re-annotating a single field.

The split is deliberate:

- **`@atscript/ui`** — framework-agnostic core. `FormDef`, `TableDef`, `FieldResolver`, the `@ui.*` annotation plugin, value-help, validation, decimal helpers.
- **`@atscript/ui-fns`** — opt-in dynamic resolver. Adds `@ui.fn.*` (live computed properties) and `@ui.form.validate` (cross-field validation) via `new Function`. Trusted schemas only.
- **`@atscript/ui-table`** — table model. Filter conditions, sorters, presets, Uniquery conversion, draft mode, window mode.
- **`@atscript/ui-styles`** — UnoCSS preset, `as-*` shortcut tree, baked icon set, `AsResolver` for auto-imports, pre-built CSS for non-UnoCSS apps.
- **`@atscript/vue-form`** — Vue components: `<AsForm>`, `<AsField>`, `<AsIterator>`, plus default field components (`AsInput`, `AsSelect`, `AsCheckbox`, …).
- **`@atscript/vue-table`** — Vue components: `<AsTable>`, `<AsTableRoot>`, `<AsWindowTable>`, `<AsFilters>`, `<AsPresetPicker>`, plus default cells, dialogs, and controls.
- **`@atscript/vue-wf`** — `<AsWfForm>` and `useWfForm()`: a multi-step HTTP workflow form driven by a server-side flow.
- **`@atscript/moost-wf`** — server side of `vue-wf`. Decorators, interceptors, `AsWfStore`.
- **`@atscript/moost-ui-presets`** — server-side persistence for table presets.

## Three things it gives you

### Forms — `@atscript/vue-form`

You annotate fields. The form renders inputs, labels, descriptions, validators, error messages, the submit button, and any nested objects / arrays / unions in the schema. Swap a default field component for your own (vunor, your design system, whatever) via the `:types` map.

```atscript
@meta.label 'Sign up'
export interface SignUp {
    @meta.label 'Email'
    @meta.required 'Email is required'
    email: string.email

    @meta.label 'Password'
    @ui.type 'password'
    @expect.minLength 8, 'At least 8 characters'
    password: string
}
```

```vue
<script setup lang="ts">
import { useForm } from "@atscript/vue-form";
import { SignUp } from "./sign-up.as";
const { def, formData } = useForm(SignUp);
</script>

<template>
  <AsForm :def="def" :form-data="formData" @submit="onSubmit" />
</template>
```

### Tables — `@atscript/vue-table`

You annotate fields once. The table renders columns, infers filter inputs from the field type (string → text filter, number → range, enum → multi-select), drives sort, pagination, and value-help dialogs. Hook up `:url=` to a `moost-db` REST endpoint and the table writes its filter/sort/page state as a [Uniquery](https://db.atscript.dev) URL.

### Workflows — `@atscript/vue-wf` + `@atscript/moost-wf`

A multi-step form whose steps live on the server. Each step is a Moost handler that defines an `@InputForm` (an `.as` type) and an `@OutputForm`. The client renders the current step with `<AsWfForm>`, submits, gets the next step back. State is persisted server-side via `AsWfStore` and resumable across sessions.

## The 30-second mental model

```
.as file
   │
   │  @meta.* / @expect.* / @ui.* / @db.* / @wf.*
   │
   ▼
asc / unplugin-atscript
   │
   ▼
.as.d.ts   (TypeScript types)
.as.js     (runtime field descriptors)
   │
   ▼
FieldResolver (in @atscript/ui)
   │
   ▼
<AsForm /> / <AsTable /> / <AsWfForm />
```

The component imports the type, asks the `FieldResolver` for every field's metadata (label, default, validators, ui type, grid span, …), and renders. That's the whole loop.

## Where to next

- [Quick Start](./quick-start) — install, configure Vite, and ship a working form + table in ten minutes.
- [Installation](./installation) — every config knob: vite plugin, UnoCSS preset, `AsResolver`, dynamic resolver, locale providers.
- [The `.as` file](./the-as-file) — the five annotation families you'll use and how they fit together.
- [Forms guide](/forms/) — the component tree, validation, arrays, nested objects, unions, dynamic fields.
- [Tables guide](/tables/) — annotations, filtering, sorting, cells, presets.
- [Workflows guide](/workflows/) — server authoring, client form, state persistence.
- [Ecosystem map](./ecosystem) — how the packages fit together and when to reach for which.
