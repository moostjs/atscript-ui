# hidden-fields

Presets, shared links and drafts that name fields the caller's role cannot read. Since 0.1.141. Docs: [Fields Hidden by Role](https://ui.atscript.dev/tables/hidden-fields).

## Quick start

Nothing to enable — pruning is always on. Bind the report where roles differ:

```vue
<AsTableRoot
  url="/api/db/tables/users"
  v-model:url-query="urlQuery"
  :preset="{ url: '/api/db/_presets', tableKey: 'users' }"
  @fields-dropped="(r) => toast(`Not available to you: ${r.fields.join(', ')}`)"
>
  <AsTableActions><AsPresetPicker /></AsTableActions>
  <AsTable />
</AsTableRoot>
```

Renderless: `useTable(url, { onFieldsDropped })` / `createTableState({ query: { onFieldsDropped } })`. Direct model writes are never reported — only gated out of the query. Unbound → dev-mode `console.warn("[vue-table] Left out fields this table cannot use (<source>): …")`.

## Invariants

| #   | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Readable = in `/meta.fields` AND not `writeOnly`.** Only readable fields become columns / `fetchableFields` (`createTableDef`). ≤ 0.1.140 a `writeOnly` field or a top-level field missing from `meta.fields` still became a column → 400 on the Standard view.                                                                                                                                                                                                                   |
| 2   | **Known sets come from the column list:** columns (client-owned included) gate `columnNames`, widths, sorters; server-backed columns gate `filterFields`, `filters`, residual conditions.                                                                                                                                                                                                                                                                                           |
| 3   | **Two writers prune on apply:** presets (picker, reset, raw snapshot, and the bootstrap default — applied only once `/meta` loaded, local draft included) and restored URLs. Everything else (`v-model`, `setFieldFilter`, `addFilterField`, `setResidualFilters`) is kept as written; `buildQuery()` is the guarantee — a memoized gate leaves hidden fields out of `$select` (by column list), `$sort`, filters, residuals, with one neutral dev warn per path set and no report. |
| 4   | **Drop rules:** columns keep order, none left → every column; `filterOps` go per field; a residual naming a hidden field anywhere goes WHOLE (never pruned inside `$or` / `$not`); sorters keep priority; `itemsPerPage` untouched. Result is always broader, never narrower.                                                                                                                                                                                                       |
| 5   | **One report per apply, only when something dropped.** `DroppedFieldsReport`: `source` (`preset` — the draft counts as its preset — / `url`), `presetId?`, `fields` (the unusable paths — show these), `columns`, `filterFields`, `filters`, `residual` (for `url`: every dropped filter piece), `sorters`.                                                                                                                                                                         |
| 6   | **Stored preset never rewritten on apply.** `state.preset.activeSnapshot` is the pruned stored snapshot → not dirty; `state.preset.droppedFields` is what it drops (derived, follows `activeId`); `<AsPresetPicker>` shows a quiet note.                                                                                                                                                                                                                                            |
| 7   | **`saveActive` appends hidden entries back** (`restoreDroppedEntries(captured, droppedFields)`: columns / filter inputs / sorters after the visible ones, `filterOps` added; hidden widths not kept) — a narrowed owner doesn't destroy them. `saveAs` stores only visible fields.                                                                                                                                                                                                  |
| 8   | **URL is not rewritten on load**; the next change writes a clean URL. `$sort` and operator-shaped pieces on unknown fields are reported; a bare `field=value` is dropped silently (could be a host flag), with or without a bridge `prefix`. Pass `localFields` to `urlQueryStringToState` so client-owned columns aren't reported.                                                                                                                                                 |
| 9   | **`unknown` ≠ `unsupported`.** A URL piece naming a hidden field (even mixed with visible ones) → `@fields-dropped`; `@unsupported-filter` keeps meaning "the filter model can't express it". ≤ 0.1.140 mixed pieces went to `@unsupported-filter`.                                                                                                                                                                                                                                 |
| 10  | **`forceFilters` / `forceSorters` are NEVER pruned** — app-authored narrowing; dropping one would widen the view. Keep them to fields every role reads, or compute them per role.                                                                                                                                                                                                                                                                                                   |
| 11  | **Keep system presets on fields every role reads** — a hidden one degrades, but that role then sees the note on its default view.                                                                                                                                                                                                                                                                                                                                                   |
| 12  | **Pruning is not access control.** The server's projection hides data; pruning only stops the client from asking (the server still 400s raw queries).                                                                                                                                                                                                                                                                                                                               |

## Key imports

```ts
import type { DroppedFieldsReport } from "@atscript/vue-table";
import {
  prunePresetSnapshot, // (snapshot, known) → { snapshot, dropped | null }
  pruneResidualFilters, // (exprs, knownSet) → { kept, dropped | null }
  restoreDroppedEntries, // (captured, dropped) → snapshot with hidden entries appended
  decomposeUniqueryFilter, // result.unknown — { expr, fields } pieces on unknown fields
  urlQueryStringToState, // result.unknown / unknownSorters; opts.localFields
  type KnownFields, // { columns, server }
  type DroppedFields,
} from "@atscript/ui-table";
```

## References

| Domain          | File                                         | When                                                                  |
| --------------- | -------------------------------------------- | --------------------------------------------------------------------- |
| Presets + URLs  | [state-persistence.md](state-persistence.md) | Preset aspects, picker, `$snapshot` URLs the pruning sits on          |
| Filter decoding | [filtering.md](filtering.md)                 | `unsupported` reasons, residual conditions, `decomposeUniqueryFilter` |
| Query + force   | [query.md](query.md)                         | `forceFilters` / `forceSorters`, `buildQuery`                         |

## See also

- API: `@atscript/ui-table` → Hidden-field pruning; `@atscript/vue-table` → `DroppedFieldsReport`, `PresetSurface.droppedFields`.
