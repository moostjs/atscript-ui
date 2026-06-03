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
  `AsFieldShell` (incl. prebuilt `@atscript/vue-aooth` field components);
  or when calling `useAsForm` / `useAsField` / `useAsArray` / `useAsUnion` /
  `useAsTuple` / `useAsData`. Out of scope:
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

`AsResolver()` from `@atscript/ui-styles/vite` auto-imports `AsForm`, `AsField`, `AsIterator`, `AsCollapsible`
in templates — no manual import needed if `unplugin-vue-components` is wired.

## Invariants

| #   | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **`@ui.form.type` is for built-in renderer ids only.** Built-ins: `text`, `password`, `textarea`, `number`, `decimal`, `select`, `radio`, `checkbox`, `multiselect`, `paragraph`, `action`, `date`, `datetime`, `time`, plus structural `object`/`array`/`union`/`tuple`/`ref`. For custom renderers use `@ui.form.component` + the `:components` prop map. `multiselect` auto-dispatches on `(literal \| union)[]` and on primitive-item arrays carrying `@ui.form.options` / `@ui.form.fn.options`; value model is `T[]`. |
| 2   | **`@ui.form.fn.*` and `@ui.form.validate` require `installDynamicResolver()` from `@atscript/ui-fns`.** Call once at app startup before mounting any `<AsForm>`. Without it, dynamic annotations silently evaluate to `undefined` and custom validators do nothing.                                                                                                                                                                                                                                                         |
| 3   | **Form data is wrapped: `{ value: domainData }`.** Pass it as `:form-data` or omit and let `createAsFormDef` produce one. Path helpers and composables unwrap automatically. When you supply a `submitValidator`, it receives the _unwrapped_ domain data.                                                                                                                                                                                                                                                                  |
| 4   | **Component resolution precedence**: `@ui.form.component` (name → `:components[name]`) → `@ui.form.type` / `@ui.type` (name → `:types[customType]`) → structural `field.type` (`:types[type]`). Custom components belong in `:components`; the `:types` map is reserved for built-ins.                                                                                                                                                                                                                                      |
| 5   | **Empty slots do NOT suppress fallback.** `<template #form.submit />` still renders the default Submit button. Use the explicit boolean prop (e.g. `hide-submit`) instead.                                                                                                                                                                                                                                                                                                                                                  |
| 6   | **Fresh fields suppress live validation until edit or submit.** Items newly added via `<AsArray>` skip the field validator on first render to avoid surprise "required" errors on freshly-rendered slots.                                                                                                                                                                                                                                                                                                                   |
| 7   | **External errors are keyed by absolute dotted path.** Pass `:errors="{ 'address.street': 'msg', '__form': 'top-level' }"`. The `__form` key is reserved for form-wide banners.                                                                                                                                                                                                                                                                                                                                             |
| 8   | **Union variant switching wipes data.** Switching the selected variant of a discriminated union rewrites `model.value` to a fresh instance of the target variant's type. Use `useAsUnion`'s stash inside one mount, or persist before switching for longer-lived recovery.                                                                                                                                                                                                                                                  |
| 9   | **`AsAction` is a phantom field.** It renders a button that emits `action` from `<AsForm>` with `(name: string, data: TFormData)`. The phantom field carries `@ui.form.action 'id', 'label'` and no real data slot.                                                                                                                                                                                                                                                                                                         |
| 10  | **`@ui.form.action` on a regular input renders an inline link.** On a non-phantom input it appears as a link-styled button in the field footer and emits the same `action` event; in `<AsWfForm>` it resolves via `@WfAction()`. See [actions-refs.md](references/actions-refs.md).                                                                                                                                                                                                                                         |

## Key imports

