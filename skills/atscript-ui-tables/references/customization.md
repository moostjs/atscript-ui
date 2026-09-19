# customization

Override layers for table rendering, coarse → fine. Pick the smallest one that does the job:

1. **Slot** — replace one cell / header / state body on one table.
2. **`:types`** — replace every cell of one cell type for one table.
3. **`:components`** + `@ui.table.component` — replace one named cell, reusable across tables.
4. **`:controls`** — replace table chrome: dialogs, header cells, column menu, filter bar pieces, row-actions cell.

## Slots

`<AsTable>` / `<AsWindowTable>` (forwarded through `AsTableBase`):

| Slot                | Scope                    | Replaces                           |
| ------------------- | ------------------------ | ---------------------------------- |
| `#header-<colPath>` | `{ column }`             | `<th>` content for that column     |
| `#cell-<colPath>`   | `{ value, row, column }` | `<td>` content for that column     |
| `#empty`            | —                        | Body when results are empty        |
| `#query-loading`    | —                        | Overlay while a query is in flight |
| `#error`            | `{ error, retry }`       | Body when the last query failed    |
| `#last-row`         | —                        | Pseudo-row after the last data row |

Slot name uses the column path verbatim, dots included: `<template #cell-address.city="...">`. Slots win over the cell-component dispatch for matched columns.

An explicit `#header-<colPath>` slot ALSO renders for a fixed (synthesised) column such as `__actions` — only that column's DEFAULT header stays blank, and it remains non-draggable / non-resizable. Since 0.1.133.

## Row hooks (since 0.1.133)

`<AsTable>` and `<AsWindowTable>` (both, since 0.1.133 — not `<AsTable>`-only). Each hook receives `(row, { index, selected })`; `index` is the absolute row index in windowed mode. `selected` is a lazy getter, so a predicate that ignores it is not re-run on selection changes.

| Prop              | Returns                                         | Effect                                                             |
| ----------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| `:row-selectable` | `boolean \| string`                             | `false`/string ⇒ row not selectable; string is the disabled reason |
| `:row-class`      | `string \| string[] \| Record<string, boolean>` | Extra classes on `<tr>`                                            |
| `:row-attrs`      | `Record<string, unknown>`                       | Extra attributes on `<tr>`                                         |

```vue
<AsTable
  select="multi"
  :row-selectable="(row) => (row.archived ? 'Archived rows cannot be picked' : true)"
  :row-class="(row) => ({ 'opacity-60': row.archived })"
  :row-attrs="(row) => ({ 'data-status': row.status })"
/>
```

