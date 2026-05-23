# getting-started

Mount your first `<AsForm>` against a `.as` type. Covers install, Vite wiring, the wrapped-data shape, and a tour of every `AsForm` prop and emit.

## Contents

- [Install](#install)
- [Vite + UnoCSS wiring](#vite--unocss-wiring)
- [Minimal mount](#minimal-mount)
- [Wrapped data shape](#wrapped-data-shape)
- [AsForm props summary](#asform-props-summary)
- [AsForm emits summary](#asform-emits-summary)
- [Reading list](#reading-list)

## Install

```bash
pnpm add @atscript/core @atscript/typescript @atscript/ui @atscript/vue-form vue
pnpm add @atscript/ui-fns        # opt-in: dynamic @ui.form.fn.* + @ui.form.validate
pnpm add @atscript/ui-styles vunor unocss
pnpm add -D unplugin-vue-components unplugin-atscript
```

For `.as` file authoring + `asc` CLI configuration see the atscript skill.

## Vite + UnoCSS wiring

`vite.config.ts` — minimum needed for forms (auto-imports, UnoCSS preset, `.as` loader). For styling depth see the `atscript-ui-styles` skill.

```typescript
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import Components from "unplugin-vue-components/vite";
import Atscript from "unplugin-atscript/vite";
import UnoCSS from "unocss/vite";
import { AsResolver } from "@atscript/ui-styles/vite";

export default defineConfig({
  plugins: [UnoCSS(), Atscript(), vue(), Components({ resolvers: [AsResolver()] })],
});
```

`AsResolver()` auto-imports `AsForm`, `AsField`, `AsIterator` in templates. Tier-2 defaults (`AsInput`, `AsObject`, etc.) are NOT auto-resolved — import them explicitly when you compose `:types` / `:components` maps.

`main.ts` — install the dynamic resolver once at startup if you use `@ui.form.fn.*` or `@ui.form.validate`:

```typescript
import { installDynamicResolver } from "@atscript/ui-fns";

installDynamicResolver();
```

## Minimal mount

```atscript
// src/contact.as
@meta.label 'Contact'
@ui.form.submit.text 'Send'
export interface Contact {
    @meta.label 'Name'
    @meta.required 'Name is required'
    name: string

    @meta.label 'Email'
    @meta.required 'Email is required'
    email: string.email

    @meta.label 'Message'
    @ui.form.type 'textarea'
    message?: string
}
```

```vue
<script setup lang="ts">
import { AsForm, createAsFormDef, createDefaultTypes } from "@atscript/vue-form";
import { Contact } from "./contact.as";

const { def, formData } = createAsFormDef(Contact);
const types = createDefaultTypes();

function onSubmit(data: Contact) {
  console.log(data);
}

function onError(errors: { path: string; message: string }[]) {
  console.warn("validation failed", errors);
}
</script>

<template>
  <AsForm :def="def" :form-data="formData" :types="types" @submit="onSubmit" @error="onError" />
</template>
```

`createAsFormDef(Contact)` produces `{ def, formData }`. `def` is the immutable `FormDef` describing fields/types/metadata; `formData` is the reactive container holding domain data.

## Wrapped data shape

`formData` is `{ value: domainData }`. Field paths address the inner object — `name`, `address.street`, `tags.0` — and the path helpers strip the wrapper automatically.

```typescript
// What createAsFormDef returns
const { def, formData } = createAsFormDef(Contact);
// formData === { value: { name: "", email: "", message: undefined } }

// What gets emitted on submit
emit("submit", data);
// data === formData.value  (the unwrapped inner object)
```

If you bring your own container, match the shape:

```typescript
const formData = reactive({ value: { name: "Existing", email: "x@y.z" } });
```

If you omit `:form-data`, `useAsForm` falls back to a bare `ref<{}>` — no `{ value }` wrapper, no `@meta.default` values applied. Always pass `createAsFormDef(MyType).formData` (or a manually-wrapped `ref({ value: { ... } })`) so the wrapper invariant holds and defaults reach the first render.

## AsForm props summary

| Prop              | Type                                                                 | Purpose                                                                                          |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `def`             | `FormDef`                                                            | Required. From `createAsFormDef(type).def`.                                                      |
| `formData`        | `{ value: TFormData }`                                               | External reactive container. Omit to let the form own one.                                       |
| `formContext`     | `TFormContext`                                                       | App-wide context object. Visible to `@ui.form.fn.*` scope (`context`), custom validators, slots. |
| `types`           | `TAsTypeComponents`                                                  | Required. Map of built-in renderer ids → components. Use `createDefaultTypes()`.                 |
| `components`      | `Record<string, Component>`                                          | Custom-name → component map; targeted by `@ui.form.component 'name'`.                            |
| `errors`          | `Record<string, string \| undefined>`                                | External errors keyed by absolute dotted path; `__form` for top-level banner.                    |
| `firstValidation` | `'on-change'` `'on-blur'` `'touched-on-blur'` `'on-submit'` `'none'` | When live field validation first activates. Defaults to `'on-change'`.                           |
| `hideRootTitle`   | `boolean`                                                            | Suppress the root field's `@meta.label`. Use when chrome (dialog header) already shows it.       |
| `hideSubmit`      | `boolean`                                                            | Suppress the default submit button. Empty `<template #form.submit />` does NOT suppress.         |
| `loading`         | `boolean`                                                            | Freeze form: `inert` body + overlay. Used by `<AsWfForm>` during round-trips.                    |
| `clientFactory`   | `ClientFactory`                                                      | Per-form override for FK value-help `Client` creation. Falls back to `setDefaultClientFactory`.  |

## AsForm emits summary

| Event                | Payload                                                                | Fires when                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `submit`             | `(data: TFormData)`                                                    | `<form>` submit, validation passed. `data` is the unwrapped domain object.                                                          |
| `error`              | `(errors: { path: string; message: string }[])`                        | `<form>` submit, validation failed. One entry per invalid field.                                                                    |
| `action`             | `(name: string, data: TFormData)`                                      | Phantom `@ui.form.action` field invoked, OR `@wf.action.withData` field clicked. `name` is the action id.                           |
| `unsupported-action` | `(name: string, data: TFormData)`                                      | An action name was dispatched that no field declares. Useful for shared chrome to detect mismatch.                                  |
| `change`             | `(type: TAsChangeType, path: string, value: unknown, data: TFormData)` | Leaf blur commit, array add/remove, union switch. `type` discriminates: `'update'` `'array-add'` `'array-remove'` `'union-switch'`. |

`TAsChangeType` is exported from `@atscript/vue-form` — `'update' | 'array-add' | 'array-remove' | 'union-switch'`.

```vue
<AsForm
  :def="def"
  :form-data="formData"
  :types="types"
  :errors="serverErrors"
  :form-context="{ tenantId, locale }"
  @submit="save"
  @action="(name, data) => (name === 'delete' ? remove(data.id) : null)"
  @change="(type, path) => debug(type, path)"
/>
```

## Reading list

| Need                                                                      | File                                         |
| ------------------------------------------------------------------------- | -------------------------------------------- |
| AsField/AsIterator deep dive, default type map, validation strategies     | [forms.md](forms.md)                         |
| Arrays, nested objects, discriminated unions, tuples, path nesting        | [structural-fields.md](structural-fields.md) |
| `@ui.form.fn.*` dynamic annotations, `installDynamicResolver`, `TFnScope` | [dynamic-fields.md](dynamic-fields.md)       |
| Custom components, `TAsComponentProps`, locale, currency                  | [customization.md](customization.md)         |
| `@ui.form.action`, multi-action forms, FK pickers via `@db.rel.FK`        | [actions-refs.md](actions-refs.md)           |