```ts
// Tier 1 — primary (auto-imported by AsResolver)
import { AsForm, AsField, AsIterator, AsCollapsible } from "@atscript/vue-form";

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
  AsMultiSelect,
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
  TAsCollapsibleProps,
  TAsCollapsibleSlots,
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

| Domain               | File                                                          | When                                                                                                                                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First contact        | [getting-started.md](references/getting-started.md)           | Minimal mount, `createAsFormDef`, `:types` / `:components` / `:errors` props, the submit/action emit contract                                                                                                                                                                         |
| `<AsForm>` reference | [forms.md](references/forms.md)                               | AsForm/AsField/AsIterator props/emits/slots, default type map, validation (`@expect.*`, `@meta.required`, `firstValidation` strategies, fresh-fields suppression, external errors, `__form` banner)                                                                                   |
| Structural fields    | [structural-fields.md](references/structural-fields.md)       | Arrays (scalar/object/nested, union-item), nested objects (collapsible, path nesting, `provideAsNestedSectionsStore`), discriminated unions (variant detection, `useAsUnion` stash), tuples (`useAsTuple.fillMissing`, positional labels)                                             |
| Dynamic fields       | [dynamic-fields.md](references/dynamic-fields.md)             | `@atscript/ui-fns`: `installDynamicResolver()`, `@ui.form.fn.*` (label, hidden, disabled, readonly, options, value, attr, classes, styles, title, submit.text, submit.disabled), `@ui.form.validate`, `TFnScope` (`v` / `data` / `context` / `entry`), security model, FNPool caching |
| Customization        | [customization.md](references/customization.md)               | Three-level override: `:types` (built-in id swap) → `:components` (custom name + `@ui.form.component`) → `AsFieldShell` wrap → fully custom root via `useAsForm`. `TAsComponentProps` contract for custom components. Locale providers (`provideAsLocale`, currency, units).          |
| Actions + refs       | [actions-refs.md](references/actions-refs.md)                 | `@ui.form.action` + `AsAction` (single + multi-action forms, submit text, conditional disable), `@db.rel.FK` + `AsRef` value-help (`@db.http.path`, `@ui.dict.*` on target, `clientFactory` for auth headers, `ValueHelpClient` flow)                                                 |
| Aooth components     | [aooth-components.md](references/aooth-components.md)         | Reaching for the prebuilt `@atscript/vue-aooth` field components — `AsConsentArray`, `AsPasswordRules`, `AsQrCode`, `AsCopy` — or building a phantom display field driven by workflow context (`ui.paragraph` + `@ui.form.fn.value` + `@wf.context.pass`)                             |
| Collapsible sections | [collapsible-sections.md](references/collapsible-sections.md) | Wrapping a custom component in section chrome / adding a header-row action to a section / using `<AsCollapsible>` directly                                                                                                                                                            |

## OCC-enabled edit forms

For tables annotated with `@db.column.version`, the server returns `meta.versionColumn` and auto-handles compare-and-set on update. Wire the form so the version field doesn't render as an input but the value still rides the wire:

```ts
import { createFormDef } from "@atscript/ui";
import { deserializeAnnotatedType } from "@atscript/typescript/utils";
import { VersionMismatchError } from "@atscript/db-client";

const meta = await client.meta();
const formDef = createFormDef(deserializeAnnotatedType(meta.type), {
  versionColumn: meta.versionColumn,
});