Precedence: framework `id` / `role` / `aria-*` / `data-*` / `class` / `style` always win over `:row-attrs`. Types: `RowSelectableHook`, `RowClassHook`, `RowAttrsHook`, `RowHookContext`, exported from `@atscript/vue-table`. Selection semantics: [actions-selection.md](actions-selection.md#per-row-selectability-row-selectable-since-01133).

`<AsTableRoot>`'s default `v-slot` exposes the full table-state surface for page chrome (toolbar, pagination, filter bar): `tableDef`, `loadingMetadata`, `metadataError`, `allColumns`, `columnNames`, `columnWidths`, `columns`, `filterFields`, `filters`, `sorters`, `results`, `querying`, `queryingNext`, `totalCount`, `loadedCount`, `pagination`, `queryError`, `mustRefresh`, `searchTerm`, `selectedRows`, `selectedCount`, `navBridge`, `query`, `queryNext`, `resetFilters`, `showConfigDialog`, `openFilterDialog`, `closeFilterDialog`, `setFieldFilter`, `removeFieldFilter`, `addFilterField`, `removeFilterField`, `actions`, `prompt`.

## Display-only columns (`:displayColumns`, since 0.1.134)

Client-owned columns on top of the server's `/meta` columns — a derived value, a count, a link, a widget. They are real columns for visibility, reordering, the config dialog (badged `client`) and presets, and are NEVER sent to the server: excluded from `$select`, from server sorting and from filters.

```ts
interface DisplayColumnDef {
  key: string; // becomes the column `path` → `cell-<key>` / `header-<key>` slots, `columnNames`, presets
  label: string;
  width?: string;
  order?: number; // position among server columns; appended when omitted
  sortable?: false | "local"; // 'local' = client-side; page-local, or whole-dataset in-memory
  sortValue?: (row: Record<string, unknown>) => unknown; // what 'local' orders by; default row[key]
  component?: string; // named component from `:components`
  type?: string; // cell type for `:types`; default "text"
}
```

```vue
<AsTableRoot
  url="/api/db/tables/orders"
  :display-columns="[{ key: 'margin', label: 'Margin', width: '7em', order: 5 }]"
>
  <AsTable>
    <template #cell-margin="{ row }">{{ marginOf(row) }}</template>
  </AsTable>
</AsTableRoot>
```

Gotchas:

- The column's value is not fetched. Render it from data already in the row, or pull the source field in with `:always-selected`.
- `sortable: 'local'` orders the LOADED page. Give it `sortValue: (row) => …` when the value is computed in the slot; without one it reads `row[key]`, which only works when the key names a field in the payload.
- The page is re-sorted by the WHOLE sorter list, so a server sorter before the local one keeps its ordering and the local sorter acts as a tiebreak.
- An in-memory table (`<AsTableRoot :rows>`) sorts the whole dataset in its query function rather than one page, so a display column orders every row — in `<AsWindowTable>` too, since every absolute index the window asks for then arrives already in place (`state.localSortAvailable`, since 0.1.135).
- Behind a SERVER fetcher, `<AsWindowTable>` is the one place local sorting is unavailable: rows are cached by absolute index and dropped as the viewport moves, so the affordance is withheld in the header and the config dialog alike. Before 0.1.135 that exclusion caught in-memory window tables too.
- Exports leave display columns out of `columns: "visible"` unless `formatters[path]` fills them — see [export.md](export.md).
- An unknown key in a stored preset is ignored, so removing a display column later does not break saved views.
- Pure helper in `@atscript/ui-table`: `mergeDisplayColumns`; `ColumnDef` gained `local` (a `local` column with `sortable: true` is ordered in memory).

## Cell maps — `:types` and `:components`

```ts
import { createDefaultCellTypes } from "@atscript/vue-table";
import MyDateCell from "./MyDateCell.vue";

const types = { ...createDefaultCellTypes(), date: MyDateCell, datetime: MyDateCell };
const components = { statusBadge: StatusBadgeCell }; // ← @ui.table.component 'statusBadge'
```

```vue
<AsTableRoot url="/db/orders" :types="types" :components="components" />
```

Resolution per column (cached once per column, reused per row): named `@ui.table.component` → `:components[name]`; else `column.type` → `:types[type]`; else `AsTableCellValue`. Cell contract + locale wiring: [cells.md](cells.md).

## Controls map (`:controls`) — chrome swap

Every key is dispatched at its mount site as `controls[key] ?? default`, so pass **only the entries you replace** — spreading `createDefaultControls()` is redundant and statically bundles + eager-mounts the lazy dialogs (invariant 1):

| Key                | Default                                | Mounts                                                            |
| ------------------ | -------------------------------------- | ----------------------------------------------------------------- |
| `headerCell`       | `AsTableHeaderCell`                    | Inner-of-`<th>` content per column                                |
| `columnMenu`       | `AsColumnMenu`                         | Header dropdown (mounted by the default `headerCell`)             |
| `rowActions`       | `types.__actions`, then `AsRowActions` | Synthesized `__actions` cell (see invariant 3)                    |
| `filterField`      | `AsFilterField`                        | One field per active filter in `<AsFilters>`                      |
| `filterInput`      | `AsFilterInput`                        | Condition value input (filter dialog conditions tab)              |
| `filterValueHelp`  | internal, unexported                   | Value-help tab inside the filter dialog                           |
| `fieldsSelector`   | internal, unexported                   | Columns / Filters lists inside the config dialog                  |
| `sortersConfig`    | internal, unexported                   | Sorters list inside the config dialog                             |
| `filterDialog`     | `AsFilterDialog`                       | Per-column filter dialog (lazy: first open)                       |
| `configDialog`     | `AsConfigDialog`                       | Three-tab settings dialog (lazy: first open)                      |
| `confirmDialog`    | `AsConfirmDialog`                      | `state.prompt()` dialog (always mounted)                          |
| `presetDialog`     | `AsPresetDialog`                       | Preset manage dialog (lazy: first open; requires presets enabled) |
| `actionFormDialog` | lazy-loaded import                     | `@InputForm` action dialog (lazy: first input-form action)        |

```ts
const controls = { filterDialog: MyFilterDialog }; // overrides only — don't spread defaults
```

`AsActionFormDialog` lives on a dedicated subpath (`@atscript/vue-table/as-action-form-dialog`) — it pulls in the full `@atscript/vue-form` runtime, so the main entry doesn't export it. Assign it to `controls.actionFormDialog` to override or eager-load. Its embedded `<AsForm>` is customized via the separate `formTypes` / `formComponents` props on `<AsTableRoot>` (same shape as vue-form's `:types` / `:components`).

