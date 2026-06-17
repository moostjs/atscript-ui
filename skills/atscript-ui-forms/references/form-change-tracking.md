# form-change-tracking

Opt-in dirty tracking + `@atscript/db` patch building for `<AsForm>`: enable
`track-changes`, gate Save on `isDirty`, feed `getPatch()` to
`table.updateOne()`, `rebase()` after a save. `rebaseOnto()` (3-way merge) folds
fresh server data into a form with unsaved edits. Revert-aware; `$cas` OCC
auto-lifts from `@db.column.version`.

## Contents

- [Quick start](#quick-start)
- [Invariants](#invariants)
- [rebaseOnto — 3-way merge](#rebaseonto--3-way-merge)
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

The same read-side tracking surface (`isDirty`, `changes`, `getPatch`,
`getChanges`, `isDirtyPath`) reaches you three ways — pick by where the Save
control lives:

| Surface                              | Reach it via                                         | When                                                     |
| ------------------------------------ | ---------------------------------------------------- | -------------------------------------------------------- |
| Slot props (every `<AsForm>` slot)   | `<template #form.footer="{ isDirty, getPatch }">`    | Save button lives in a form slot (footer/header/before). |
| Descendant composable                | `const { isDirty, getPatch } = useAsFormPatch()`     | Save button is nested UNDER `<AsForm>` (toolbar/dialog). |
| Parent template ref (`defineExpose`) | `asForm.value.getPatch()` / `.rebase()` / `.reset()` | A parent owns `<AsForm>` and drives it from outside.     |

`useAsFormPatch()` also exposes `rebase()`; `isDirty`/`changes` arrive as
`ComputedRef`s there (plain values in slot props / on the instance).

## Per-field dirty

**What/when:** ask whether ONE field changed since baseline — to mark changed
inputs (an accent/badge). Derived from the same change model; zero plumbing per
field. OFF (no `track-changes`) ⇒ always `false`, never throws.

Reach it three ways:

| Reach it via                           | Returns                                | When                                              |
| -------------------------------------- | -------------------------------------- | ------------------------------------------------- |
| `useAsField().isDirty` (`ComputedRef`) | this field's dirty (its `path()`)      | inside a custom field component (the common case) |
| handle `isDirtyPath(path)`             | dirty at any dot-path, live (reactive) | check a specific path anywhere under the form     |
| `isPathDirty(changes, path)`           | pure predicate over a change list      | framework-agnostic / React reuse / a tooling pass |

`isDirtyPath` rides the handle, so it reaches you via `useAsFormPatch()`,
`<AsForm>` slot props, AND the template ref (`defineExpose`) — same three
surfaces as `isDirty`/`getPatch`. No-op `() => false` when tracking is off.

### Matching rules — what lights up

| #   | Field kind                                  | Match  | Result                                                                                                                          |
| --- | ------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | scalar / leaf (incl. nested `address.city`) | EXACT  | dirty iff a change path === the field path.                                                                                     |
| 2   | object / section container (`address`)      | PREFIX | no change at its own path; its leaves carry changes → dirty via `path + "."` prefix.                                            |
| 3   | whole-array field (`tags`)                  | EXACT  | the array diff emits ONE change at the array root → exact match.                                                                |
| 4   | array-ITEM leaf (`items.0.qty`)             | —      | **`false` — known limitation.** The whole-array diff exposes no per-item paths; the array/iterator CONTAINER lights up instead. |
| 5   | no `item` vs `items` false positive         | PREFIX | prefix is `path + "."`, so field `item` never matches a change at `items`. No false positives.                                  |
| 6   | empty root path `''`                        | ANY    | dirty iff there are ANY changes (the wrapped form root).                                                                        |
| 7   | tracking OFF                                | —      | `false` for every path; injected optionally, never throws.                                                                      |

### Default marker + override

`AsFieldShell` sets `data-dirty=""` (empty attr present when dirty, absent when
clean) on its `as-default-field` root. `@atscript/ui-styles` paints a subtle,
OVERRIDABLE `scope-primary` left accent bar via the `as-default-field`
shortcut's `[&:is([data-dirty])]:` variant (+ a `::before` bar). Restyle or
disable by re-defining just that one variant key in your vunor shortcuts —
e.g. `vunorShortcuts({ "as-default-field": { "[&:is([data-dirty])]:": "" } })`.

### Usage

```ts
// custom field component — per-field dirty for free
const { model, error, isDirty } = useAsField({ getValue, setValue, path: () => fullPath });
// bind isDirty to a class / badge in the template

// anywhere under the form (descendant / slot / template ref)
const { isDirtyPath } = useAsFormPatch();
isDirtyPath("address.city"); // boolean, reactive

// framework-agnostic predicate (React-reusable)
import { isPathDirty } from "@atscript/ui";
isPathDirty(changes, "address.city");
```

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

## rebaseOnto — 3-way merge

**What/when:** fold FRESH server data into a form that already has UNSAVED local
edits — baseline becomes `upstream`, the local diff is reapplied on top, so
untouched fields adopt the server's new values while the user's edits survive.
Use for out-of-band server writes to a bound field, post-save reloads that pick
up server-computed fields while other sections are dirty, and
concurrent/collaborative edits. NOT the same as `rebase()` (re-baselines to
CURRENT post-save data) or a hard reset (replaces `formData`, drops edits).

`rebaseOnto` is a METHOD on the `AsFormPatchHandle` — reach it via
`useAsFormPatch()` (descendant) or the `<AsForm>` template ref (`defineExpose`).
NOT a slot prop (mirrors `rebase()`; slot props stay `isDirty`/`changes`/`getPatch`/`getChanges`).

```ts
import { useAsFormPatch } from "@atscript/vue-form";
import type { FormRebaseOptions, RebaseOntoResult } from "@atscript/vue-form"; // FormRebaseOptions re-exported from @atscript/ui
// Framework-agnostic engine + helpers it composes:
import { buildFormRebase, applyFormChanges, deepEqual, deepClone } from "@atscript/ui";
import type { FormRebaseResult } from "@atscript/ui"; // FormRebaseOptions also origin-exported here (imported above from vue-form)
```

Signature: `rebaseOnto(upstream, opts?) → { conflicts: string[]; reapplied: FormFieldChange[] }`.
`upstream` = the WRAPPED `{ value: domainData }` container (same shape as `:form-data`).
`opts = { conflict?: 'ours' | 'theirs' }`. `conflicts` = paths edited on both
sides to DIFFERENT values (plus an ancestor path when upstream cleared a subtree
the user still edited under). `reapplied` = the surviving local diff = what
`getChanges()` returns after the rebase.

| #   | Invariant                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **`upstream` is the WRAPPED container.** Pass `{ value: domainData }` (same shape as `:form-data` / what a table client's `one()` returns), not the bare domain object.                                                                                                              |
| 2   | **Conflict policy = `opts.conflict`.** `'ours'` (default) keeps the local edit; `'theirs'` takes upstream's value and drops the local edit. EITHER way the path is recorded in `conflicts`. Changed on only ONE side never conflicts (local-only reapplies; upstream-only flows in). |
| 3   | **Same value on both sides is NOT a conflict.** Revert-aware: if local and upstream landed the identical value it drops out clean (no entry in `conflicts`, `next` already holds it).                                                                                                |
| 4   | **Keyed arrays merge WHOLE-ARRAY.** If both sides touch the same array it is ONE whole-array conflict resolved by `opts.conflict` — no per-element 3-way merge.                                                                                                                      |
| 5   | **Nested objects are LEAF-grained.** A local leaf edit + an upstream sibling-leaf change BOTH survive, independent of the field's `@db.patch.strategy` patch granularity.                                                                                                            |
| 6   | **Fetch-then-fill adopt.** No baseline yet (async data not resolved) → adopts `upstream` wholesale and returns `{ conflicts: [], reapplied: [] }`; no local diff exists to reapply.                                                                                                  |
| 7   | **Tracking OFF = pure no-op.** Returns `{ conflicts: [], reapplied: [] }` with NO side effects (mirrors `rebase()`/`getPatch()` off). To discard-and-adopt on a non-tracking form, assign your bound ref yourself.                                                                   |
| 8   | **`$cas` rides the upstream version.** The new baseline carries `upstream`'s `@db.column.version`, so the next `getPatch()` lifts `$cas` against the FRESH version automatically — provided `upstream` carries the version column.                                                   |
| 9   | **Upstream-introduced values validate IMMEDIATELY** under the default on-change strategy (treated as edits, not suppressed-fresh).                                                                                                                                                   |
| 10  | **Union variant remount.** If a rebase lands a DIFFERENT discriminated-union variant at a union path, that field subtree force-remounts so the picker re-detects.                                                                                                                    |
| 11  | **Single reactive write.** The bound `:form-data` container identity is preserved (one mutation, one watch pass); the new baseline is a deep clone of `upstream`, so the next `getPatch()` carries exactly the surviving local diff.                                                 |

```ts
const fresh = await client.one(id); // wrapped { value }
const { conflicts } = asForm.value.rebaseOnto(fresh, { conflict: "ours" });
if (conflicts.length)
  notify("Some fields changed on the server", "Kept your edits to: " + conflicts.join(", "));
```

**Non-Vue reuse:** `rebaseOnto` is the thin Vue reactive wrapper over the
framework-agnostic engine `buildFormRebase(def, baseline, current, upstream, opts?, diffOptions?)`
in `@atscript/ui` — a pure 3-way merge (all containers wrapped `{ value }`)
returning `{ next, conflicts, reapplied }` (`next` = rebased container to
install). Keep `diffOptions` identical to your tracking options (forwarded to
both internal `buildFormDiff` passes so version/`$cas` exclusion matches).
`applyFormChanges(def, data, changes)` reapplies a change list onto a wrapped
container (MUTATING — pass a clone); `deepEqual` / `deepClone` are the shared
structural comparator / clone (`deepClone(value, unwrap?)` — the `unwrap` hook
lets a framework strip a reactive proxy, e.g. vue-form passes `toRaw`).

## Key imports

```ts
// Vue surface
import { useAsFormPatch, useAsField } from "@atscript/vue-form";
import type { FormFieldChange, FormDiffOptions, FormRebaseOptions } from "@atscript/vue-form"; // re-exported from @atscript/ui
import type { RebaseOntoResult } from "@atscript/vue-form"; // vue-form-local rebaseOnto result
// Per-field dirty: handle.isDirtyPath(path) (also on slot props + defineExpose);
// useAsField().isDirty: ComputedRef<boolean>.

// Framework-agnostic engine (the diff + 3-way rebase behind all of the above)
import {
  buildFormDiff,
  buildFormRebase,
  applyFormChanges,
  isPathDirty, // pure per-field dirty predicate: isPathDirty(changes, path)
  deepEqual,
  deepClone,
} from "@atscript/ui";
import type {
  FormFieldChange,
  FormDiffResult,
  FormDiffOptions,
  FormRebaseOptions,
  FormRebaseResult,
} from "@atscript/ui";
```

`buildFormDiff(def, baseline, current, opts?)` — `baseline` and `current` are
both the WRAPPED `{ value: domainData }` container; returns
`{ isDirty, changes, patch }`. `useAsFormPatch()` returns an `AsFormPatchHandle`
(`isDirty` / `changes` as `ComputedRef`, `getPatch` / `getChanges` / `rebase`).
The `track-changes` prop on `<AsForm>` enables it; `useAsForm({ trackChanges })`
is the composable equivalent.

## References

| Domain                      | File                                                     | When                                                                                                                              |
| --------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Vue handle + provide/inject | `packages/vue-form/src/composables/use-as-form-patch.ts` | `useAsFormPatch()` + `rebaseOnto()` contract, baseline lifecycle, snapshot/clone semantics, single-write/remount, throw-when-off. |
| `track-changes` prop wiring | `packages/vue-form/src/components/as-form.vue`           | Where the prop maps to `trackChanges`; the `defineExpose` surface (incl. `rebaseOnto`) on the instance.                           |
| Slot-prop bag + reset path  | `packages/vue-form/src/composables/use-as-form.ts`       | `isDirty`/`changes`/`getPatch`/`getChanges` in slot props (no `rebase`/`rebaseOnto` there); `reset()` calling `rebase()`.         |
| Diff engine + patch shape   | `packages/ui/src/form/diff.ts`                           | `buildFormDiff`, nested replace/merge, keyed-array ops, `$cas` lift, version-column exclusion.                                    |
| Rebase + apply engine       | `packages/ui/src/form/{rebase,apply,clone}.ts`           | `buildFormRebase` 3-way merge (conflict classify, ancestor-clear), `applyFormChanges` write rules, `deepClone`/`deepEqual`.       |

## See also

- Docs: https://ui.atscript.dev/forms/change-tracking
- API: https://ui.atscript.dev/api/vue-form, https://ui.atscript.dev/api/ui
- OCC server-side mechanics (`@db.column.version`, `$cas`, `VersionMismatchError`): the `atscript-db` skill, and the [OCC-enabled edit forms](../SKILL.md) section of this skill.
