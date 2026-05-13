---
outline: deep
---

# Unions

Discriminated unions in `.as` types map to a variant picker + dispatch
to the active variant's component. `AsUnion` detects which variant
matches the current data using a **required-prop fingerprint**, lets
the user switch variants, and stashes the previous variant's data so
flipping back restores the user's work.

## The canonical example

A `Customer.as` schema defines three contact-method types and unions
them on a `primaryContact` field:

```atscript
@meta.label 'Email contact'
type CustomerEmailContact = {
    @meta.label 'Email'
    @meta.required 'Email is required'
    email: string

    @meta.label 'HTML newsletter'
    htmlNewsletter?: boolean
}

@meta.label 'Phone contact'
type CustomerPhoneContact = {
    @meta.label 'Phone'
    @meta.required 'Phone is required'
    phone: string
}

@meta.label 'Postal contact'
type CustomerPostalContact = {
    @meta.label 'Street'
    @meta.required 'Street is required'
    street: string

    @meta.label 'City'
    @meta.required 'City is required'
    city: string
}

@db.table 'customers'
export interface CustomersTable {
    @meta.id
    @db.default.increment
    id: number

    name: string

    @meta.label 'Primary contact'
    @meta.description 'Optional fingerprint union — variant detected by required-prop set.'
    @db.json
    primaryContact?: CustomerEmailContact | CustomerPhoneContact | CustomerPostalContact
}
```

Mount the form, and the union renders with a variant picker (Email /
Phone / Postal) plus the selected variant's fields below:

```vue
<AsForm :def="def" :form-data="formData" :types="types" @submit="onSave" />
```

## Variant detection

`detectUnionVariant(value, unionVariants)` from `@atscript/ui` picks
the active variant by checking each variant's **required prop set**
against the current data shape. The first variant whose required props
all appear in the data wins. If the data is `null`/`undefined`,
detection returns index 0 (the first variant).

This is what "fingerprinting" means in the schema comment — variants
need a distinct required-prop set to be unambiguously detectable.
Avoid sibling variants that share their required-prop fingerprint.

::: tip Disambiguate by required props
Two variants that both require `{ email }` would collide. Add a
discriminant required field (`kind: 'email'` vs `kind: 'phone'`) or
make one variant's email property optional.
:::

## Switching variants

Picking a different variant calls `changeVariant(newIndex)` on
`useAsUnion` (`packages/vue-form/src/composables/use-as-union.ts`).
The composable:

1. **Stashes** the current variant's data into an in-memory map keyed
   by the previous index.
2. Updates `localUnionIndex` to the new variant.
3. **Restores** the new variant's stashed data if any, otherwise calls
   `createFormData(variant.type)` for fresh defaults.
4. Fires a `union-switch` change event so external errors and merged
   internal errors dismiss correctly.

The stash lives on the component instance — flipping Email → Phone →
Email returns the original Email data. Unmounting the form discards
the stash.

## `useAsUnion`

For custom variant pickers (cards, segmented control, dropdown menu),
call the composable directly. It returns:

```ts
const {
  unionField,           // FormUnionFieldDef | undefined
  hasMultipleVariants,  // ComputedRef<boolean>
  localUnionIndex,      // Ref<number>
  innerField,           // ComputedRef<FormFieldDef | undefined>
  changeVariant,        // (newIndex: number) => void
  optionalEnabled,      // ComputedRef<boolean>
} = useAsUnion(props);
```

`innerField` is a synthesized field for the active variant — handing
it to `<AsField>` dispatches the variant's component (`AsObject` for
object variants, `AsField` for primitive itemField variants). For
custom layouts you can also iterate the variant's nested fields
yourself.

## Custom union renderer

A `ContactCard.vue` custom union renderer — three icon cards across the
top, the active variant's fields below.

```vue
<script setup lang="ts">
import { computed } from "vue";
import { AsField, AsFieldShell, type TAsComponentProps, useAsUnion } from "@atscript/vue-form";
import { isObjectField } from "@atscript/ui";

const props = defineProps<TAsComponentProps>();
const { unionField, localUnionIndex, innerField, changeVariant } = useAsUnion(props);

const variants = computed(() => unionField.value?.unionVariants ?? []);
const activeFields = computed(() => {
  const inner = innerField.value;
  return inner && isObjectField(inner) ? inner.objectDef.fields : [];
});

function pick(index: number) {
  if (props.disabled) return;
  if (localUnionIndex.value === index) return;
  changeVariant(index);
}
</script>

<template>
  <AsFieldShell v-bind="$props">
    <template #default>
      <div role="radiogroup">
        <button
          v-for="(v, vi) in variants"
          :key="vi"
          type="button"
          :aria-checked="localUnionIndex === vi"
          @click="pick(vi)"
        >
          {{ v.label }}
        </button>
      </div>
      <AsField v-for="f of activeFields" :key="f.path ?? f.name" :field="f" />
    </template>
  </AsFieldShell>
</template>
```

Opt in per field with `@ui.form.component`:

```atscript
@ui.form.component 'contact-card'
contact: EmailContact | PhoneContact | PostalContact
```

Register the renderer in the components map:

```ts
const components = { "contact-card": ContactCard };
```

Wrap with `<AsFieldShell>` — `useAsUnion` does **not** itself provide
the union context that `AsFieldShell` would inject; only the default
`as-union.vue` does. That means the shell will render label /
description / error / required marker but **not** paint its own
variant picker on top of yours.

## Preserving variant data

The built-in stash handles "flip and come back" within one mount.
For longer-lived persistence (e.g. user navigates away and returns)
you have two options:

1. **External stash.** Keep the discarded variant data in your own
   reactive store and re-hydrate it on the next mount.
2. **Merge into one type.** If the variants genuinely share fields,
   collapse them into one type with optional fields per branch and use
   a discriminant tag.

The `ContactCard` pattern works for the in-mount case; persistence
across mounts is out-of-scope for vue-form.

::: warning Switching wipes by default
If the user picks Phone → Email, then Email → Phone, the Phone data
they originally typed is gone unless you implemented a stash. The
built-in stash covers the common case (toggling back inside one
form session).
:::

## Optional unions

`primaryContact?: A | B | C` renders a placeholder ("Add primary
contact") until the user enables it. Enabling instantiates variant 0
with its defaults; subsequent picks switch through the stash.

Closing the placeholder sets `primaryContact` back to `undefined` and
clears the stash.

## Union-item arrays

`events: EventA | EventB[]` renders the Add button as a multi-action
menu — one Add per variant. Each added item is its own union value
with its own variant state. See [Arrays](/forms/arrays).

## Next steps

- [Tuples](/forms/tuples) — fixed-length positional structures.
- [Custom Components](/forms/custom-components) — the full Tier-2
  swap-target workflow.
- [References](/forms/references) — FK pickers, another structural
  field with similar dispatch logic.