## Headless — no header row

`:headless` on `<AsTable>` / `<AsWindowTable>` renders the body without a header — omits `<thead>` entirely (not `display:none`). For compact, label-less, display-only grids (e.g. a read-only island inside a card).

```vue
<AsTable :headless="true" />
<AsWindowTable :headless="true" />
```

- Column widths survive without a header: they are carried by a `<colgroup>`, not the header `<th>`. A `@ui.table.width "32ch"` column keeps its width with no header. (This is why hiding the header via `:deep(thead){display:none}` collapses columns — those widths only live on the `<th>`. Use `:headless`, not that CSS hack.)
- No header ⇒ no sort/filter/reorder/resize UI or column menu. Drive sort/filter from a custom toolbar (write `state.sorters` / `state.filters`) or `<AsConfigDialog>`. Display-only, not interactive.
- **Not** a _renderless_ table: `:headless` still renders `<AsTable>`. Renderless = drop `<AsTable>`, render your own markup from `<AsTableRoot>` state (`alwaysSelected` + default slot) — see [cells.md](cells.md).

## Invariants

| #   | Rule                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Passing a custom component for `filterDialog` / `configDialog` / `presetDialog` / `actionFormDialog` disables the lazy-mount latch — the override mounts eagerly.                                                                                                                                                                                                                                                           |
| 2   | Every `TAsTableControls` key is dispatched at its mount site with the built-in as fallback (`controls[key] ?? default`). `presetPicker` is NOT a control key — `<AsPresetPicker>` is a Tier-1 component you mount yourself.                                                                                                                                                                                                 |
| 3   | The synthesized `__actions` column resolves `controls.rowActions ?? types.__actions ?? AsRowActions`. `createDefaultControls()` does NOT seed `rowActions` — a `types.__actions` entry works on its own; set `controls.rowActions` only to override explicitly (it wins over the `types` entry). The custom cell reads `state.actions.cellRow` + `state.actions.invoke` — see [actions-selection.md](actions-selection.md). |
| 4   | Header chrome is replaced per-column via `#header-<path>` slots, or wholesale via `controls.headerCell` / `controls.columnMenu`. `controls.filterField` / `controls.filterInput` swap the filter-bar chrome rendered by `<AsFilters>` and the filter dialog.                                                                                                                                                                |
| 5   | A replacement dialog writes the new model arrays (`state.filterFields` / `filters` / `sorters` / `columnNames`); the root watcher reconciles and re-queries. Never call `state.query()` to apply, never run cleanup loops mirroring display state into applied state.                                                                                                                                                       |
| 6   | `useTableComponent(key, fallback)` reads `controls[key] ?? fallback` from the injected context — the same helper the built-in chrome uses; reuse it in your own custom chrome built on `useTable`.                                                                                                                                                                                                                          |
| 7   | Replacing a default drops its `as-*` shortcut classes from the bundle automatically. Keep defaults whose chrome fits; compose narrower shortcut groups via `atscript-ui-styles` per-domain exports.                                                                                                                                                                                                                         |

## Key imports

```ts
import {
  AsTableRoot,
  AsTable,
  AsWindowTable, // Tier 1
  AsConfigDialog,
  AsFilterDialog,
  AsPresetDialog,
  AsConfirmDialog,
  AsRowActions, // Tier 2 swap bases
  createDefaultCellTypes,
  createDefaultControls,
  useTableContext,
  useTableComponent,
  getCellValue,
} from "@atscript/vue-table";
import AsActionFormDialog from "@atscript/vue-table/as-action-form-dialog";
import type { TAsTableControls, TAsCellTypeComponents } from "@atscript/vue-table";
```

## See also

- Docs (narrative SSOT): https://ui.atscript.dev/tables/customization
- [cells.md](cells.md) — built-in cells, custom cell contract, `provideCellLocale`, per-cell styling annotations
- [actions-selection.md](actions-selection.md) — `state.actions` API behind a custom row-actions cell
- [getting-started.md](getting-started.md) — `<AsTableRoot>` props, Tier 1/2/3 map
