# form-change-tracking

Opt-in dirty tracking + `@atscript/db` patch building for `<AsForm>`: enable
`track-changes`, gate Save on `isDirty`, feed `getPatch()` to
`table.updateOne()`, `rebase()` after a save. Revert-aware; `$cas` OCC auto-lifts
from `@db.column.version`.

## Contents

- [Quick start](#quick-start)
- [Invariants](#invariants)
- [Key imports](#key-imports)
- [References](#references)
- [See also](#see-also)

## Quick start

Turn it on with the boolean `track-changes` prop (composable form:
`useAsForm({ trackChanges: () => true })`). OFF by default = zero overhead. Gate
a Save button on `isDirty` in `#form.footer`, hand `getPatch()` to your table
client, and `rebase()` after the write so the form goes clean again — no remount.

```vue
<script setup lang="ts">
import { ref, watch } from "vue";
import { AsForm, createAsFormDef, createDefaultTypes } from "@atscript/vue-form";
import { Product } from "../forms/Product.as";

const props = defineProps<{ id: string | number }>();
const types = createDefaultTypes();
const asForm = ref<InstanceType<typeof AsForm> | null>(null);
const { def, formData } = createAsFormDef(Product);

// Fetch-then-fill: the tracker baselines once `formData.value` is real data.
watch(
  () => props.id,
  async () => {
    formData.value = await table.one(props.id);
  },
  { immediate: true },
);

async function onSave() {
  const patch = asForm.value!.getPatch(); // @atscript/db patch — only changed fields
  if (Object.keys(patch).length === 0) return; // nothing to do
  await table.updateOne({ id: props.id, ...patch });
  asForm.value!.rebase(); // form is clean again
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

`hide-submit` because an empty `<template #form.submit />` does NOT suppress the
default button (forms invariant 5) — the footer owns the save affordance.

### Three surfaces, one handle

The same four-member tracking surface (`isDirty`, `changes`, `getPatch`,
`getChanges`) reaches you three ways — pick by where the Save control lives:

| Surface                              | Reach it via                                         | When                                                     |
| ------------------------------------ | ---------------------------------------------------- | -------------------------------------------------------- |
| Slot props (every `<AsForm>` slot)   | `<template #form.footer="{ isDirty, getPatch }">`    | Save button lives in a form slot (footer/header/before). |
| Descendant composable                | `const { isDirty, getPatch } = useAsFormPatch()`     | Save button is nested UNDER `<AsForm>` (toolbar/dialog). |
| Parent template ref (`defineExpose`) | `asForm.value.getPatch()` / `.rebase()` / `.reset()` | A parent owns `<AsForm>` and drives it from outside.     |

`useAsFormPatch()` also exposes `rebase()`; `isDirty`/`changes` arrive as
`ComputedRef`s there (plain values in slot props / on the instance).

## Invariants

| #   | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Off by default = zero overhead.** No `track-changes` → no baseline snapshot, no deep watch, no provide. The slot-prop / `defineExpose` members still exist and are safe no-ops: `isDirty` is `false`, `changes` is empty, `getPatch()` returns `{}` — a generic parent calls them unconditionally without a feature check.                                                                                                           |
| 2   | **`useAsFormPatch()` THROWS when tracking is off** (or when called outside a form). Deliberate: a Save button that silently reports "not dirty" because `track-changes` was never set is worse than a loud dev-time failure. Slot props and `defineExpose` are the safe-no-op surfaces; the injector is the strict one.                                                                                                                |
| 3   | **`getPatch()` / `getChanges()` snapshot a frozen, proxy-free clone at call time.** Safe to call at submit time AND mid-edit — a later keystroke can't mutate a patch you already built, and no live Vue reactive proxy ever reaches the wire. (`buildFormDiff` itself returns LIVE references into `current`; the Vue layer clones `current` first to de-alias.)                                                                      |
| 4   | **Revert-aware.** A value edited and then edited back to its baseline drops out of `changes` and the patch; `isDirty` flips back to `false`. `NaN` equals `NaN` for this purpose; `getPatch()` is `{}` when nothing (net) changed.                                                                                                                                                                                                     |
| 5   | **The patch is an `@atscript/db` patch — ready for `table.updateOne()`.** Flat, keyed by field name, holding only changed fields. Hand `{ id, ...patch }` straight to a table client's `updateOne` (or a moost-db REST `update`) — no manual field-picking.                                                                                                                                                                            |
| 6   | **Nested objects REPLACE by default.** Edit one leaf of `address` and the whole `address` sub-object rides the patch (safe default). For changed-leaves-only partials, annotate the parent field `@db.patch.strategy 'merge'` on the `.as` type. `merge` does NOT propagate — a descendant object without its own `merge` again emits its full sub-object.                                                                             |
| 7   | **Keyed arrays diff fine-grained; fall back to `$replace`.** Items with `@expect.array.key` → `$update` (key + changed leaves), `$insert` (new), `$remove` (key only). Falls back to whole-array `$replace` on a pure reorder, duplicate keys, or keyless items. Unkeyed / primitive arrays always `$replace` (a `@expect.array.uniqueItems` primitive array may use by-value `$insert`/`$remove`).                                    |
| 8   | **Absolute values only — never `$inc`/`$dec`/`$mul`.** A value diff sees `5 → 6`, not the intent "add one". The patch emits the absolute result. Set atomic field ops on the patch yourself if you need them.                                                                                                                                                                                                                          |
| 9   | **`$cas` OCC lifts automatically** when ALL hold: the type has a `@db.column.version` field, `opts.cas !== false` (default `true`), AND the baseline version is a populated integer. Result carries `$cas: { [versionColumn]: baselineVersion }`. Opt out per call with `getPatch({ cas: false })`. A `null`/missing/non-integer version → no `$cas` (proceeds last-write-wins; make sure your load query selects the version column). |
| 10  | **The version column is NEVER emitted as a SET.** It is server-managed (a direct write is rejected by `@atscript/db`); it only ever round-trips through `$cas`. Excluded from the field diff regardless of `opts.cas`.                                                                                                                                                                                                                 |
| 11  | **`rebase()` after a successful save; `reset()` re-baselines too.** `rebase()` makes current data the new baseline → form clean (`isDirty === false`) without a remount, next edit diffs the just-saved state. `reset()` (re-applies defaults) also re-baselines, so a "discard changes" button is free.                                                                                                                               |
| 12  | **Baseline is captured once real data is available.** With an async `:form-data` ref the tracker waits for `formData.value` to resolve to real data, so a fetch-then-fill edit page baselines the LOADED row, not the empty placeholder.                                                                                                                                                                                               |

## Key imports

```ts
// Vue surface
import { useAsFormPatch } from "@atscript/vue-form";
import type { FormFieldChange, FormDiffOptions } from "@atscript/vue-form"; // re-exported from @atscript/ui

// Framework-agnostic engine (the diff behind all of the above)
import { buildFormDiff } from "@atscript/ui";
import type { FormFieldChange, FormDiffResult, FormDiffOptions } from "@atscript/ui";
```

`buildFormDiff(def, baseline, current, opts?)` — `baseline` and `current` are
both the WRAPPED `{ value: domainData }` container; returns
`{ isDirty, changes, patch }`. `useAsFormPatch()` returns an `AsFormPatchHandle`
(`isDirty` / `changes` as `ComputedRef`, `getPatch` / `getChanges` / `rebase`).
The `track-changes` prop on `<AsForm>` enables it; `useAsForm({ trackChanges })`
is the composable equivalent.

## References

| Domain                      | File                                                     | When                                                                                           |
| --------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Vue handle + provide/inject | `packages/vue-form/src/composables/use-as-form-patch.ts` | `useAsFormPatch()` contract, baseline lifecycle, snapshot/clone semantics, throw-when-off.     |
| `track-changes` prop wiring | `packages/vue-form/src/components/as-form.vue`           | Where the prop maps to `trackChanges`; the `defineExpose` surface on the instance.             |
| Slot-prop bag + reset path  | `packages/vue-form/src/composables/use-as-form.ts`       | `isDirty`/`changes`/`getPatch`/`getChanges` in slot props; `reset()` calling `rebase()`.       |
| Diff engine + patch shape   | `packages/ui/src/form/diff.ts`                           | `buildFormDiff`, nested replace/merge, keyed-array ops, `$cas` lift, version-column exclusion. |

## See also

- Docs: https://ui.atscript.dev/forms/change-tracking
- API: https://ui.atscript.dev/api/vue-form, https://ui.atscript.dev/api/ui
- OCC server-side mechanics (`@db.column.version`, `$cas`, `VersionMismatchError`): the `atscript-db` skill, and the [OCC-enabled edit forms](../SKILL.md) section of this skill.
