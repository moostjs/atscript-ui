---
name: atscript-ui-forms
description: >-
  Render forms from `.as` annotated types with `@atscript/vue-form`. Use when
  working with `<AsForm>`, `<AsField>`, `<AsIterator>`; when writing `.as` types
  with `@ui.form.*` / `@ui.form.fn.*` annotations; when handling validation
  (`@meta.required`, `@expect.*`, `@ui.form.validate`); when rendering arrays,
  nested objects, discriminated unions, or tuples; when wiring form actions
  (`@ui.form.action`) or FK value-help (`@db.rel.FK` → `AsRef`); when overriding
  defaults via `:types` (built-in renderers) or `:components` (custom widgets);
  when implementing custom field components against `TAsComponentProps` /
  `AsFieldShell`; or when calling `useAsForm` / `useAsField` / `useAsArray` /
  `useAsUnion` / `useAsTuple` / `useAsLocale` / `useAsData`. Out of scope:
  tables (use `atscript-ui-tables`), HTTP workflow forms (use `atscript-ui-wf`),
  styling and `as-*` shortcuts (use `atscript-ui-styles`), framework-agnostic
  primitives like `createFormDef` (use the general `atscript-ui` skill).
---

# atscript-ui-forms

## Install

```bash
npx skills add moostjs/atscript-ui      # installs all atscript-ui skills (this one + general + tables + wf + styles)
npx skills add moostjs/atscript         # sibling — .as language
```

```bash
pnpm add @atscript/core @atscript/typescript @atscript/ui @atscript/vue-form vue
pnpm add @atscript/ui-fns                       # opt-in: dynamic @ui.form.fn.* + @ui.form.validate
pnpm add @atscript/ui-styles vunor unocss       # styling
pnpm add unplugin-vue-components                # for AsResolver()
```

## Quick start

```atscript
// src/contact.as
@meta.label 'Contact'
@ui.form.submit.text 'Send'
export interface Contact {
    @meta.label 'Name'
    @meta.required 'Name is required'
    @ui.form.placeholder 'Jane Doe'
    name: string

    @meta.label 'Email'
    @meta.required 'Email is required'
    @ui.form.placeholder 'jane@example.com'
    email: string.email

    @meta.label 'Message'
    @ui.form.type 'textarea'
    @expect.maxLength 500, 'Keep it under 500 characters'
    message: string
}
```

```vue
<script setup lang="ts">
import { AsForm, createAsFormDef, createDefaultTypes } from "@atscript/vue-form";
import { Contact } from "./contact.as";

const { def, formData } = createAsFormDef(Contact);
const types = createDefaultTypes();

function onSubmit(data: Contact) {
  // formData was { value: <Contact> } — vue-form unwrapped before emitting
  console.log(data);
}
</script>

<template>
  <AsForm :def="def" :form-data="formData" :types="types" @submit="onSubmit" />
</template>
```

`AsResolver()` from `@atscript/ui-styles/vite` auto-imports `AsForm`, `AsField`, `AsIterator`
in templates — no manual import needed if `unplugin-vue-components` is wired.

## Invariants

| #   | Rule                                                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **`@ui.form.type` is for built-in renderer ids only.** Built-ins: `text`, `password`, `textarea`, `number`, `decimal`, `select`, `radio`, `checkbox`, `paragraph`, `action`, `date`, `datetime`, `time`, plus structural `object`/`array`/`union`/`tuple`/`ref`. For custom renderers use `@ui.form.component` + the `:components` prop map.      |
| 2   | **`@ui.form.fn.*` and `@ui.form.validate` require `installDynamicResolver()` from `@atscript/ui-fns`.** Call once at app startup before mounting any `<AsForm>`. Without it, dynamic annotations silently evaluate to `undefined` and custom validators do nothing.                                                                               |
| 3   | **Form data is wrapped: `{ value: domainData }`.** Pass it as `:form-data` or omit and let `createAsFormDef` produce one. Path helpers and composables unwrap automatically. When you supply a `submitValidator`, it receives the _unwrapped_ domain data.                                                                                        |
| 4   | **Component resolution precedence**: `@ui.form.component` (name → `:components[name]`) → `@ui.form.type` / `@ui.type` (name → `:types[customType]`) → structural `field.type` (`:types[type]`). Custom components belong in `:components`; the `:types` map is reserved for built-ins. (`packages/vue-form/src/components/as-field.vue:373-386`.) |
| 5   | **Empty slots do NOT suppress fallback.** `<template #form.submit />` still renders the default Submit button. Use the explicit boolean prop (e.g. `hide-submit`) instead.                                                                                                                                                                        |
| 6   | **Fresh fields suppress live validation until edit or submit.** Items newly added via `<AsArray>` skip the field validator on first render to avoid surprise "required" errors on freshly-rendered slots.                                                                                                                                         |
| 7   | **External errors are keyed by absolute dotted path.** Pass `:errors="{ 'address.street': 'msg', '__form': 'top-level' }"`. The `__form` key is reserved for form-wide banners.                                                                                                                                                                   |
| 8   | **Union variant switching wipes data.** Switching the selected variant of a discriminated union rewrites `model.value` to a fresh instance of the target variant's type. Use `useAsUnion`'s stash inside one mount, or persist before switching for longer-lived recovery.                                                                        |
| 9   | **`AsAction` is a phantom field.** It renders a button that emits `action` from `<AsForm>` with `(name: string, data: TFormData)`. The phantom field carries `@ui.form.action 'id', 'label'` and no real data slot.                                                                                                                               |

