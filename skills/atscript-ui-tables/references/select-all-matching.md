# Select all matching rows (query selection) — since 0.1.147

"Select all N matching" (Gmail pattern): a symbolic selection of every row matching the current filter / search, run server-side by `'rows'` actions that accept a query target. Docs: [Select All Matching Rows](https://ui.atscript.dev/tables/select-all-matching).

## Quick start

```vue
<AsTableRoot url="/api/db/tables/tasks" select-all-matching @action="onAction">
  <AsTableActions />
  <AsTable select="multi" />
</AsTableRoot>
```

Server side, opt the action in (moost-db): `@DbAction("archive", { queryTarget: { maxRows: 5000 } })` on a `'rows'` handler (`@DbActionIDs`, `@DbActionRows` or `@DbActionTarget`) — `/meta` then carries `queryTarget: { maxRows }`. See the atscript-db skill (`query-targets.md`).

## Invariants

| #   | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Offered only when** `<AsTableRoot select-all-matching>` ∧ renderer `select="multi"` ∧ server-backed (`url`, no `queryFn`, not `:rows`) ∧ `totalCount` > loaded rows ∧ some `'rows'` action has `queryTarget`. Read `state.canSelectAllMatching`.                                                                                                                                                                                                                                                               |
| 2   | **Query mode:** `state.querySelection = { query: { filter?, search?, index? }, signature, excluded, total }`; `selectedRows` is `[]`; row toggles edit `excluded`; `isPkSelected(pk)` = not excluded; `selectedCount` = `total − excluded.length`; `selectedRowObjects` = loaded non-excluded rows (informational). Read `state.selection` (`{ mode: "ids" \| "query", …, count }`) — never `selectedRows.length`.                                                                                               |
| 3   | **Header:** checked while no loaded eligible row is excluded, indeterminate otherwise, never unchecked; clicking checked ends query mode, clicking indeterminate re-selects excluded loaded rows. `selectAll(rows)` / `deselectAll(rows)` remove / add rows to `excluded`.                                                                                                                                                                                                                                       |
| 4   | **Dropped on filter / search / index change** (`@selection-reset` `{ reason: "scope" }`, `TableSelectionOptions.onSelectionReset`). Kept on sort, columns, paging, scroll; same-query refetch updates `total`, keeps `excluded`. Cleared by a successful query-targeted action, `clearSelection()`, `select` leaving `"multi"`, the prop turning off, or a non-empty `selectedRows` write. `selectionPersistence` does not apply.                                                                                |
| 5   | **Toolbar** (`<AsTableActions>`, `level="auto"`) → `'rows'` with `ids: []`, slot props `target` + `count`. Enabled iff `queryTarget` ∧ `count ≤ queryTarget.maxRows`; else disabled copy: `"At most N rows"` / `QUERY_TARGET_UNSUPPORTED_REASON`. Loaded rows' `$actions` are NOT consulted (`queryTargetGate(count)`).                                                                                                                                                                                          |
| 6   | **Run flow** (`triggerAction` with `PromptCtx.target`): `state.actions.countTarget` (dry run; failure → error result + `@action`, no prompt) → confirm (`promptText` with `$N` = count, else `"Run “Label” on N rows?"`; input-form actions open the dialog titled `"<title> · N rows"`) → `invoke(action, undefined, { target, input, expectCount, confirmTargetChange })` → `client.actionOnQuery` (POSTs to `queryTarget.url ?? value`). 409 `TARGET_CHANGED` → one re-prompt with the new count.             |
| 7   | **Result:** `@action` gets `ids: []`; `result.target = { matched, summary? }` — `summary` is the handler's `TDbActionTargetSummary` (`processed`, `skipped[{id, reason}]`, `failed`). Show skipped counts; they are never silent.                                                                                                                                                                                                                                                                                |
| 8   | **`exclude`** is built from `excluded` with `identifierFields`, then narrowed per action: own action → `preferredId` fields; delegated action (`idMap`) → exactly its `idMap` view paths.                                                                                                                                                                                                                                                                                                                        |
| 9   | **`:row-selectable` cannot gate unloaded rows** — in query mode the server gate (`disabled`, row scope) decides per row.                                                                                                                                                                                                                                                                                                                                                                                         |
| 10  | Banner: `role="status" aria-live="polite"` wrapper always mounted in multi-select; `.as-selection-banner` with `[data-select-all-matching]` / `[data-clear-selection]` buttons; focus follows the swapped button. `<AsWindowTable>` offers it while partly loaded ("All N rows loaded are selected"); when it can, its header checkbox appears while partly loaded and acts on the cached rows. Exclusions compare by row identity (identifier fields), so they survive refetches with the default `rowValueFn`. |

## API

| Symbol                                                         | Notes                                                                                                                                                                                    |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<AsTableRoot select-all-matching>`                            | Opt-in prop (→ `state.allowSelectAllMatching`). `v-model:query-selection`, `@selection-reset`. Default slot: `selection`, `canSelectAllMatching`, `selectAllMatching`, `clearSelection`. |
| `#selection-banner` on `<AsTable>` / `<AsWindowTable>`         | Props `{ selection, canSelectAllMatching, selectAllMatching, clearSelection, loadedCount }`; rendered only while the banner shows.                                                       |
| `#header-__select`                                             | Adds `mode` (`"ids"` / `"query"`), `canSelectAllMatching`, `selectAllMatching`.                                                                                                          |
| `state.selectAllMatching()` / `state.clearSelection()`         | Enter / leave query mode.                                                                                                                                                                |
| `state.loadedEligiblePks`, `state.selectMode`                  | Loaded keys `rowSelectable` admits; renderer-pushed `select`.                                                                                                                            |
| `state.actions.countTarget(action, target)`                    | Dry-run count; `undefined` on failure (already settled).                                                                                                                                 |
| `InvokeOpts.target` / `expectCount` / `confirmTargetChange`    | Run on a query target from code: `invoke(action, undefined, { target, expectCount })`.                                                                                                   |
| `selectionQueryOf`, `selectionSignature`, `togglePk(…, keyOf)` | `@atscript/ui-table` pure helpers.                                                                                                                                                       |

## Key imports

```ts
import {
  queryTargetGate,
  QUERY_TARGET_UNSUPPORTED_REASON,
  type QuerySelection,
  type TableSelection,
  type ActionQueryTarget,
  type SelectionResetEvent,
} from "@atscript/vue-table";
import { selectionQueryOf, selectionSignature, togglePk } from "@atscript/ui-table";
```

## See also

- [actions-selection.md](actions-selection.md) — explicit selection, toolbar, view-delegated actions.
- atscript-db skill `query-targets.md` — server opt-in, envelope, errors, consistency.
