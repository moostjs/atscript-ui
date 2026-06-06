# Customization

Every aspect of how a field renders is replaceable. Pick the smallest hammer
that fits — atscript-ui exposes four layered override mechanisms, from a
one-line global swap to a fully custom field render.

| Level | Scope                      | Use when                                              |
| ----- | -------------------------- | ----------------------------------------------------- |
| 1     | Global type swap           | Every field of a given type should use your component |
| 2     | Per-field named component  | One specific field needs a different widget           |
| 3     | Wrap with `AsFieldShell`   | Custom control, standard label/error chrome           |
| 4     | Full `AsForm` default slot | Take over the entire field-rendering loop             |

Mix as needed: a global swap for `text` plus a single per-field `'colorSwatch'`
override is normal.

## Level 1 — Global type swap

Pass a `:types` map to `<AsForm>`. The map's keys are the **built-in field
type ids** resolved by `<AsField>`:
`text`, `password`, `textarea`, `number`, `decimal`, `select`, `radio`,
`checkbox`, `multiselect`, `paragraph`, `action`, `object`, `array`,
`union`, `tuple`, `ref`, `date`, `datetime`, `time`.

```vue
<script setup lang="ts">
import { AsForm, createDefaultTypes, createAsFormDef } from "@atscript/vue-form";
import { ContactForm } from "./ContactForm.as";
import GrowingTextarea from "@/components/GrowingTextarea.vue";

const { def, formData } = createAsFormDef(ContactForm);

const types = {
  ...createDefaultTypes(),
  text: GrowingTextarea,
};
</script>

<template>
  <AsForm :def="def" :form-data="formData" :types="types" />
</template>
```

Every `string` field on the form now renders with `GrowingTextarea`. Other
types are untouched.

`createDefaultTypes()` returns a freshly-built map of the built-in defaults
(`AsInput`, `AsSelect`, …). Always spread it — the map shape is required by
`TAsTypeComponents`.

To **flip one specific field** to a different built-in renderer without
replacing the whole types map, use `@ui.form.type` (or the cross-cutting
`@ui.type`). The value must be one of the built-in ids above — `@ui.form.type`
is a _built-in renderer dispatcher_, not a place to wire custom components.

```atscript
@meta.label 'Bio'
@ui.form.type 'textarea'
bio: string

@meta.label 'Confirm password'
@ui.form.type 'password'
confirm: string
```

For anything outside the built-in id list — your own widgets, design-system
components, third-party pickers — jump to Level 2.

## Level 2 — Per-field named component

`@ui.form.component` is the dedicated mechanism for custom renderers. Tag the
field with a name, then register that name in the `:components` map:

```atscript
@meta.label 'Rating'
@ui.form.component 'stars'
rating: number

@meta.label 'Brand color'
@ui.form.component 'color-swatch'
brandColor: string

@meta.label 'Tags'
@ui.form.component 'tag-input'
@ui.form.label.singular 'tag'
tags: string[]
```

```vue
<script setup lang="ts">
import { StarRating, ColorSwatch, TagInput } from "@/components/custom";

const components = {
  stars: StarRating,
  "color-swatch": ColorSwatch,
  "tag-input": TagInput,
};
</script>

<template>
  <AsForm :def="def" :form-data="formData" :components="components" />
</template>
```

`as-field.vue` resolves components in this order
(`packages/vue-form/src/components/as-field.vue:373-386`):

1. `@ui.form.component 'name'` → `components[name]`
2. `@ui.form.type 'name'` → `types[name]` (built-in id)
3. Structural type → `types[type]` (`'text'`, `'number'`, etc.)

A field with no annotation falls all the way back to the structural lookup —
fine, that's how every default form already works.

:::tip Convention
The `:types` map is reserved for **built-in renderer ids**. Custom
components always go through `@ui.form.component` + the `:components` map.
The same rule applies to `@ui.type` / `@ui.table.type` — built-ins only.
:::

## Level 3 — Wrap with `AsFieldShell`

When you want a custom control but the standard label / description / error /
optional-toggle chrome should stay consistent with the rest of the form,
compose your widget inside `<AsFieldShell>`. The shell is the same wrapper the
built-in defaults use; it consumes the full `TAsComponentProps` contract via
`v-bind="$props"` and exposes a `default` slot with the resolved `inputId`.