## Key imports

```ts
// Tier 1 — primary (auto-imported by AsResolver)
import { AsForm, AsField, AsIterator } from "@atscript/vue-form";

// Tier 2 — defaults (swap targets; subpath imports also available)
import {
  AsFieldShell,
  AsInput,
  AsNumber,
  AsDecimal,
  AsSelect,
  AsRadio,
  AsCheckbox,
  AsDate,
  AsDatetime,
  AsTime,
  AsParagraph,
  AsAction,
  AsObject,
  AsArray,
  AsUnion,
  AsTuple,
  AsRef,
} from "@atscript/vue-form";

// Composables
import {
  useAsForm,
  useAsField,
  useAsState,
  useAsArray,
  useAsUnion,
  useAsTuple,
  useAsValueHelp,
  useAsDropdown,
  useAsOptionalAddFlow,
  useAsTriStateCheckbox,
  useAsDate,
  useAsDecimal,
  useAsNumber,
  useAsDualInput,
  useAsLocale,
  useAsPath,
  useAsTypeMap,
  useAsData,
  useAsErrorDismiss,
  useAsNestedSectionsStore,
  useAsExternalErrors,
  useAsUnionVariant,
} from "@atscript/vue-form";

// Factories + providers
import {
  createDefaultTypes,
  createAsFormDef,
  formatIndexedLabelParts,
  provideAsLocale,
  provideAsNestedSectionsStore,
} from "@atscript/vue-form";

// Types
import type {
  TAsComponentProps,
  TAsComponentEmits,
  TAsChangeType,
  TAsTypeComponents,
  TAsUnionContext,
  TFormState,
  TFormRule,
  UseAsFieldOptions,
  UseAsFieldReturn,
  UseAsFormOptions,
  UseAsFormReturn,
} from "@atscript/vue-form";
```

## References — load only what's needed

| Domain               | File                                                    | When                                                                                                                                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First contact        | [getting-started.md](references/getting-started.md)     | Minimal mount, `createAsFormDef`, `:types` / `:components` / `:errors` props, the submit/action emit contract                                                                                                                                                                         |
| `<AsForm>` reference | [forms.md](references/forms.md)                         | AsForm/AsField/AsIterator props/emits/slots, default type map, validation (`@expect.*`, `@meta.required`, `firstValidation` strategies, fresh-fields suppression, external errors, `__form` banner)                                                                                   |
| Structural fields    | [structural-fields.md](references/structural-fields.md) | Arrays (scalar/object/nested, union-item), nested objects (collapsible, path nesting, `provideAsNestedSectionsStore`), discriminated unions (variant detection, `useAsUnion` stash), tuples (`useAsTuple.fillMissing`, positional labels)                                             |
| Dynamic fields       | [dynamic-fields.md](references/dynamic-fields.md)       | `@atscript/ui-fns`: `installDynamicResolver()`, `@ui.form.fn.*` (label, hidden, disabled, readonly, options, value, attr, classes, styles, title, submit.text, submit.disabled), `@ui.form.validate`, `TFnScope` (`v` / `data` / `context` / `entry`), security model, FNPool caching |
| Customization        | [customization.md](references/customization.md)         | Three-level override: `:types` (built-in id swap) → `:components` (custom name + `@ui.form.component`) → `AsFieldShell` wrap → fully custom root via `useAsForm`. `TAsComponentProps` contract for custom components. Locale providers (`provideAsLocale`, currency, units).          |
| Actions + refs       | [actions-refs.md](references/actions-refs.md)           | `@ui.form.action` + `AsAction` (single + multi-action forms, submit text, conditional disable), `@db.rel.FK` + `AsRef` value-help (`@db.http.path`, `@ui.dict.*` on target, `clientFactory` for auth headers, `ValueHelpClient` flow)                                                 |

## See also

Reference docs: https://ui.atscript.dev/forms/. Source: https://github.com/moostjs/atscript-ui.
