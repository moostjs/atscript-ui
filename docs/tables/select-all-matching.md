---
outline: deep
---

# Select All Matching Rows

A selection normally lists row keys, so it can only hold rows the table has
loaded. "Select all N matching" (the Gmail pattern) selects **every row that
matches the current filter and search** — 40 000 of them if need be — and
runs a bulk action on that set server-side, without loading a single extra
row. Since 0.1.147.

```vue
<AsTableRoot url="/api/db/tables/tasks" select-all-matching>
  <AsTableActions />
  <AsTable select="multi" />
</AsTableRoot>
```

Tick the header checkbox: once every loaded row is selected the table shows a
banner — _All 25 rows on this page are selected. **Select all 1 204
matching**_. Clicking it switches to a **query selection**; the toolbar then
runs the actions that accept one on all 1 204 rows.

## What it needs

The banner is offered only when all of these hold (`state.canSelectAllMatching`):

| Requirement                                 | Why                                                              |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `<AsTableRoot select-all-matching>`         | Opt-in, default off — existing tables see no change.             |
| `select="multi"` on the renderer            | Single-select and no-select tables never hold a query selection. |
| A server-backed table (`url`, no `queryFn`) | The server resolves the matching rows; a custom fetcher cannot.  |
| More matching rows than loaded ones         | Otherwise "select all on the page" already is "all matching".    |
| A `'rows'` action that takes a query target | Something must be able to act on the set (see below).            |