```vue
<script setup lang="ts">
import { AsFieldShell, type TAsComponentProps } from "@atscript/vue-form";

const props = defineProps<TAsComponentProps<string | null | undefined>>();

const PALETTE = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#0ea5e9"];

function pick(hex: string): void {
  props.model.value = hex;
}
</script>

<template>
  <AsFieldShell v-bind="$props" data-testid="color-swatch">
    <template #default="{ inputId }">
      <div role="radiogroup" :aria-label="label || name" :aria-describedby="ariaDescribedBy">
        <button
          v-for="(hex, idx) in PALETTE"
          :key="hex"
          :id="idx === 0 ? inputId : undefined"
          type="button"
          :style="{ backgroundColor: hex }"
          :aria-checked="model.value === hex"
          role="radio"
          :disabled="disabled"
          @click="pick(hex)"
        />
      </div>
    </template>
  </AsFieldShell>
</template>
```

What you get for free by wrapping with `AsFieldShell`:

- Label (`@meta.label` / `@ui.form.fn.label`)
- Description (`@meta.description` / `@ui.form.fn.description`)
- Hint text (`@ui.form.hint` / `@ui.form.fn.hint`)
- Error message and `scope-error` styling
- Optional-field toggle (`onToggleOptional`)
- `aria-describedby` wiring via `errorId` / `descId`

`ColorSwatch.vue`, `StarRating.vue`, `TagInput.vue`,
`NumberStepper.vue`, and `GrowingTextarea.vue` are typical working
examples of this pattern.

## Level 4 — Default slot of `AsForm`

The default slot of `<AsForm>` (well, technically the body content — the field
loop is `<AsField :field="def.rootField" />` inside the form template) lets you
take over rendering entirely. In practice this means: don't use the default
slot. Instead, build your own root component that calls `useAsForm()` directly
and renders the field tree however you want.

```vue
<script setup lang="ts">
import { useAsForm, AsField } from "@atscript/vue-form";
import { getFieldMeta, META_LABEL } from "@atscript/ui";
import { computed } from "vue";

const props = defineProps<{ def; formData; types }>();

const form = useAsForm({
  def: () => props.def,
  formData: () => props.formData,
  types: () => props.types,
});

// Resolve the root form title from the type's `@meta.label`.
const title = computed(() => getFieldMeta(props.def.type, META_LABEL) as string | undefined);
</script>

<template>
  <form @submit.prevent="form.onSubmit">
    <MyCustomHeader :title="title" />
    <AsField v-for="field in def.fields" :key="field.path" :field="field" />
    <MySubmitFooter :disabled="form.submitDisabled.value">
      {{ form.submitText.value }}
    </MySubmitFooter>
  </form>
</template>
```

`def.fields` is the flat list of root-level child fields; for the
header label you can also render `<AsField :field="def.rootField" />`
and let `AsForm`'s default chrome resolve the title for you.

For lower-level access — replacing `<AsField>` itself with your own per-field
component that calls `useAsField()` — see
[Custom field components](/forms/custom-components).

## Slots & the `slotProps` bag

Short of taking over the whole render loop, `<AsForm>` exposes named slots for
the chrome around the field tree — header, footer, error banner, submit button,
loading overlay. Every one receives the **same unified `slotProps` bag**, so you
can read form state from any slot without prop drilling.

The bag every slot gets:

| Key                                         | What it is                                             |
| ------------------------------------------- | ------------------------------------------------------ |
| `title` / `description`                     | Resolved form header text (`@meta.label` / fn variant) |
| `data`                                      | The reactive form-data container `{ value }`           |
| `errors` / `formError`                      | External leaf errors + the form-level message          |
| `disabled` / `loading`                      | Submit-disabled flag and busy state                    |
| `submitText`                                | Resolved submit-button label                           |
| `submit` / `reset`                          | Trigger submit / reset the form                        |
| `clearErrors` / `setErrors`                 | Imperative error control                               |
| `dismissError(path)` / `dismissFormError()` | Dismiss a leaf error or the banner                     |
| `formContext`                               | The reactive form context                              |

Slot list (each gets the bag, plus the extras noted):

