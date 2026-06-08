# Feature: extra `$select` fields for cell renderers and custom content in `AsTableRoot`

## Summary

A cell renderer — or any custom content under `AsTableRoot` — can only read fields that survived into the row payload, and that payload is exactly the **visible** columns: `controls.$select` is derived solely from `state.columnNames`. There is no way to say "fetch these extra leaf fields, but don't show them as columns."

The relaxed design adds that capability through **two declarative sources**, both gated by what the (possibly access-narrowed) meta actually exposes:

1. **`@ui.table.selectWith` annotation** (repeatable) — co-located with a field, declares sibling leaves to fetch **whenever that field's column is displayed**. The ergonomic, schema-driven path; needs no call-site code.
2. **`alwaysSelected` prop on `AsTableRoot`** — a table-level always-projected set, for fully custom renderers that don't use `<AsTable>` and have no `ColumnDef` to hang deps on.

Both converge on one merge site — a new optional `extraSelect?: string[]` on `BuildTableQueryOptions`, unioned (deduped) into `controls.$select` at the single existing sink. The extra leaves **never** become visible, toggleable, or rendered columns.

A third, **orthogonal** change ships alongside: code-split the config/filter/preset dialogs via dynamic import so a custom-renderer app that never opens them doesn't pay for them in its main bundle.

## Motivation

The portal is converging on **one generic, URL-driven table**: a single `TablePage.vue` points `<AsTableRoot :url="`/api/db/${collection}`">` at the moost-db endpoint and lets `/meta` build the columns. No per-collection Vue file, no per-collection client hook. Any feature must preserve that — a solution that requires editing `TablePage.vue` per collection has already lost.

`users` is the canonical case. The `username` column renders an **identity cell**: avatar thumbnail + "First Last" + the username/email beneath. Of those, only `username` is a visible column; `avatar` is `@ui.table.hidden` (a raw S3 URL is noise as its own column) and `firstName`/`lastName` aren't part of the compositing intent as standalone columns. Today `firstName`/`lastName` only reach the client because they happen to be default-visible columns — drop them from the preset (the natural move once the identity cell _replaces_ them) and the cell goes blank. We want `avatar`/`firstName`/`lastName` to ride along **whenever `username` is visible**, with zero edits to `TablePage.vue`. That's `@ui.table.selectWith`, declared once on the schema:

```as
type User = {
  /** @ui.table.component 'identity' */
  /** @ui.table.selectWith 'avatar' */
  /** @ui.table.selectWith 'firstName' */
  /** @ui.table.selectWith 'lastName' */
  username: string

  /** @ui.table.hidden */
  avatar: string
  firstName: string
  lastName: string
}
```

The **headless case** makes the need generic. `AsTableRoot` can be used _without_ `<AsTable>`: its default slot always renders and spreads the full state (`:results`, `:columns`, …) so a developer can hand-roll a list with no table chrome. Such a renderer has **no `ColumnDef`** to attach deps to. For it, the table-level `alwaysSelected` prop is the honest declaration:

```vue
<AsTableRoot :url="`/api/db/${collection}`" :always-selected="['avatar', 'firstName', 'lastName']">
  <template #default="{ results }"><MyCustomList :rows="results" /></template>
</AsTableRoot>
```

### What this is _not_ for: currency / unit refs

Number cells resolve a sibling currency/unit field (`ColumnDef.currencyRefField` / `unitRefField`, from `@db.amount.currency.ref` / `@db.unit.ref`). These are **already handled server-side** and need no client mechanism: `as-db-readable.controller.ts` `widenQuantityRefProjection` auto-includes the ref field in the projection **unconditionally** whenever the amount field is selected (no-op only when `$select` is absent), and it is never stripped before serialization (verified, with a regression test: `$select=amount` → server queries `[amount, currency]`). So whenever a number arrives, its dimension arrives with it — regardless of columns or preset. `@ui.table.selectWith` is the general fallback (e.g. against a non-moost-db backend); for the moost-db target, currency/unit are not its concern.

## Current behavior

