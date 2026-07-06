---
outline: deep
---

# Nested Objects

Inline object literals in `.as` types nest naturally. `AsObject` renders
the root field as an iterator grid and every deeper level as a
collapsible section, with path-aware children that compute absolute
paths automatically.

## The canonical example

A `NestedForm.as` schema that builds a two-level company profile.

```atscript
@meta.label 'Company Profile'
@ui.form.submit.text 'Save Profile'
export interface NestedForm {
    @meta.label 'Company Name'
    @meta.required 'Company name is required'
    @ui.form.order 1
    companyName: string

    @meta.label 'Headquarters'
    @ui.form.order 2
    address: {
        @meta.label 'Street'
        @meta.required 'Street is required'
        street: string

        @meta.label 'City'
        @meta.required 'City is required'
        city: string

        @meta.label 'ZIP Code'
        @meta.required 'ZIP code is required'
        zip: string

        country: {
            @meta.label 'Country Name'
            @meta.required 'Country name is required'
            name: string

            @meta.label 'Country Code'
            @meta.required 'Country code is required'
            @ui.form.fn.hint '(v) => v && v.length !== 2 ? "Use a 2-letter ISO code" : ""'
            code: string
        }
    }

    @ui.form.order 10
    contact: {
        @meta.label 'Contact First Name'
        @meta.required 'First name is required'
        firstName: string

        @meta.label 'Contact Last Name'
        lastName?: string

        @meta.label 'Contact Email'
        @ui.form.fn.description
            '(v, data) => data.contact?.firstName ? "Email for " + data.contact.firstName : "Contact email address"'
        email?: string.email

        department: {
            @meta.label 'Department Name'
            name?: string

            @meta.label 'Floor'
            @expect.min 1, 'Floor must be at least 1'
            @expect.max 100, 'Floor must be at most 100'
            floor?: number

            @meta.label 'Room'
            @ui.form.fn.hidden '(v, data) => !data.contact?.department?.floor'
            room?: string
        }
    }
}
```

Mount it like any other form:

```vue
<script setup lang="ts">
import { AsForm, createDefaultTypes, createAsFormDef } from "@atscript/vue-form";
import { NestedForm } from "./NestedForm.as";

const types = createDefaultTypes();
const { def, formData } = createAsFormDef(NestedForm);
</script>

<template>
  <AsForm :def="def" :form-data="formData" :types="types" @submit="onSave" />
</template>
```

## How nesting renders

- The **root** level (`NestedForm`) is the form itself — its
  `@meta.label` becomes the form title.
- The **first nested level** (`address`, `contact`) renders inside a
  collapsible section. The section's open/closed state lives in the
  shared sections store (see below).
- **Deeper levels** (`address.country`, `contact.department`) render
  as their own collapsible sections — nested inside the parent's body.

Each `AsObject` shows a header with the field's label, an
error-count badge (if any descendants have errors), and a toggle
arrow.

## Path provision

`AsField` provides `PATH_PREFIX_KEY` for its descendants. Each level's
prefix is the parent's prefix joined with this field's prop name:

```text
root:                  ""
└─ address:            "address"
   └─ country:         "address.country"
      └─ name:         "address.country.name"
      └─ code:         "address.country.code"
└─ contact:            "contact"
   └─ department:      "contact.department"
      └─ room:         "contact.department.room"
```

You see these absolute paths in external errors
(`{ "address.street": "Unknown address" }`), in change events emitted
by `<AsForm>`, and in dynamic `data.*` accesses inside
`@ui.form.fn.*` expressions.

## Optional toggle on object fields

Top-level optional fields render with an "enable this section"
affordance — the user expands the placeholder to instantiate the
object's defaults. Closing the placeholder sets the value back to
`undefined`. Behaviour is identical at every depth.

For example:

```atscript
@meta.label 'Billing address'
billingAddress?: {
    street: string
    city: string
}
```

The form renders an "Add billing address" placeholder; clicking it
populates the field with `{ street: "", city: "" }` and opens the
section.

## Error-aware auto-open

`useAsForm` watches every error path and walks ancestors, opening
each section along the way
(`packages/vue-form/src/composables/use-as-form.ts:238-248`). After a
submit with errors in `address.country.code`, both the `address` and
`address.country` sections are open before the next paint.

This combines with [Validation](/forms/validation) — the user sees
exactly which field failed without having to hunt through closed
sections.

### Reading the error counts yourself

The same data that drives the collapsed-section badge is available to
your own components via `useAsDescendantErrorCounts()`. It returns a
`ComputedRef<Map<string, number>>` keyed by every dotted-path prefix
that has at least one error at or below it — so `map.get("address")`
is the total error count anywhere under `address`. `AsObject` reads
this map for its badge; you read it to badge a **custom** section shell
(a tabbed layout, a side-nav) or to jump to the first errored section.