async function onSubmit(data: unknown) {
  try {
    await client.update(data as never);
  } catch (e) {
    if (e instanceof VersionMismatchError) {
      showError(`Row changed (current version: ${e.currentVersion}). Reload to continue.`);
    } else {
      throw e;
    }
  }
}
```

The version prop is excluded from `def.fields[]` (so `<AsForm>` doesn't paint it) but stays in `flatMap` and the underlying form data, so the PATCH body preserves it for the server's `$cas` lift. `createTableDef` does the symmetric thing on the table side — the version column never appears in column / filter / sort dialogs. See the `atscript-db` skill (OCC reference) for the server-side mechanics (`@db.column.version`, `$cas`, `VersionMismatchError`).

## Customization

Forms expose three swap mechanisms, layered on the tier model:

- **Tier 1** — `<AsForm>`, `<AsField>`, `<AsIterator>` are the integration surface. Configure them via props and slots; if you need a fully custom shell, build one with `useAsForm` / `useAsField` directly.
- **Tier 2** — the default field components (`AsInput`, `AsSelect`, `AsRadio`, `AsCheckbox`, `AsDate`, `AsParagraph`, `AsAction`, `AsObject`, `AsArray`, `AsUnion`, `AsTuple`, `AsRef`, `AsMultiSelect` — see "Key imports"). These are what you swap.
- **Tier 3** — internal composition helpers. Not directly tagged or swapped; their style classes ride with whichever defaults import them.

### Swap a built-in renderer (`:types`)

`:types` maps built-in renderer ids (per invariant 1: `text`, `select`, `date`, …) to a component. Useful when you want every field of a given built-in type to render with your design system's input:

```vue
<script setup lang="ts">
import { createDefaultTypes } from "@atscript/vue-form";
import MyTextInput from "./MyTextInput.vue";

const types = { ...createDefaultTypes(), text: MyTextInput };
</script>

<template>
  <AsForm :def="def" :form-data="formData" :types="types" />
</template>
```

### Swap a specific field (`:components` + `@ui.form.component`)

`:components` looks up by a custom name the `.as` type opts into. Use this when you want one field — not every field of that type — to render with a custom widget (e.g. a country picker that's still a `string` to the rest of the system):

```atscript
export interface Profile {
    @meta.label 'Country'
    @ui.form.component 'country-picker'
    country: string
}
```

```vue
<script setup lang="ts">
import CountryPicker from "./CountryPicker.vue";
const components = { "country-picker": CountryPicker };
</script>

<template>
  <AsForm :def="def" :form-data="formData" :components="components" />
</template>
```

`:components` takes precedence over `:types` (invariant 4). The `:types` map stays reserved for built-in ids — point custom names at `:components` and you keep the renderer ids available for genuine type-level overrides.

### Wrap with `AsFieldShell`

When the framing (label, hint, error, required marker, description) is already what you want but the input itself isn't, wrap your custom input in `AsFieldShell` rather than re-implementing the chrome:

```vue
<script setup lang="ts">
import { AsFieldShell } from "@atscript/vue-form";
import type { TAsComponentProps } from "@atscript/vue-form";
defineProps<TAsComponentProps<string>>();
</script>

<template>
  <AsFieldShell v-bind="$props">
    <input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />
  </AsFieldShell>
</template>
```

If instead you render a **bare root** (no `AsFieldShell` — e.g. a section or media block that doesn't want the label/error chrome), you must bind `:class="props.class"` (and `:style="props.style"`) on that root yourself. `class`/`style` are _declared_ props on `TAsComponentProps`, so they arrive as `props.class` — not `$attrs` — and are not auto-applied to the root; `AsFieldShell` does this for you. Omit it and the field loses its `@ui.form.grid.colSpan`/`.rowSpan` placement (renders at the wrong width).

Full contract for custom components (`TAsComponentProps`, `TAsComponentEmits`, locale providers) lives in [customization.md](references/customization.md).

### Style consequence

If you swap `AsSelect` for a custom dropdown, the `as-select-*` shortcuts the default tagged drop out of your bundle automatically. Keep the default when its styling already fits your design system; for granular opt-out, see `atscript-ui-styles` (`allShortcuts` super-merge, swap in a narrower subset).

### In-tree examples

`@atscript/vue-aooth` ships four production examples of the custom-component and phantom-field patterns — `AsConsentArray`, `AsPasswordRules`, `AsQrCode`, `AsCopy`. They demonstrate `useAsField` inside a component, re-using `compileFieldFn` from `@atscript/ui-fns` for fn-string arrays, and the phantom (`ui.paragraph` + `@ui.form.fn.value` + `@wf.context.pass`) display pattern. See [aooth-components.md](references/aooth-components.md).

## See also

Reference docs: https://ui.atscript.dev/forms/. Source: https://github.com/moostjs/atscript-ui.
