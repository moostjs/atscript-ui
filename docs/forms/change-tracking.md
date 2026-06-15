---
outline: deep
---

# Change tracking

By default `<AsForm>` is a fire-and-once affair: the user fills it in, hits
submit, and `@submit` hands you the whole domain object. That is exactly
right for "create" flows. **Edit** flows want something narrower — was
anything changed at all, _which_ fields changed, and a minimal patch that
updates only those fields instead of overwriting the whole row.

Atscript-ui ships an opt-in change tracker for precisely this. Turn it on
and the form gives you two outputs against the data it was first handed:

- a **changed-fields list** — `{ path, kind, before, after }` per field, and
- an **[`@atscript/db`](https://db.atscript.dev) patch object** — flat,
  keyed by field, ready to feed straight into `table.updateOne()`.

Both are revert-aware: a value edited and then edited back to its original
drops out of the list, and the form reports itself clean again.

## Opt in

Change tracking is **off by default** — zero overhead when you don't ask
for it. Enable it per form with the `track-changes` prop:

```vue
<AsForm :def="def" :form-data="formData" :types="types" track-changes @submit="onSubmit" />
```

If you drive the form through the composable instead of the component, pass
`trackChanges`:

```ts
import { useAsForm } from "@atscript/vue-form";

const form = useAsForm({
  def: () => def,
  formData: () => formData,
  trackChanges: () => true,
});
```

When tracking is on, the form captures a deep-clone **baseline** of its
data the moment real data is available (it waits for an async
`:form-data` ref to resolve, so a fetch-then-fill edit page baselines the
loaded row, not the empty placeholder). Every output is computed against
that baseline.

::: tip Baseline vs. live data
The baseline is a frozen, proxy-free snapshot. The form keeps editing the
live container; the tracker never mutates the baseline, so the diff stays
accurate no matter how much the user changes. Re-baseline after a
successful save with [`rebase()`](#after-a-successful-save-rebase).
:::

## The two outputs

Everywhere the tracking surface is exposed (slots, descendant composable,
template ref) you get the same four members:

| Member            | Type                                 | What it gives you                                   |
| ----------------- | ------------------------------------ | --------------------------------------------------- |
| `isDirty`         | `boolean`                            | `true` when current data differs from the baseline. |
| `changes`         | `readonly FormFieldChange[]`         | Reactive changed-fields list.                       |
| `getChanges()`    | `() => FormFieldChange[]`            | Same list, built on demand (snapshot-safe).         |
| `getPatch(opts?)` | `(opts?) => Record<string, unknown>` | The `@atscript/db` patch object, built on demand.   |

### The changes list

Each entry is a `FormFieldChange` — `{ path, kind, before, after }`, where
`path` is the dot-path relative to the form root (`"address.city"`) and `kind`
is `"set"` (scalar / object / union / tuple) or `"array"` (membership or item
content). Full signature in the
[API reference](/api/ui#form-diff-engine).

Use it to render a "you changed N fields" summary, a confirm-before-leave
prompt, or a diff preview. It is reactive — bind it straight into a
template.

### The patch object

`getPatch()` returns an `@atscript/db`
[patch object](https://db.atscript.dev/api/update-patch): flat, keyed by
field name, holding only what changed. Empty `{}` when nothing changed.
Hand it directly to a table client's `updateOne` (or a moost-db REST
`update`) — no manual field-picking:

```ts
const patch = asForm.value.getPatch();
// → { name: "New name", "address": { ... } }  // only changed fields
await table.updateOne({ id, ...patch });
```

`getPatch()` and `getChanges()` snapshot a frozen, proxy-free copy of the
current data at call time, so they are safe to call at submit time —
even mid-edit. They never hand a live Vue proxy onto the wire, and a later
keystroke can't mutate a patch you already built.

## End to end

A complete edit page: load a row, enable tracking, gate a Save button on
`isDirty` in the footer slot, build the patch on save, and re-baseline so
the form goes clean again — all without a remount.

```vue
<script setup lang="ts">
import { ref, watch } from "vue";
import { AsForm, createDefaultTypes, createAsFormDef } from "@atscript/vue-form";
import { Product } from "../forms/Product.as";

const props = defineProps<{ id: string | number }>();
const types = createDefaultTypes();

const asForm = ref<InstanceType<typeof AsForm> | null>(null);
const { def, formData } = createAsFormDef(Product);

// Fetch the row and fill the wrapped container. The tracker baselines the
// loaded row once `formData.value` resolves to real data.
async function load() {
  formData.value = await table.one(props.id);
}
watch(() => props.id, load, { immediate: true });

async function onSave() {
  const patch = asForm.value!.getPatch();
  if (Object.keys(patch).length === 0) return; // nothing to do
  await table.updateOne({ id: props.id, ...patch });
  asForm.value!.rebase(); // form is clean again — no remount
}
</script>

<template>
  <AsForm ref="asForm" :def="def" :form-data="formData" :types="types" track-changes hide-submit>
    <template #form.footer="{ isDirty }">
      <button type="button" :disabled="!isDirty" @click="onSave">Save</button>
    </template>
  </AsForm>
</template>
```

`hide-submit` suppresses the built-in Submit button so the footer owns the
save affordance. The Save button is dead until the user changes something,
and goes dead again the instant they revert their edits.

Every `<AsForm>` slot receives the tracking surface — `#form.footer`,
`#form.header`, `#form.before`, `#form.after`. Reach for whichever slot
fits your chrome:

```vue
<template #form.header="{ changes }">
  <p v-if="changes.length">{{ changes.length }} unsaved change(s)</p>
</template>
```

## Save button in a descendant — `useAsFormPatch()`

When the Save button doesn't live in a slot — it's in a toolbar, a dialog
footer, or any component nested _under_ `<AsForm>` — inject the same handle
with `useAsFormPatch()`:

```vue
<script setup lang="ts">
import { useAsFormPatch } from "@atscript/vue-form";

const { isDirty, getPatch } = useAsFormPatch();

function save() {
  emit("save", getPatch());
}
</script>

<template>
  <button :disabled="!isDirty" @click="save">Save</button>
</template>
```

`useAsFormPatch()` returns an `AsFormPatchHandle` — `isDirty` and `changes`
as `ComputedRef`s, plus `getPatch`, `getChanges` and `rebase`. It **throws
a clear error** when called outside a form, or inside a form that did not
enable `track-changes`. That's deliberate: a Save button that silently
reports "not dirty" because tracking was never turned on is worse than one
that fails loudly at development time.

## Parent template ref — the `defineExpose` surface

A parent that owns `<AsForm>` via a template ref gets the tracking surface
on the instance, alongside the form's own controls:

```ts
asForm.value.submit(); // trigger validation + @submit
asForm.value.reset(); // reset to defaults (also re-baselines the tracker)
asForm.value.isDirty; // boolean
asForm.value.changes; // FormFieldChange[]
asForm.value.getPatch(opts?); // @atscript/db patch
asForm.value.getChanges(); // FormFieldChange[]
asForm.value.rebase(); // re-baseline to current data
```

When `track-changes` is **off**, these still exist and are safe to call —
`isDirty` is `false`, `changes` is empty, and `getPatch()` returns `{}` —
so a generic parent can call them unconditionally without a feature check.

### After a successful save — `rebase()`

After the server confirms the write, call `rebase()` to make the current
data the new baseline. The form becomes clean (`isDirty === false`)
without a remount, and the next edit diffs against the just-saved state.
`reset()` re-baselines too, so a "discard changes" button is free.

## Optimistic concurrency — `$cas`

If your row can be edited from more than one place at once, a plain
read-modify-write is unsafe: whoever saves second silently clobbers the
first. Atscript-ui lifts the `@atscript/db`
[optimistic-concurrency](https://db.atscript.dev/api/versioning) (OCC)
mechanism into the patch automatically.

Annotate one integer column on your type with `@db.column.version`:

```atscript
@meta.label 'Version'
@db.column.version
version: number.int
```

Now `getPatch()` carries a top-level `$cas` sibling so the write only
succeeds if the row is still at the version the form loaded:

```ts
asForm.value.getPatch();
// → { name: "New name", $cas: { version: 7 } }
```

The version column is **never emitted as a normal field** — it is
server-managed, and a direct write to it is rejected. It only ever
round-trips through `$cas`. The server bumps it on every successful write;
a stale submission is rejected (your table client surfaces this as a
version-mismatch error you can catch and turn into a "row changed, reload"
prompt).

`$cas` lifts automatically when **all** of these hold:

- the type has a `@db.column.version` field,
- `opts.cas !== false` (it defaults to `true`), and
- the baseline version value is an integer (i.e. the loaded row was
  actually populated).

Opt out for a specific call with `getPatch({ cas: false })`.

::: tip See also
For the full OCC story — version-column schema sync, catching the
mismatch error in your submit handler, and the table edit-page wiring —
see [Edit forms with optimistic concurrency](/tables/edit-form-occ) and
the [atscript-db versioning reference](https://db.atscript.dev/api/versioning).
:::

## Limits & trade-offs

The patch is derived purely by diffing two values, so it honours the same
boundaries as the `@atscript/db`
[patch engine](https://db.atscript.dev/api/update-patch). These are
honest trade-offs, not bugs — surface them when you design the edit flow.

### Absolute values only — no `$inc`/`$dec`/`$mul`

A value diff can tell you a counter went from `5` to `6`; it cannot tell
you the user _meant_ "add one". Arithmetic is intent, not something
derivable from before/after, so the patch always emits the absolute
result (`{ count: 6 }`), never a `$inc`. If you need atomic field ops, set
them on the patch yourself rather than expecting the tracker to infer
them.

### Nested objects — replace by default, opt into merge

A changed nested object is emitted whole — the **replace** strategy. Edit
one field of `address` and the patch carries the entire `address`
sub-object. That's the safe default. If you want changed-leaves-only
partials (and atomic ops on nested fields), annotate the parent field
`@db.patch.strategy 'merge'` on the `.as` type — then the diff emits just
the touched sub-fields. See
[nested patch strategies](https://db.atscript.dev/api/update-patch).

### Arrays — keyed diff, with fallbacks

For a **keyed** array (items carry a key), the diff is fine-grained:
changed items become `$update` (key + changed leaves), new items
`$insert`, dropped items `$remove` (key only). The diff falls back to a
whole-array `$replace` when it can't compute a stable per-item diff — a
pure reorder, duplicate keys, or keyless items. Unkeyed / primitive
arrays always `$replace` (a `uniqueItems` primitive array may use
by-value `$insert`/`$remove` instead).

### `$cas` needs a populated integer version

`$cas` only lifts when the baseline version is an integer. A row loaded
without its version column, or a `null`/missing version, produces a patch
with no `$cas` — the write proceeds last-write-wins. Make sure your load
query selects the version column if you rely on OCC.

## Reference

- `buildFormDiff(def, baseline, current, opts?)` — the framework-agnostic
  engine behind all of this, exported from `@atscript/ui`. Both
  `baseline` and `current` are the wrapped `{ value: domainData }`
  container. See [API: `@atscript/ui`](/api/ui).
- `AsFormPatchHandle`, `FormFieldChange`, `FormDiffOptions` — types
  exported from `@atscript/vue-form` / `@atscript/ui`. See
  [API: `@atscript/vue-form`](/api/vue-form).

## Next steps

- [Edit forms with optimistic concurrency](/tables/edit-form-occ) — the
  full table edit-page wiring and version-mismatch handling.
- [atscript-db: Update & Patch](https://db.atscript.dev/api/update-patch)
  — patch ops, nested strategies, keyed-array operators.
- [atscript-db: Optimistic Concurrency](https://db.atscript.dev/api/versioning)
  — `@db.column.version`, `$cas`, schema sync.
- [Actions](/forms/actions) — declare extra buttons (Save draft, Discard)
  as phantom fields.