`controls.$select` is built **only** from the visible column paths. The sole input is `BuildTableQueryOptions.visibleColumnPaths`, and the single assignment is at `packages/ui-table/src/query/build-table-query.ts:55-56`:

```ts
if (opts.visibleColumnPaths.length > 0) {
  controls.$select = opts.visibleColumnPaths;
}
```

`buildTableQuery` is a pure function; that array originates in `buildCurrentQuery` (`packages/vue-table/src/composables/use-table-state.ts:377-387`), the **single query chokepoint** feeding both paginated `runQuery` and the windowed fetcher (`create-window-fetcher.ts:170`). One edit there covers `<AsTable>` and `<AsWindowTable>` identically.

There is no mechanism to add fields without adding columns: the only path into `$select` is `columnNames`, and anything in `columnNames` also renders.

## Design: one union, two sources, one gate

### The sink

A new optional `extraSelect?: string[]` on `BuildTableQueryOptions`, unioned at the existing assignment so extra paths can never be mistaken for visible columns elsewhere (`visibleColumnPaths` has exactly one consumer):

```ts
// packages/ui-table/src/query/build-table-query.ts:55-56 (proposed)
const sel = opts.extraSelect?.length
  ? [...new Set([...opts.visibleColumnPaths, ...opts.extraSelect])]
  : opts.visibleColumnPaths;
if (sel.length > 0) controls.$select = sel;
```

### The degradation gate

Both sources are filtered against **what the meta actually exposes**, so a field removed by server-side access control is silently dropped rather than requested (which would error). The authoritative set is the **full** column set, including hidden columns:

```ts
const available = new Set(allColumns.value.map((c) => c.path));
```

Verified properties:

- Every `meta.fields` entry becomes a `ColumnDef` (`packages/ui/src/table/create-table-def.ts:48-89`); access-narrowed fields are absent from `meta.fields` → absent from `allColumns` → dropped by the gate.
- `@ui.table.hidden` fields stay in `allColumns` with `visible:false` (`create-table-def.ts:81`). **Gate against `allColumns`, never `getVisibleColumns`** — else the canonical `avatar` dep gets wrongly dropped.
- The gate **doubles as the Mongo-31249 (parent/leaf collision) guard**: object parents aren't in `allColumns` (meta lists either the json-atomic parent _or_ its leaves, never both), so every surviving dep is a real, collision-free leaf path. No separate leaves-only validation needed.

### Wiring `buildCurrentQuery`

```ts
// packages/vue-table/src/composables/use-table-state.ts:377
const available = new Set(allColumns.value.map((c) => c.path)); // narrowed-meta gate (incl. hidden)
const extra = new Set<string>();
for (const c of columns.value) // selectWith: VISIBLE columns only
  for (const p of c.selectWith ?? []) if (available.has(p)) extra.add(p);
if (queryOpts?.alwaysSelected)
  // alwaysSelected: same gate
  for (const p of queryOpts.alwaysSelected) if (available.has(p)) extra.add(p);

return buildTableQuery({
  visibleColumnPaths: columnNames.value,
  extraSelect: extra.size ? [...extra] : undefined,
  /* …unchanged… */
});
```

`selectWith` is harvested from **visible** columns (`columns.value`) so deps ride only "when the field is displayed" and disappear when the owning column is toggled off. `alwaysSelected` is unconditional (subject to the gate).

### Source 1 — `@ui.table.selectWith` (annotation)

Mirrors the repeatable `@ui.table.classes` pattern exactly:

1. `UI_TABLE_SELECT_WITH = "ui.table.selectWith"` in `packages/ui/src/shared/annotation-keys.ts` (beside `UI_TABLE_COMPONENT:32`).
2. One `AnnotationSpec` with `multiple: true` + `mergeStrategy: 'append'` in `packages/ui/src/plugin/annotations.ts` (mirror `classes` at `:563-564`).
3. `selectWith?: string[]` on `ColumnDef` (`packages/ui/src/table/types.ts`).
4. One line in the `columns.push({...})` literal (`create-table-def.ts`): `selectWith: getFieldMeta(prop, UI_TABLE_SELECT_WITH)`.