| Slot           | Extra scope props    | Renders                         |
| -------------- | -------------------- | ------------------------------- |
| `form.header`  | —                    | Above the field tree            |
| `form.before`  | —                    | Inside the form, above fields   |
| `form.after`   | —                    | Inside the form, below fields   |
| `form.error`   | `message`, `dismiss` | Form-level error banner         |
| `form.submit`  | `text`               | The submit button               |
| `form.footer`  | —                    | Below the submit row            |
| `form.loading` | —                    | Contents of the loading overlay |

```vue
<template>
  <AsForm :def="def" :form-data="formData" :types="types">
    <template #form.header="{ title, description }">
      <h2 class="as-form-title">{{ title }}</h2>
      <p v-if="description" class="as-form-description">{{ description }}</p>
    </template>
  </AsForm>
</template>
```

The full bag type lives in the [`useAsForm` return](/api/vue-form#useasform-options)
(API reference) — narrative pages link rather than restate it.

### Hide props

Three booleans on `<AsForm>` control the default chrome:

- **`hideRootTitle`** — suppress the root field's title (use when the host
  chrome already shows the form's `@meta.label`, e.g. a dialog header) — this
  hides the title only; the field's `@meta.description` still renders. There is
  no built-in switch to hide both; render your own header via the `form.header`
  slot if you need full control.
- **`hideSubmit`** — suppress the default submit button (use when the host owns
  the submit affordance).
- **`loading`** — freeze the form: the body becomes `inert` and a loading
  overlay paints over the whole form area. `<AsWfForm>` wires this to its
  server round-trip.

::: warning Empty slot ≠ hidden
Vue 3 treats an empty `<template #form.submit />` as **"slot provided"**, which
suppresses the default button's fallback content but still renders the slot
wrapper. To actually drop the default submit button, use the `hideSubmit` prop —
not an empty slot.
:::

### Restyling the chrome

To restyle (not replace) the header, footer, submit, or error banner, override
their `as-*` shortcuts — `as-form-title`, `as-form-description`, `as-submit-btn`,
`as-form-error` — instead of writing a slot. See
[Overriding a built-in `as-*` shortcut](/styling/shortcuts#overriding-a-built-in-as-shortcut).

## Worked example — combining levels

A page can run two forms side-by-side to exercise multiple override
mechanisms.

**Section A** uses Level 1 — every `string` field on the form picks up
`GrowingTextarea` via the types map:

```typescript
const typesA = { ...createDefaultTypes(), text: GrowingTextarea };
```

**Section B** uses Levels 1 + 2 — `bio` is flipped to the built-in `textarea`
renderer via `@ui.form.type`; the rest are `@ui.form.component '<name>'`
widget swaps routed through the components map. `displayName: string` has no
annotation and falls back to the default `text` renderer:

```typescript
const componentsB = {
  stepper: NumberStepper,
  stars: StarRating,
  "color-swatch": ColorSwatch,
  "tag-input": TagInput,
  "address-card": AddressCard,
  "rgb-picker": RgbPicker,
  "contact-card": ContactCard,
};
```

## Picking between `@ui.form.type` and `@ui.form.component`

| Annotation           | Looks up in   | Value space                               |
| -------------------- | ------------- | ----------------------------------------- |
| `@ui.form.type`      | `:types`      | Built-in ids only (`text`, `textarea`, …) |
| `@ui.form.component` | `:components` | Any custom name you register              |

Rule of thumb:

- Use **`@ui.form.type`** to flip between built-in renderers — render a
  `string` as `textarea` / `password`, force a `number` field to use the
  `decimal` input, etc.
- Use **`@ui.form.component`** for every custom widget — your design system's
  date range picker, a domain-specific color swatch, a tag input, an
  address card.

The runtime resolver itself is open-ended — you _can_ stuff a custom name
into `@ui.form.type` and it will be looked up in `:types`. Reserving the
types map for built-ins is the convention: schemas read more predictably and
a future cleanup of unused custom entries is less likely to accidentally
unhook a field.

## Next steps

- [Custom field components](/forms/custom-components) — the `TAsComponentProps` contract in detail
- [Locale & currency](/forms/locale) — common composables for custom date/decimal widgets
- [Validation](/forms/validation) — how errors reach your custom widget
