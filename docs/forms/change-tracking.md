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
template ref) you get the same members:

| Member              | Type                                 | What it gives you                                                                              |
| ------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `isDirty`           | `boolean`                            | `true` when current data differs from the baseline.                                            |
| `changes`           | `readonly FormFieldChange[]`         | Reactive changed-fields list.                                                                  |
| `getChanges()`      | `() => FormFieldChange[]`            | Same list, built on demand (snapshot-safe).                                                    |
| `getPatch(opts?)`   | `(opts?) => Record<string, unknown>` | The `@atscript/db` patch object, built on demand.                                              |
| `isDirtyPath(path)` | `(path: string) => boolean`          | Did one specific field change? See [per-field dirty](#marking-changed-fields-per-field-dirty). |

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

## Marking changed fields — per-field dirty

The changes list answers _what_ changed; sometimes you want the inverse — given
**one field**, did it change? That's what powers a visual mark on every edited
input (an accent bar, a "modified" badge), so on an edit form the user sees at a
glance what they touched. Every field can read its own dirty state with zero
plumbing, derived from the same change model.

Inside a custom field component, [`useAsField()`](/forms/custom-components#useasfield)
returns an `isDirty` flag alongside `model` / `error` / `onBlur` — bind it to a
class or marker:

```ts
const { model, error, isDirty } = useAsField({
  getValue,
  setValue,
  path: () => fullPath,
});
// isDirty.value → true once this field differs from the baseline
```

Anywhere else under the form, ask the handle directly with `isDirtyPath(path)`:

```ts
const { isDirtyPath } = useAsFormPatch();
isDirtyPath("address.city"); // boolean
```

The framework-agnostic predicate behind both is
[`isPathDirty(changes, path)`](/api/ui#form-diff-engine) — reuse it in a non-Vue
renderer.

### What lights up

The predicate matches a field against the change list, whose granularity it
inherits (leaf-grained for scalars/objects, **whole-array** for arrays). A field
at `path` is dirty iff some change path equals `path` **or** starts with
`path + "."`:

- **scalar / leaf field** (incl. a nested leaf like `address.city`) — exact
  match.
- **object / section container** — _prefix_ match: the container has no change
  entry of its own, but it lights up because its changed leaves are nested under
  it.
- **whole-array field** — exact match: the array diff emits a single change at
  the array root.
- **a field rendered for an array-_item_ leaf** (e.g. `items.0.qty`) — **not
  detectable.** The whole-array diff exposes no per-item paths, so this returns
  `false`; the array / iterator **container** lights up instead. Known,
  documented limitation.
- **empty path `''`** (the wrapped form root) — dirty iff there are _any_
  changes.

No false positives: a field `item` never matches a change at `items` (the prefix
is `path + "."`, not a bare string compare). And when `track-changes` is off,
every path reads `false` and `useAsField().isDirty` stays `false` — the handle is
injected optionally, so it never throws.

### The default marker (and how to restyle it)

Out of the box, each default field paints `data-dirty=""` on its root when it's
dirty (the attribute is present when dirty, absent when clean), and
`@atscript/ui-styles` draws a subtle `scope-primary` left accent bar via the
`as-default-field` shortcut's `[&:is([data-dirty])]:` variant. It is
deliberately restrained — a glance, not a shout.

To change or disable the look, override that one shortcut entry in your own
vunor shortcuts — no need to touch the component:

```ts
import { defineShortcuts } from "vunor/theme";

defineShortcuts({
  "as-default-field": {
    // recolor, swap for a badge, or set to "" to drop the marker entirely
    "[&:is([data-dirty])]:before:": 'content-[""] absolute ...',
  },
});
```

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
as `ComputedRef`s, plus `getPatch`, `getChanges`,
[`isDirtyPath`](#marking-changed-fields-per-field-dirty), `rebase` and
[`rebaseOnto`](#folding-in-fresh-server-data-rebaseonto). It **throws a
clear error** when called outside a form, or inside a form that did not
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
asForm.value.isDirtyPath(path); // did one field change? → boolean
asForm.value.rebase(); // re-baseline to current data
asForm.value.rebaseOnto(upstream, opts?); // fold in fresh server data → { conflicts, reapplied }
```

When `track-changes` is **off**, these still exist and are safe to call —
`isDirty` is `false`, `changes` is empty, and `getPatch()` returns `{}` —
so a generic parent can call them unconditionally without a feature check.

### After a successful save — `rebase()`

After the server confirms the write, call `rebase()` to make the current
data the new baseline. The form becomes clean (`isDirty === false`)
without a remount, and the next edit diffs against the just-saved state.
`reset()` re-baselines too, so a "discard changes" button is free.

## Folding in fresh server data — `rebaseOnto()`

`rebase()` re-baselines to the form's _current_ data, and a hard reset
(replacing `formData`) throws unsaved edits away. Neither folds **fresh
server data into a form that already has unsaved local edits** — which is
exactly what you need when the server writes to a bound field out of band,
when a post-save reload picks up server-computed fields while other
sections are still dirty, or when two people edit the same row at once.

`rebaseOnto()` is that 3-way merge. It sets the baseline to the fresh
upstream snapshot and reapplies the user's local diff on top: fields the
user never touched adopt the server's new values, and the user's own edits
survive — all in a single reactive write, no remount.

```ts
const fresh = await table.one(props.id); // wrapped { value: domainData }
const { conflicts } = asForm.value.rebaseOnto(fresh, { conflict: "ours" });
if (conflicts.length) {
  notify("Some fields changed on the server", "Kept your edits to: " + conflicts.join(", "));
}
```

`upstream` is the **wrapped** container — the same `{ value: domainData }`
shape you bind to `:form-data`. The call returns
`{ conflicts, reapplied }`: `conflicts` is the list of paths edited on both
sides to _different_ values, and `reapplied` is the surviving local diff
(exactly what `getChanges()` reports after the rebase).

### Conflict policy

A field changed on **only one side** never conflicts — a local-only edit
reapplies, an upstream-only change flows in. A field changed on **both
sides to the same value** isn't a conflict either (revert-aware — it drops
out clean). Only a field changed on both sides to a _different_ value is a
conflict, and `opts.conflict` decides who wins:

- `'ours'` (default) — keep the local edit; the path is still recorded in
  `conflicts` so you can tell the user what diverged.
- `'theirs'` — take upstream's value and drop the local edit; the path is
  still recorded.

Either way you get the full conflict list back, so a "kept your edits"
(or "took the server's") toast is one line.

### What to keep in mind

- **Keyed arrays merge whole-array.** If both sides touch the same array,
  it's one whole-array conflict resolved by `opts.conflict` — there's no
  per-element 3-way merge. (Nested objects are leaf-grained: a local leaf
  edit and an upstream sibling-leaf change both survive.)
- **Tracking off is a no-op.** With no `track-changes`, `rebaseOnto()`
  returns `{ conflicts: [], reapplied: [] }` and does nothing — mirroring
  `rebase()` / `getPatch()`. To discard-and-adopt on a non-tracking form,
  assign your bound ref yourself.
- **Upstream values validate immediately.** Server-introduced values are
  treated as edits, so under the default on-change strategy they validate
  the moment they land — they are not suppressed as "fresh".

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
round-trips through `$cas`. After a
[`rebaseOnto()`](#folding-in-fresh-server-data-rebaseonto), the new
baseline carries upstream's version, so the next `getPatch()` lifts `$cas`
against the fresh version automatically — provided upstream carries the
version column. The server bumps it on every successful write;
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
- `buildFormRebase` / `applyFormChanges` — the framework-agnostic 3-way
  merge behind `rebaseOnto()` (and the pure change-list applier it builds
  on), exported from `@atscript/ui` for non-Vue reuse. See
  [API: `@atscript/ui`](/api/ui#form-diff-engine).
- `isPathDirty(changes, path)` — the framework-agnostic per-field dirty
  predicate behind `isDirtyPath` / `useAsField().isDirty`, exported from
  `@atscript/ui` for non-Vue reuse. See
  [API: `@atscript/ui`](/api/ui#form-diff-engine).
- `AsFormPatchHandle`, `RebaseOntoResult`, `FormFieldChange`,
  `FormDiffOptions`, `FormRebaseOptions` — types exported from
  `@atscript/vue-form` / `@atscript/ui`. See
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
