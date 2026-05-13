---
outline: deep
---

# Hello World

This page builds a full working form end-to-end. It is the canonical
"prove the pipeline runs" example: a `.as` type, a Vue 3 mount, a
submit handler.

## Install

```bash
pnpm add @atscript/core @atscript/typescript @atscript/ui @atscript/vue-form
```

Make sure your `atscript.config.*` enables the TypeScript plugin so
`.as` imports compile to runtime metadata. See the
[atscript docs](https://atscript.dev) for compiler setup.

## 1. Write the type

`src/forms/BasicForm.as` — the source of truth for both the data
shape and the rendered form.

```atscript
@meta.label 'Basic Form'
@ui.form.submit.text 'Submit'
export interface BasicForm {
    @meta.label 'First Name'
    @meta.description 'Your given name'
    @ui.form.placeholder 'John'
    @ui.type 'text'
    @meta.required 'First name is required'
    @ui.form.order 1
    firstName: string

    @meta.label 'Last Name'
    @ui.form.placeholder 'Doe'
    @ui.type 'text'
    @meta.required 'Last name is required'
    @ui.form.order 2
    lastName: string

    @meta.label 'Age'
    @ui.type 'number'
    @meta.default '25'
    @ui.form.order 3
    @expect.min 18, 'Must be 18 or older'
    age: number

    @meta.label 'Email'
    @ui.type 'text'
    @ui.form.placeholder 'john@example.com'
    @ui.form.order 4
    email?: string.email

    @meta.label 'Password'
    @ui.form.placeholder 'Enter password'
    @ui.type 'password'
    @meta.required 'Password is required'
    @ui.form.order 5
    password: string
}
```

A few things to notice without diving in yet:

- `@meta.label` at the top decorates the **type** itself — it becomes
  the form title.
- `@ui.form.submit.text` sets the submit-button text. The form
  composable also accepts `@ui.form.fn.submit.text` (dynamic) — see
  [Dynamic Fields](/forms/dynamic-fields).
- `@ui.form.order` is sufficient to control field order; missing
  fields fall through in declaration order.
- `?: string.email` makes `email` optional and applies an `email`
  format check via the atscript validator.

## 2. Mount the form

`src/views/MyForm.vue` — the consumer side.

```vue
<script setup lang="ts">
import { AsForm, createDefaultTypes, createAsFormDef } from "@atscript/vue-form";
import { BasicForm } from "../forms/BasicForm.as";

const types = createDefaultTypes();
const { def, formData } = createAsFormDef(BasicForm);

function onSubmit(data: unknown) {
  console.log("BasicForm submitted:", data);
}
</script>

<template>
  <AsForm :def="def" :form-data="formData" :types="types" @submit="onSubmit" />
</template>
```

That is the entire form. Twelve lines of Vue, including imports.

## How the three pieces line up

**`createAsFormDef(BasicForm)`** parses the imported type's runtime
metadata into a `FormDef` (the framework-agnostic shape from
`@atscript/ui`) and creates a reactive `formData` container with all
declared defaults already applied. The implementation is six lines —
see `packages/vue-form/src/composables/create-as-form-def.ts`.

The returned `formData` is **wrapped**: `{ value: domainData }`. This
wrapping lets `getByPath`/`setByPath` treat the root the same way as
any other path. Read `formData.value` when you want the raw form
data (or just hand the whole thing to JSON.stringify for debugging).

```ts
formData.value === {
  firstName: "",
  lastName: "",
  age: 25,            // from @meta.default '25'
  email: undefined,   // optional → undefined
  password: "",
}
```

**`createDefaultTypes()`** returns a fresh map of every built-in field
type (`text`, `number`, `password`, `select`, `object`, `array`, …) to
its default Vue component. Spread it to override one type while
keeping the rest:

```ts
const types = { ...createDefaultTypes(), text: MyDesignSystemInput };
```

See [Field Types](/forms/field-types) for the full map.

**`<AsForm>`** is the Tier-1 component. Required props:

| Prop         | Type                | Why                                                          |
| ------------ | ------------------- | ------------------------------------------------------------ |
| `def`        | `FormDef`           | What to render — produced by `createAsFormDef`.              |
| `types`      | `TAsTypeComponents` | Type-to-component map. Use `createDefaultTypes()` to start.  |
| `form-data`  | reactive object     | Container `{ value: domainData }`. Recommended — see below.  |

If `form-data` is omitted, `useAsForm` falls back to a bare
`ref<{}>` with **no `{ value }` wrapper and no `@meta.default`
values applied**. For anything but the most trivial throwaway form,
always pass `formData = createAsFormDef(MyType).formData` (or a
manually-wrapped `ref({ value: { ... } })`). That keeps the wrapper
invariant intact and ensures declared defaults are in place at first
render.

The full prop surface is in
`packages/vue-form/src/components/as-form.vue` (e.g. `errors`,
`firstValidation`, `loading`, `hideRootTitle`, `clientFactory`,
`components`).

## Submit flow

`@submit` fires with the **unwrapped domain data** (no `value`
wrapper) once submit-time validation passes. If validation fails,
`@error` fires instead with `{ path, message }[]`.

```vue
<AsForm
  :def="def"
  :form-data="formData"
  :types="types"
  @submit="onSubmit"
  @error="onErrors"
/>
```

```ts
function onSubmit(data: BasicForm) {
  // data: { firstName, lastName, age, email?, password }
}

function onErrors(errors: { path: string; message: string }[]) {
  console.warn("validation failed:", errors);
}
```

Validation runs through the atscript validator
(`getFormValidator(def)`) so every `@expect.*`, `@meta.required` and
`string.email` constraint baked into the type is enforced
automatically. Add custom rules with `@ui.form.validate`; see
[Validation](/forms/validation).

::: info Where state lives
`<AsForm>` calls `useAsForm()` under the hood
(`packages/vue-form/src/composables/use-as-form.ts`). It owns the
data container, validator, external-error dismissal, action dispatch
and change-merging logic. You can call `useAsForm()` directly from a
custom form root if you need a non-standard chrome.
:::

## Next steps

You now have a form rendering. The next thing you almost certainly
want is more control over what each field looks like and how it
validates — both live on the type, via annotations.

- [Annotations](/forms/annotations) — the authoritative reference.
- [Field Types](/forms/field-types) — the default type map.
- [Validation](/forms/validation) — `@expect.*`, custom rules,
  external errors.