An action takes a query target when the server opts it in — `queryTarget` on
the `@DbAction` in moost-db, which `/meta` reports as
`queryTarget: { maxRows }`. See the atscript-db
[query targets](https://db.atscript.dev/http/query-targets) guide for the
server side.

## The query selection

While a query selection is held:

- `state.querySelection` holds `{ query, signature, excluded, total }` —
  `query` is the filter (force filters and custom filter conditions
  included), `$search` term and search index the table was showing;
  sorting, columns and paging are not part of it.
- `state.selectedRows` is empty. Ticking a row off adds its key to
  `excluded`; ticking it back removes it. Every row not excluded reads as
  selected (`state.isPkSelected`), loaded or not.
- `state.selectedCount` is `total − excluded.length`. Code that compared
  it with `selectedRows.length` should read `state.selection` instead — one
  value for both modes: `{ mode: "ids", ids, count }` or
  `{ mode: "query", query, excluded, total, count }`.
- The header checkbox reads checked while no loaded eligible row is
  excluded, indeterminate otherwise — never unchecked. Clicking a checked
  header ends the query selection; clicking an indeterminate one re-selects
  the excluded loaded rows.
- The banner reads _All 1 204 matching rows are selected. **Clear
  selection**_. `state.clearSelection()` ends it from code.

Bind it with `v-model:query-selection` on `<AsTableRoot>` to keep it outside
the table (`null` while the selection is `selectedRows`).

### When it is dropped

| Change                                                  | Query selection                                   |
| ------------------------------------------------------- | ------------------------------------------------- |
| Filter, search term or search index                     | Dropped; `@selection-reset` `{ reason: "scope" }` |
| Sorting, columns, paging, scrolling, relevance toggle   | Kept                                              |
| A refetch of the same query (refresh, live refresh)     | Kept; `total` follows the new count               |
| A query-targeted action succeeded                       | Cleared — the rows it touched have changed        |
| `selectedRows` written from outside (`v-model`)         | Dropped (the explicit selection wins)             |
| Renderer switched off `select="multi"`, prop turned off | Cleared                                           |

`selectionPersistence` does not apply to a query selection — it has no keys
to trim.

## Running actions on it

In a query selection `<AsTableActions>` resolves to the `'rows'` level with
no ids:

- an action with `queryTarget` whose `maxRows` covers the count is enabled;
- one with a smaller `maxRows` is shown disabled — _At most 500 rows_;
- every other `'rows'` action is shown disabled — _Not available for all
  matching rows — select rows individually_.

The loaded rows' `$actions` are not consulted: a page of rows cannot speak
for the rest. The server checks every row when the action runs and reports
the rows it skipped.

Clicking an enabled action:

1. counts the rows (`client.countActionTarget` — a dry run; the handler does
   not run). A refusal such as `TARGET_TOO_LARGE` settles as the action's
   error result.
2. confirms with that count — the action's `promptText` with `$N` = the
   count, or _Run “Archive” on 1 203 rows?_ when it has none; an action with
   an input form opens its dialog titled _Set priority · 1 203 rows_.
3. runs it (`client.actionOnQuery`) with `expectCount` = the confirmed
   count. If the set changed in between (409 `TARGET_CHANGED`) the user is
   asked once more with the new count.

The `@action` emit carries `ids: []` and a result with
`target: { matched, summary? }` — `summary` is the server's
`TDbActionTargetSummary` (`processed`, `skipped` with reasons, `failed`)
when the handler returned one:

```ts
function onAction(action: TVueTableActionInfo, ids: unknown[], result: ActionResult) {
  if (result.ok && result.kind === "backend" && result.target?.summary) {
    const { processed, skipped, matched } = result.target.summary;
    toast(`${action.label}: ${processed} of ${matched} rows, ${skipped.length} skipped`);
  }
}
```

To run one from code, pass the target to `invoke` yourself:
`state.actions.invoke(action, undefined, { target, expectCount })`, with
`state.actions.countTarget(action, target)` for the count.

## Banner and slots

`<AsTable>` and `<AsWindowTable>` render the banner above the rows inside a
polite live region, so both switches are announced; its buttons are plain
buttons, and focus moves to the new one when they swap. Replace its content
with `#selection-banner`:

```vue
<AsTable select="multi">
  <template #selection-banner="{ selection, selectAllMatching, clearSelection, loadedCount }">
    <template v-if="selection.mode === 'query'">
      {{ selection.count }} selected · <button @click="clearSelection">Clear</button>
    </template>
    <template v-else>
      {{ loadedCount }} selected · <button @click="selectAllMatching">Select all</button>
    </template>
  </template>
</AsTable>
```

`#header-__select` also receives `mode` (`"ids"` / `"query"`),
`canSelectAllMatching` and `selectAllMatching`, and `#cell-__select`'s
`selected` reflects the query selection. `<AsTableRoot>`'s default slot
exposes `selection`, `canSelectAllMatching`, `selectAllMatching` and
`clearSelection`.

`<AsWindowTable>` offers the banner while the dataset is only partly
loaded — that is the point — and reads "All N rows loaded are selected".
For that, a window table that can offer it shows the header checkbox while
partly loaded too, acting on the **cached** rows (normally it appears only
once every row is loaded — see
[What the header checkbox acts on](/tables/actions#what-the-header-checkbox-acts-on));
tables without the opt-in keep the old rule.

Exclusions are remembered by row identity (`preferredId`, plus any
delegated `idMap` columns), not by object reference, so a row unticked
before a refetch stays unticked after it — with the default `rowValueFn` too.

## DOs and DON'Ts

- **Do** opt the server action in with `queryTarget` and keep the action's
  own `disabled` predicate — the server skips rows it rejects and reports
  them. **Don't** expect `:row-selectable` to keep unloaded rows out: it can
  only gate loaded rows; in a query selection the server gate decides.
- **Do** read `state.selection` (or `selectedCount`) for counts. **Don't**
  read `selectedRows.length` — it is `0` in a query selection.
- **Do** show `result.target.summary` after a run — skipped rows (disabled,
  out of scope, changed since the count) are reported, never silently
  dropped.
- **Don't** expect a custom `queryFn` table to offer the banner — only the
  server can resolve "every matching row".

## See also

- [Actions & Selection](/tables/actions) — action levels, the toolbar, the
  explicit selection.
- [Row actions on a view](/tables/actions#row-actions-on-a-view) —
  delegated actions also accept query targets.
- [`@atscript/vue-table` API](/api/vue-table) — `QuerySelection`,
  `TableSelection`, `ActionQueryTarget`.