```vue
<script setup lang="ts">
import { useAsDescendantErrorCounts } from "@atscript/vue-form";

const errorCounts = useAsDescendantErrorCounts();

function errorsUnder(path: string): number {
  return errorCounts?.value.get(path) ?? 0;
}
</script>

<template>
  <nav>
    <a v-for="s of sections" :key="s.path" :href="`#${s.path}`">
      {{ s.label }}
      <span v-if="errorsUnder(s.path)" class="badge">{{ errorsUnder(s.path) }}</span>
    </a>
  </nav>
</template>
```

The composable returns `undefined` when no `<AsForm>` ancestor supplies
the map — guard the `.value` access as above. The map is computed, so
the counts update reactively as validation runs.

The map mirrors **what fields display right now**, not just the last
submit: a live rule error (per the form's `first-validation` gating)
counts the moment the field shows it, and fixing a value — typed or
programmatic (e.g. a "discard changes" data restore) — drops the count
immediately, no second submit needed. Submit-time errors for paths no
mounted field owns (a not-selected union variant, an optional-disabled
subtree) stay counted until the data is corrected or the next submit.
External `:errors` entries count until dismissed by an edit.

## Shared sections store

`AsForm` provides a `AsNestedSectionsStore` so the entire form shares
one expand/collapse registry
(`packages/vue-form/src/composables/use-as-nested-sections-store.ts`).

That registry can be **lifted above** the form. Call
`provideAsNestedSectionsStore()` from a page-level setup block when
you want page chrome (Expand All / Collapse All toolbar) to drive the
form's sections.

```vue
<script setup lang="ts">
import {
  AsForm,
  createDefaultTypes,
  createAsFormDef,
  provideAsNestedSectionsStore,
} from "@atscript/vue-form";
import { NestedForm } from "./NestedForm.as";

const sections = provideAsNestedSectionsStore();
const types = createDefaultTypes();
const { def, formData } = createAsFormDef(NestedForm);
</script>

<template>
  <header class="toolbar">
    <button @click="sections.expandAll()">Expand all</button>
    <button @click="sections.collapseAll()">Collapse all</button>
  </header>
  <AsForm :def="def" :form-data="formData" :types="types" />
</template>
```

`AsForm` will inherit the page-supplied store instead of creating its
own
(`packages/vue-form/src/composables/use-as-form.ts:222-225`).

## Custom object renderer

Replace `AsObject` for one shape (e.g. an address card with a map
preview) via the components map:

```ts
import AddressCard from "./AddressCard.vue";
const components = { "address-card": AddressCard };
```

```atscript
@ui.form.component 'address-card'
address: {
    street: string
    city: string
}
```

Inside `AddressCard.vue`, iterate `field.objectDef.fields` with
`<AsField>` to recurse into the children (or use `AsIterator` for the
default grid):

```vue
<script setup lang="ts">
import { AsField, AsFieldShell, type TAsComponentProps } from "@atscript/vue-form";
const props = defineProps<TAsComponentProps>();
</script>

<template>
  <AsFieldShell v-bind="$props">
    <template #default>
      <div v-for="child of props.field.objectDef.fields" :key="child.name">
        <AsField :field="child" />
      </div>
    </template>
  </AsFieldShell>
</template>
```

`AsFieldShell` keeps the label/description/error chrome consistent
with built-in object fields.

For a renderer that replaces the object's chrome entirely and re-lays-out its
children — a tabbed shell, side-nav, or wizard — reach for the container-renderer
kit (`useAsVisibleFields`, `useAsFieldScope`, `useAsOptionalField`,
`useAsLevel` / `provideAsNestedLevel`, and `AsIterator`'s `:fields` / `:path-prefix`
/ `:levels` props). See [Container renderers](/forms/custom-components#container-renderers).

## Dynamic visibility on nested fields

Combine nesting with `@ui.form.fn.*` for context-aware children:

```atscript
@meta.label 'Room'
@ui.form.fn.hidden '(v, data) => !data.contact?.department?.floor'
room?: string
```

`data` is always the **whole form's** domain data — so
`data.contact?.department?.floor` works from any depth. See
[Dynamic Fields](/forms/dynamic-fields).

## Next steps

- [Arrays](/forms/arrays) — array-of-objects and nested arrays.
- [Dynamic Fields](/forms/dynamic-fields) — context-aware sections.
- [Grid Layout](/forms/grid-layout) — splitting nested fields across
  columns.