### Source 2 — `alwaysSelected` (prop)

String array only (no function form). Threads like `forceFilters`/`forceSorters`:

1. `alwaysSelected?: string[]` on `TableQueryOptions` (`use-table-state.ts:119-149`).
2. `alwaysSelected?: string[]` on `UseTableOptions` (`use-table.ts`); forward in the `query:` bag (`use-table.ts:185-194`).
3. `alwaysSelected` prop on `<AsTableRoot>`; forward to `useTable`.

## Dialog code-splitting (orthogonal)

Today `as-table-root.vue:20` statically imports `AsConfigDialog`/`AsFilterDialog`/`AsPresetDialog`, rendered unconditionally with a `?? AsDefault` fallback (`:247-248`), so every `AsTableRoot` bundle includes them (~28KB + ~25KB) even for custom-renderer apps that never open them.

Convert these to `defineAsyncComponent` — **the same file already does this for `AsActionFormDialog` at `:27-29`**, so mirror that. To defer the chunk to _first open_ (not table mount), gate the `<component :is>` behind an **open-state latch** (`v-if` on a ref that flips true on first open and stays), preserving the dialog's close animation. `AsConfirmDialog` is tiny — leave it static. `sideEffects: false` is orthogonal and won't help here (the dialogs are _used_ in render; only dynamic `import()` splits them).

## Edge cases & semantics

1. **Never a visible/toggleable column.** Extra paths only ever enter `$select` via `extraSelect` at the sink; they're recomputed each `buildCurrentQuery` and never enter `columnNames`, so they never render, never appear in the config dialog, and ride untouched across column toggles.
2. **Survive preset apply & config dialog** — by carrying deps on the owning column's `selectFields`/via the prop, never as a standalone `ColumnDef`. Preset state captures only `columnNames`/`columnWidths`; the config dialog lists `allColumns`; no dep-only column object exists to leak.
3. **Survive URL replay** — `url-query.ts` builds the URL with `visibleColumnPaths: []` and excludes `$select` entirely. Extra paths can't leak into or be clobbered by the URL; both sources re-run inside every `buildCurrentQuery` against live state.
4. **Dedupe across sources** — a single `Set` at the sink.
5. **Identical in paginated and windowed modes** — the merge lives in the shared `buildTableQuery`, fed by the single `buildCurrentQuery`.

## Backward compatibility

Fully additive. With no annotation and no prop, `available`/`extra` produce an empty `extraSelect`, and the sink yields a **byte-identical** `controls.$select` to today. `getFieldMeta(prop, UI_TABLE_SELECT_WITH)` is `undefined` for every current `.as` file, exactly how `width`/`order` were added. No existing `.as` file or `<AsTableRoot>` call site changes behavior. The dialog change is render-equivalent (same components, lazily loaded).

## Implementation checklist

**`@atscript/ui`**

- [ ] `UI_TABLE_SELECT_WITH` key in `annotation-keys.ts`
- [ ] `selectWith` `AnnotationSpec` (multiple + append) in `annotations.ts`
- [ ] `selectWith?: string[]` on `ColumnDef` in `types.ts`
- [ ] harvest line in `create-table-def.ts`
- [ ] `create-table-def.spec.ts` coverage

**`@atscript/ui-table`**

- [ ] `extraSelect?: string[]` on `BuildTableQueryOptions`
- [ ] union at the sink (`build-table-query.ts:55-56`)
- [ ] `build-table-query.spec.ts` coverage (union, dedupe, empty no-op)

**`@atscript/vue-table`**

- [ ] degradation gate + `selectWith`/`alwaysSelected` harvest in `buildCurrentQuery`
- [ ] `alwaysSelected` on `TableQueryOptions` + `UseTableOptions` + query bag
- [ ] `alwaysSelected` prop on `<AsTableRoot>`
- [ ] dynamic-import config/filter/preset dialogs (latch gating, mirror `AsActionFormDialog`)
- [ ] tests (gate drops absent deps; hidden dep survives; alwaysSelected union)

**Verify:** `pnpm build` · `pnpm test` · `vp lint`
