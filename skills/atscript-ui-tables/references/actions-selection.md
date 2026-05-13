Row / table / rows actions, selection model, recipes.

## Contents

- [Action declaration on .as](#action-declaration-on-as)
- [Action levels](#action-levels)
- [AsRowActions](#asrowactions)
- [AsTableActions](#astableactions)
- [AsActionFormDialog](#asactionformdialog)
- [state.actions API](#stateactions-api)
- [Action result processing](#action-result-processing)
- [Selection model](#selection-model)
- [Recipes](#recipes)

## Action declaration on .as

Cross-link the atscript-db skill for the full `@DbAction*` and `@InputForm` annotation surface plus the `{ ids?, input? }` envelope shape. atscript-ui-tables reads the resolved `TDbActionInfo[]` from `tableDef.actions` (via the `/meta` endpoint) and renders chrome on top.

Minimal example:

```atscript
@db.table 'orders'
@db.action.default.row 'view'
@db.action.row 'view' @ui.action.icon 'i-as-eye'           @ui.action.label 'View'
@db.action.row 'cancel' @ui.action.icon 'i-as-x' @ui.action.intent 'negative' @ui.action.confirm 'Cancel order $1?'
@db.action.rows 'export' @ui.action.label 'Export selected'
@db.action.table 'create' @ui.action.icon 'i-as-plus' @ui.action.label 'New order'
export interface Order { ... }
```

| Annotation                             | Effect                                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `@db.action.row 'name'`                | Per-row action.                                                                                                      |
| `@db.action.rows 'name'`               | Multi-row (selection-driven).                                                                                        |
| `@db.action.table 'name'`              | Table-level (no rows, "create" style).                                                                               |
| `@db.action.default.<level> 'name'`    | The action that fires on default trigger at that level.                                                              |
| `@ui.action.label`                     | Display label.                                                                                                       |
| `@ui.action.icon`                      | UnoCSS icon class.                                                                                                   |
| `@ui.action.intent`                    | `'positive' \| 'negative' \| 'warning' \| 'primary' \| 'secondary'` — drives confirm-dialog scope and button colour. |
| `@ui.action.confirm`                   | Prompt text. `string` (always) or `[singular, plural]` tuple. `$1` → primary key, `$N` → row count.                  |
| `@db.action.input.<name>` `@InputForm` | Structured input — opens `<AsActionFormDialog>` rendering the input type with vue-form.                              |

## Action levels

| Level   | When triggered                                                                                   | `pk` arg to `invoke`                         |
| ------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `table` | No selection, no row context. Toolbar "New record" style.                                        | `undefined`                                  |
| `row`   | Per-row dropdown OR keyboard main-action OR selection-aware level=`auto` and exactly 1 selected. | identifier object `{ <preferredId>: value }` |
| `rows`  | Multi-row selection (`level=auto` with ≥2 selected).                                             | array of identifier objects                  |

Identifier objects are object-only (never bare scalars) — cross-link atscript-db skill invariant #11. Built via `extractIdentifier(row, preferredId)` from `composables/state/intent-scope.ts:95`.

## AsRowActions

`components/defaults/as-row-actions.vue`. Renders the cell for the synthesized `__actions` pseudo-column.

- 0 visible actions → empty `<td>` (placeholder for `table-layout: fixed`).
- 1 action → single button (`label` for label-only actions, icon button otherwise).
- ≥2 actions → `…` dropdown (`<AsActionMenuContent>`).

Reads `state.actions.cellRow` — pre-flattened `[default?, ...others.row, ...rows]`. Per-row availability gate:

```typescript
applyRowGate({ default, others, rows }, row);
```

Reads the row's server-evaluated `$actions: string[]` field (populated when `state.includeActions=true` → `controls.$actions=true` on the query). Actions named in `$actions` are kept; others are filtered out. Exempt processors (`navigate`, `custom`, `__remove`) skip the gate.

Opt in to the synthesized column via `<AsTable :row-actions-column="'first' | 'last' | 'merge-select'">`. The column is locked: no header dropdown, no resize, no drag-reorder, never in `state.columnNames`.

Override the cell renderer via `controls.rowActions`.

## AsTableActions

`packages/vue-table/src/components/as-table-actions.vue`. Tier-1 toolbar component. Selection-aware level resolution:

| `level` prop | `selectedCount` | Effective level | Reads from                                                                                                 |
| ------------ | --------------- | --------------- | ---------------------------------------------------------------------------------------------------------- |
| `"auto"`     | 0               | `table`         | `state.actions.default.table`, `actions.others.table`                                                      |
| `"auto"`     | 1               | `row`           | `actions.default.row`, `actions.others.row`. Bulk `actions.rows` appended after separator in the `…` menu. |
| `"auto"`     | ≥2              | `rows`          | `actions.default.rows`, `actions.others.rows`                                                              |
| `"table"`    | any             | `table`         | (forced)                                                                                                   |
| `"rows"`     | any             | `rows`          | (forced)                                                                                                   |
| `"row"`      | any             | `row`           | (forced) — falls back to active row if selection is empty                                                  |

Renders nothing when no actions are visible. Single-action collapse: a sole non-default entry promotes into the labelled button rather than hiding behind `…`.

Slots:

| Slot                    | Slot props                                                                |
| ----------------------- | ------------------------------------------------------------------------- |
| default (full layout)   | `{ defaultAction, otherActions, trailingRowActions, level, ids, invoke }` |
| `#button` (default CTA) | `{ action }`                                                              |
| `#menu-item` (per item) | `{ action }`                                                              |

## AsActionFormDialog

`packages/vue-table/src/components/defaults/as-action-form-dialog.vue`. Lazy-mounted by `<AsTableRoot>` (avoids re-bundling `@atscript/vue-form` into every consumer that has no `@InputForm` actions).

Opens automatically when:

1. The action's `inputForm` field is set (an atscript type whose `@InputForm` schema describes the payload).
2. The user triggers the action.

Wire diagram:

```
user click → triggerAction(state, action, ctx, event)
  if action.inputForm:
    input = await state.requestActionInput(action, ctx)
    if input === null: return                    // cancel
    state.actions.invoke(action, pk, { event, input })
  else:
    confirmAction(state, action, ctx)            // prompt-text path
```

On submit, the dialog calls `state.acceptActionForm(input)`, the promise resolves, and `invoke` posts the action body:

```json
{
  "ids": { "id": 42 }, // singular `pk`
  "input": {
    /* form payload */
  }
}
```

Cross-link atscript-db skill for the action envelope shape and server-side processing.

Override via `controls.actionFormDialog` — assigning eager-mounts (skips the dynamic import). Subpath import for that path:

```typescript
import AsActionFormDialog from "@atscript/vue-table/as-action-form-dialog";
```

Form-type and form-component dispatch maps for the dialog interior come from `<AsTableRoot :form-types :form-components>` — same shape as the form package's defaults.

## state.actions API

`state.actions: TableActionsState` (`packages/vue-table/src/types.ts:49-91`):

| Field            | Type                                    | Notes                                                                      |
| ---------------- | --------------------------------------- | -------------------------------------------------------------------------- |
| `table`          | `TVueTableActionInfo[]`                 | Every table-level action.                                                  |
| `row`            | `TVueTableActionInfo[]`                 | Every row-level action; includes synthesized `__remove` when opted in.     |
| `rows`           | `TVueTableActionInfo[]`                 | Every rows-level (bulk) action.                                            |
| `default.table`  | `TVueTableActionInfo \| undefined`      | The declared default at that level.                                        |
| `default.row`    | `TVueTableActionInfo \| undefined`      | Never the synthesized `__remove`.                                          |
| `default.rows`   | `TVueTableActionInfo \| undefined`      |                                                                            |
| `others.<level>` | `TVueTableActionInfo[]`                 | The per-level list with the declared default removed.                      |
| `cellRow`        | `TVueTableActionInfo[]`                 | `[default?, ...others.row, ...rows]` — pre-flattened for `<AsRowActions>`. |
| `invoke`         | see below                               | Dispatcher.                                                                |
| `invoking`       | `ShallowRef<Set<string>>`               | Action names with in-flight invokes.                                       |
| `lastResult`     | `ShallowRef<Map<string, ActionResult>>` | Latest result per action name.                                             |

Invoke signature:

```typescript
state.actions.invoke(
  action: TVueTableActionInfo,
  pk?: Record<string, unknown> | Record<string, unknown>[],
  opts?: { suppressRefresh?: boolean; event?: KeyboardEvent | MouseEvent; input?: unknown },
): Promise<ActionResult>;
```

Per invariant on level: `pk = pkForLevel(action.level, identifiers)`:

| `action.level` | `pk` shape                          |
| -------------- | ----------------------------------- |
| `'table'`      | `undefined`                         |
| `'row'`        | `identifiers[0]` (single id object) |
| `'rows'`       | full identifier array               |

The convenience helper `triggerAction(state, action, ctx, event)` (`composables/state/intent-scope.ts:208-224`) routes through `requestActionInput` (form actions) or `confirmAction` (prompt-text actions) before calling `invoke`. Use it when wiring custom action triggers; `<AsRowActions>` and `<AsTableActions>` use it internally.

## Action result processing

```typescript
type ActionResult =
  | { ok: true; kind: "backend"; data: unknown; message?: string }
  | { ok: true; kind: "navigate" }
  | { ok: true; kind: "custom"; dispatched: true }
  | { ok: true; kind: "remove"; data: TDbDeleteResult }
  | { ok: false; kind: "error"; error: ClientError | Error };
```

Source: `packages/vue-table/src/types.ts:41-46`. Processor → result mapping (`composables/state/create-actions.ts:102-148`):

| `action.processor`    | Behavior                                                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `'backend'` (default) | `client.action(name, pk, opts.input)` → `{ ok: true, kind: 'backend', data, message? }`                                 |
| `'navigate'`          | `client.action(name, pk)` (server emits redirect) → `{ ok: true, kind: 'navigate' }`                                    |
| `'__remove'`          | `client.remove(pk)` → `{ ok: true, kind: 'remove', data }`                                                              |
| `'custom'`            | Bypasses HTTP. `{ ok: true, kind: 'custom', dispatched: true }` — caller writes the side effect via the `@action` emit. |

Refetch policy: post-success refetch only fires for `'backend'` / `'__remove'` and only when:

- `opts.suppressRefresh !== true`
- `refreshOnAction()` returns truthy (default `true`).

The `<AsTableRoot @action="(action, ids, result, event) => …">` emit settles **after** the refetch is scheduled — listeners can detect success and run additional UX (toasts, route changes).

## Selection model

| Field / fn                       | Source                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| `state.selectedRows`             | `ShallowRef<unknown[]>` — PKs derived via `rowValueFn(row)`.                                      |
| `state.selectedCount`            | `ComputedRef<number>`.                                                                            |
| `state.isPkSelected(pk)`         | Quick membership check.                                                                           |
| `state.rowValueFn(row)`          | Default extracts `preferredId` field(s); consumer can override via `<AsTableRoot :row-value-fn>`. |
| `togglePk(sel, pk, mode)`        | `@atscript/ui-table` helper. `"none"` no-op; `"single"` replaces; `"multi"` toggles.              |
| `trimSelection(sel, presentPks)` | Drops PKs not in the result set. Identity-stable on no-op.                                        |
| `rowsToPks(rows, rowValueFn)`    | Map a row array → PK array.                                                                       |

Selection persistence policy on every results-replacement (`<AsTableRoot :selection-persistence>`):

| Mode        | Effect on `selectedRows`                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `"trim"`    | Default. Drop PKs missing from new results; keep the rest. Survives sort / filter changes when PK still matches. |
| `"clear"`   | Drop everything.                                                                                                 |
| `"persist"` | Never write to `selectedRows`; full consumer ownership.                                                          |

`useTableSelection` (`composables/use-table-selection.ts`) distinguishes **results-replacement** (query / invalidate / pagination jump) from **results-extension** (queryNext / forward or backward `loadRange`) via first/last-row reference identity. Extensions don't trigger reconciliation.

`useSelectModeReset` clears `selectedRows` only on `'multi' → 'none'` transitions (renderer-owned, since `select` is a prop).

`state.includeActions: Ref<boolean>` is the renderer-owned toggle for the per-row `$actions` augmentation. Pushed automatically by `<AsTable>` / `<AsWindowTable>` when `:row-actions-column` is set AND the table has row/rows actions. Flipping it on triggers a refetch (watcher reacts) so subsequent results carry `$actions`.

## Recipes

### Bulk action — "Delete selected"

```atscript
@db.action.rows 'delete' @ui.action.label 'Delete selected' @ui.action.intent 'negative' @ui.action.confirm ['Delete $N item?', 'Delete $N items?']
```

```vue
<template>
  <AsTableActions level="auto" />
  <!-- level=auto picks rows when ≥2 selected -->
  <AsTable select="multi" />
</template>
```

The user selects rows (multi mode), clicks "Delete selected", confirms. `<AsTableActions>` calls `state.actions.invoke(deleteAction, identifiers[])`. Server validates and deletes; refetch fires.

### CSV export — custom processor

```atscript
@db.action.rows 'exportCsv' @ui.action.label 'Export CSV' @ui.action.processor 'custom'
```

`processor: 'custom'` means the client owns the side effect. Listen on `<AsTableRoot @action>`:

```vue
<script setup>
function onAction(action, ids, result) {
  if (!result.ok || action.name !== "exportCsv") return;
  if (action.processor !== "custom") return;

  // Read current page or window cache; export to CSV.
  const rows = state.results.value.filter((r) => state.isPkSelected(state.rowValueFn(r)));
  const csv = rowsToCsv(rows);
  download(csv, `export-${Date.now()}.csv`);
}
</script>

<template>
  <AsTableRoot url="/api/db/tables/orders" @action="onAction"> ... </AsTableRoot>
</template>
```

### Programmatic invoke from outside the table

```vue
<script setup>
import { useTableActions, useTableContext } from "@atscript/vue-table";

const { state } = useTableContext();
const actions = useTableActions(); // == state.actions

async function archiveSelected() {
  const archive = actions.rows.find((a) => a.name === "archive");
  if (!archive) return;
  const identifiers = state.selectedRows.value.map(/* … */);
  await actions.invoke(archive, identifiers);
}
</script>
```

### Disable an action per-row from the server

Server `@DbAction` handler returns the action name in the row's `$actions: string[]` only when allowed. The client-side `applyRowGate` will hide the action for that row automatically. No client-side wiring required — `state.includeActions` is set on by `<AsTable :row-actions-column>` so the query carries `?$actions=true` and the gate is fed.

### Confirm dialog overrides

For ad-hoc confirmations outside the action loop, use `state.prompt`:

```typescript
const ok = await state.prompt("Discard your changes?", { scope: "error" });
if (ok) discard();
```

| Field           | Default     | Notes                                                                                |
| --------------- | ----------- | ------------------------------------------------------------------------------------ |
| `confirmButton` | `"Confirm"` | Override label.                                                                      |
| `cancelButton`  | `"Cancel"`  |                                                                                      |
| `scope`         | `"primary"` | Vunor scope: `"primary" \| "secondary" \| "good" \| "warn" \| "error" \| "neutral"`. |

`<AsConfirmDialog>` renders the prompt; override via `controls.confirmDialog`.

### Built-in row delete

Without writing a `@DbAction`:

```vue
<AsTable :row-delete="true" :row-actions-column="'last'" />
<!-- or
<AsTable :row-delete="{ label: 'Remove', confirm: 'Remove $1?', icon: 'i-as-trash', intent: 'negative' }" />
-->
```

The synthesized `__remove` action appears in `state.actions.row` when:

1. `state.rowDelete.value` is truthy (renderer prop pushes this in).
2. `tableDef.canRemove === true` (server allows DELETE on the table).

Pure client construction — calls `client.remove(pk)`. Standard refetch behaviour applies.
