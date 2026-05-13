# structural-fields

Arrays, nested objects, discriminated unions, and tuples — composables, path nesting, variant detection, and the shared nested-sections store.

## Contents

- [Arrays — useAsArray contract](#arrays--useasarray-contract)
- [Array patterns](#array-patterns)
- [AsArray default component](#asarray-default-component)
- [Nested objects — AsObject](#nested-objects--asobject)
- [Path nesting](#path-nesting)
- [provideAsNestedSectionsStore / useAsNestedSectionsStore](#provideasnestedsectionsstore--useasnestedsectionsstore)
- [Discriminated unions — AsUnion](#discriminated-unions--asunion)
- [Variant switching wipes data](#variant-switching-wipes-data)
- [Tuples — AsTuple](#tuples--astuple)

## Arrays — useAsArray contract

```typescript
import { useAsArray } from "@atscript/vue-form";

const props = defineProps<TAsComponentProps>();
const arr = useAsArray(props.field as FormArrayFieldDef, disabledRef);
```

| Return                       | Type                                            | Notes                                                                                                                                    |
| ---------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `arrayValue`                 | `ComputedRef<unknown[]>`                        | The current array. Empty array when the model is `undefined` or non-array.                                                                |
| `itemKeys`                   | `string[]` (reactive)                           | Stable per-item keys (`as-item-0`, `as-item-1`, ...). Use as `<template v-for :key>` to avoid remounting siblings on splice.              |
| `getItemField(index, name?)` | `(index, name?) => FormFieldDef`                | Cloned item field with `path: String(index)`. Caches by index; invalidated on splice ≥ index.                                            |
| `addItem(variantIndex?)`     | `(variantIndex = 0) => void`                    | Appends a new item created via `createFormData`. For union-item arrays, picks variant by index.                                          |
| `removeItem(index)`          | `(index) => void`                               | Splices at `index`. Respects `canRemove`.                                                                                                |
| `clear()`                    | `() => void`                                    | Optional array → set `undefined`; required array → `length = 0`.                                                                         |
| `canAdd`                     | `ComputedRef<boolean>`                          | `false` when disabled OR `length >= @expect.maxLength`.                                                                                  |
| `canRemove`                  | `ComputedRef<boolean>`                          | `false` when disabled OR `length <= @expect.minLength`.                                                                                  |
| `isOptional`                 | `boolean`                                       | Captured from `field.prop.optional` at setup.                                                                                            |
| `isEmpty`                    | `ComputedRef<boolean>`                          | `arrayValue.length === 0`.                                                                                                               |
| `isUnion`                    | `boolean`                                       | Whether the item type is a discriminated union.                                                                                          |
| `unionVariants`              | `FormUnionVariant[]`                            | Variant list when `isUnion`; empty array otherwise.                                                                                      |

The composable dispatches the same change types the form emits: `'array-add'` on `addItem`, `'array-remove'` on `removeItem` and `clear`.

Source: `packages/vue-form/src/composables/use-as-array.ts:12-164`.

### Length constraints

```atscript
@expect.minLength 1, 'At least one tag required'
@expect.maxLength 10
tags: string[]
```

`useAsArray` reads these to drive `canAdd` / `canRemove`. The minLength rule also fires through the validator on submit.

### Singular label

```atscript
@ui.form.label.singular 'Tag'
tags: string[]
```

Drives "Add Tag" affordance text. AsField pulls the value via `resolveSingularLabel(prop)` — falls back to the item field's `@ui.form.label.singular`, then to literal `'item'`. (See `as-field.vue:312-316`.)

## Array patterns

### Scalar array

```atscript
@ui.form.label.singular 'Tag'
@expect.minLength 1
tags: string[]
```

Each item is a `text` field. `name` falls back to a `#N` suffix for the label.

### Object array

```atscript
interface Address {
    @meta.label 'Street'
    street: string

    @meta.label 'City'
    city: string
}

@ui.form.label.singular 'Address'
addresses: Address[]
```

Each item renders as an `AsObject` (collapsible — see below).

### Nested array

```atscript
@ui.form.label.singular 'Phone'
phoneNumbers: string[][]   // array of arrays
```

`useAsArray` invariants compose — each level paths as `parent.0.0`, etc.

### Union-item array

```atscript
interface CreditCard { type: 'card', number: string }
interface BankTransfer { type: 'bank', iban: string }

paymentMethods: (CreditCard | BankTransfer)[]
```

`useAsArray` sets `isUnion = true` and exposes `unionVariants`. The default `AsArray` renders a per-item variant picker; calling `addItem(variantIndex)` adds the chosen variant.

## AsArray default component

Built against `useAsArray`. Renders:

- Header (label + count) — only when `level > 0` (root arrays use the form's chrome).
- Item list with stable keys.
- Add affordance (when `canAdd`).
- Per-item remove button (when `canRemove`).
- Empty-state placeholder (when `isEmpty` and `isOptional` and the model is `undefined`).

Swap it via `:types="{ ...createDefaultTypes(), array: MyDnDList }"` for drag-reorder / virtualization. Re-use `useAsArray` inside your custom component to inherit `addItem` / `removeItem` / `canAdd` semantics.

## Nested objects — AsObject

`AsObject` renders the fields of a nested structure. Two modes:

| Position           | Mode                                       | Chrome                                                                       |
| ------------------ | ------------------------------------------ | ---------------------------------------------------------------------------- |
| Root (`level === 0`) | Flat grid via `AsIterator`                | No collapsible wrapper. `hideRootTitle` prop on AsForm suppresses the title. |
| Nested (`level > 0`) | Wrapped in `AsCollapsible`                | Click to expand/collapse. Open state shared via `useAsNestedSectionsStore`. |

The nesting level is provided downward by AsField via `LEVEL_KEY` — incremented for every nested structured field or union.

Source: `packages/vue-form/src/components/as-field.vue:134-152`.

## Path nesting

AsField provides `PATH_PREFIX_KEY` (reactive `ComputedRef<string>`) when it's a structured/union container. Children consume it to compute absolute paths.

`useFormContext(componentName)` exposes everything you need to walk paths and read form data:

```typescript
const {
  rootFormData,    // () => Record<string, unknown> — domain data
  pathPrefix,      // ComputedRef<string>
  formContext,     // ComputedRef<Record<string, unknown>>
  joinPath,        // (segment | () => segment) => ComputedRef<string>
  buildPath,       // (segment: string) => string  (non-reactive)
  getByPath,       // (path: string) => unknown
  setByPath,       // (path: string, value: unknown) => void
  buildScope,      // (v?, entry?) => TFnScope
} = useFormContext<TFormData, TFormContext>("MyComponent");
```

`joinPath('items.0')` returns a reactive ref; use it when the segment can change (e.g. dynamic array index). `buildPath` is the synchronous flavour — cheaper inside a one-shot computed.

Source: `packages/vue-form/src/composables/use-form-context.ts:22-87`.

## provideAsNestedSectionsStore / useAsNestedSectionsStore

Page-level reactive store of open/closed paths for collapsible object sections.

```typescript
export interface AsNestedSectionsStore {
  open: Ref<Set<string>>;
  register: (id: string) => void;
  unregister: (id: string) => void;
  toggle: (id: string) => void;
  setOpen: (id: string, open: boolean) => void;
  isOpen: (id: string) => boolean;
  expandAll: () => void;
  collapseAll: () => void;
  allOpen: () => boolean;
}
```

`AsForm` calls `provideAsNestedSectionsStore()` automatically. To drive Expand-all / Collapse-all from above the form, call it yourself in a parent component — `useAsForm` then re-uses your store instead of creating its own (`use-as-form.ts:224`).

```vue
<script setup lang="ts">
import { provideAsNestedSectionsStore, useAsNestedSectionsStore } from "@atscript/vue-form";

const sections = provideAsNestedSectionsStore();
</script>

<template>
  <button @click="sections.expandAll()">Expand all</button>
  <button @click="sections.collapseAll()">Collapse all</button>
  <AsForm :def="def" ... />
</template>
```

`AsForm` also auto-opens every ancestor of an error path so users see invalid fields immediately (`use-as-form.ts:238-248`).

Source: `packages/vue-form/src/composables/use-as-nested-sections-store.ts:1-98`.

## Discriminated unions — AsUnion

A union field renders one variant at a time. Variant detection happens by required-prop fingerprinting: at mount, `detectUnionVariant(modelValue, variants)` picks the variant whose required props all exist on the current value.

`useAsUnion(props)` for custom union components:

```typescript
import { useAsUnion } from "@atscript/vue-form";

const props = defineProps<TAsComponentProps>();
const u = useAsUnion(props);
// u.unionField              ComputedRef<FormUnionFieldDef | undefined>
// u.hasMultipleVariants     ComputedRef<boolean>          (false if only one variant)
// u.localUnionIndex         Ref<number>                   (current selected variant index)
// u.innerField              ComputedRef<FormFieldDef | undefined>   (synthesized child field)
// u.changeVariant(i)        switch to variant i; rewrites model.value to fresh instance
// u.optionalEnabled         ComputedRef<boolean>          (model !== null && !== undefined)
```

`innerField` is the synthesized FormFieldDef for the active variant — pass to `<AsField :field="u.innerField.value" />` to dispatch through normal AsField wiring (e.g. AsObject for a struct-variant, AsField for an itemField-variant).

Source: `packages/vue-form/src/composables/use-as-union.ts:13-97`.

## Variant switching wipes data

Invariant: `changeVariant(newIndex)` rewrites `model.value` to a fresh instance of the target variant's type (via `createFormData(variant.type, resolver)`).

**Within-mount stash.** `useAsUnion` keeps a `Map<number, unknown>` of per-variant data so toggling back inside the same mount restores the user's work. The stash is cleared on unmount.

```typescript
// Inside useAsUnion (use-as-union.ts:60-83):
function changeVariant(newIndex: number) {
  if (props.model?.value != null) {
    variantDataStash.set(localUnionIndex.value, props.model.value);
  }
  localUnionIndex.value = newIndex;
  const variant = unionField.value?.unionVariants[newIndex];
  if (variant && props.model) {
    const stashed = variantDataStash.get(newIndex);
    props.model.value = stashed !== undefined
      ? stashed
      : createFormData(variant.type, resolver).value;
  }
  handleChange("union-switch", unionPath.value, props.model?.value);
}
```

`null` / `undefined` values are intentionally NOT stashed — they would corrupt the initial-variant detection.

**Across-mount persistence.** If you need stash survival across unmounts (e.g. tabbed wizards), persist outside the union — into form context, localStorage, or a parent state container — and seed via the form's `formData` on remount.

`AsUnion`'s default also dispatches a `union-switch` change event so anything watching `@change` sees it.

## Tuples — AsTuple

Fixed-length, positionally-typed arrays. `useAsTuple(field, opts?)`:

```typescript
import { useAsTuple } from "@atscript/vue-form";

const t = useAsTuple(props.field as FormTupleFieldDef);
// t.itemFields        FormFieldDef[]    (one per position; .path = String(i))
// t.positionLabeled   boolean[]         (whether the position carries @meta.label)
// t.isOptional        boolean
// t.isEmpty           ComputedRef<boolean>
// t.clear()           clear an optional tuple (set undefined)
// t.fillMissing()     pad with createFormData defaults if length < itemFields.length
```

`fillMissing()` runs `onMounted` automatically when the tuple is not optional. Skip it for optional tuples — the user clicks "Add" to populate.

For each position:

- If `@meta.label` is set on the position, the label renders as the bold field title and `positionLabeled[i] === true`.
- Otherwise, the type name (`number` → `Number` after capitalization) renders as the base label, with `#N` suffix.

```atscript
type Coordinate = [
    @meta.label 'Latitude' number,
    @meta.label 'Longitude' number,
]
```

Source: `packages/vue-form/src/composables/use-as-tuple.ts:7-81`.
