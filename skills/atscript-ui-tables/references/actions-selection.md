Row / table / rows actions, selection model, recipes.

## Contents

- [Action declaration on .as](#action-declaration-on-as)
- [Action levels](#action-levels)
- [AsRowActions](#asrowactions)
- [AsTableActions](#astableactions)
  - [Disabled with a reason](#disabled-with-a-reason)
- [AsActionFormDialog](#asactionformdialog)
- [state.actions API](#stateactions-api)
- [Action result processing](#action-result-processing)
- [Selection model](#selection-model)
- [Per-screen row-action policy](#per-screen-row-action-policy-rowactions-since-01134)
- [Row actions on a view (delegated, since 0.1.147)](#row-actions-on-a-view-delegated-since-01147)
- [Recipes](#recipes)

Query selection ("Select all N matching", run on every row of a query): [select-all-matching.md](select-all-matching.md).

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

Identifier objects are object-only (never bare scalars) — cross-link atscript-db skill invariant #11.

## AsRowActions

`components/defaults/as-row-actions.vue`. Renders the cell for the synthesized `__actions` pseudo-column.

- 0 visible actions → empty `<td>` (placeholder for `table-layout: fixed`).
- 1 action → three-way render:
  - linkable navigate action (`processor: 'navigate'`, no `promptText`, no `inputForm`, href computable) → `<a href>` anchor (real link: middle/cmd-click new-tab, copy link, hover preview);
  - confirmable navigate action (has `promptText`) → `<button>` (mod/middle-click still confirms → `window.open`);
  - anything else → plain `<button>` (`label` for label-only actions, icon button otherwise).
- ≥2 actions → `…` dropdown (`<AsActionMenuContent>`) — linkable navigate items render as `DropdownMenuItem as="a"`.

Href computed via `navigateHrefFor(action, id, preferredId)` (from `@atscript/ui`) then mapped through `resolveHref`. See [Action result processing](#action-result-processing) for click semantics.

Resolves its actions with `resolveRowActions(state, row)` — the row's server-evaluated `$actions: string[]` + `$disabledReasons` (populated when `state.includeActions=true` → `controls.$actions=true` on the query) and the `:row-actions` policy in one pass. (`state.actions.cellRow` is the ungated, policy-free server list.)

| Row verdict                          | Rendered                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| name in `$actions`                   | enabled                                                                                           |
| name in `$disabledReasons` (0.1.144) | shown disabled: copy with `disabledReason`, see [Disabled with a reason](#disabled-with-a-reason) |
| neither                              | hidden                                                                                            |

**Every server-declared action is gated regardless of processor** (`backend`, `navigate`, `custom`). The sole exemption is the client-synthesised `__remove` — its name never appears in `$actions`, so its visibility is governed by `tableDef.canRemove` (the server still authorises the delete at invoke).

Opt in to the synthesized column via `<AsTable :row-actions-column="'first' | 'last' | 'merge-select'">` — `<AsWindowTable>` takes the same prop (since 0.1.138). The column is locked: no header dropdown, no resize, no drag-reorder, never in `state.columnNames`. It renders when the row menu has anything to show — a row-level action, a rows-level one (they join every row's menu) or a `:row-actions` `extra` action; ≤ 0.1.146 only row-level actions counted, so a rows-only table got no column.

Override the cell renderer via `controls.rowActions`.

## AsTableActions

Tier-1 toolbar component. Selection-aware level resolution:

| `level` prop | `selectedCount` | Effective level | Reads from                                                                                                 |
| ------------ | --------------- | --------------- | ---------------------------------------------------------------------------------------------------------- |
| `"auto"`     | 0               | `table`         | `state.actions.default.table`, `actions.others.table`                                                      |
| `"auto"`     | 1               | `row`           | `actions.default.row`, `actions.others.row`. Bulk `actions.rows` appended after separator in the `…` menu. |
| `"auto"`     | ≥2              | `rows`          | `actions.default.rows`, `actions.others.rows`                                                              |
| `"table"`    | any             | `table`         | (forced)                                                                                                   |
| `"rows"`     | any             | `rows`          | (forced)                                                                                                   |
| `"row"`      | any             | `row`           | (forced) — falls back to active row if selection is empty                                                  |

Renders nothing when no actions are visible. Single-action collapse: a sole non-default entry promotes into the labelled button rather than hiding behind `…`.

The default CTA renders as an `<a href>` anchor when it's a linkable navigate action (same conditions as `<AsRowActions>`); confirmable navigate CTA stays a `<button>`. Menu items follow the same anchor/button split. See [Action result processing](#action-result-processing).

**Per-row `$actions` gate.** The `row` surface (1 selected) resolves the active/selected row through `resolveRowActions`, same as `<AsRowActions>`. The `rows` surface (≥2 selected) gates against the **union** of the LOADED selected rows' `$actions` (`state.selectedRowObjects`) — a bulk action is enabled when **at least one** of them allows it; the server re-checks every row at invoke (`onDisabledRows: 'skip'` → runs on the qualifying rows; default `'reject'` → 409 with per-row reasons as an error result). Scalar selections (`rowValueFn` → PK) resolve through `state.rowOf` (since 0.1.144; before, the toolbar skipped gating for them). A selected value whose row is not loaded has no client verdict: it never enables an action by itself; a selection with NO loaded row → no gating (server decides). `__remove` is the sole exemption. No `$actions` on any row → no gating (legacy / opt-out).

Slots:

| Slot                    | Slot props                                                                |
| ----------------------- | ------------------------------------------------------------------------- |
| default (full layout)   | `{ defaultAction, otherActions, trailingRowActions, level, ids, invoke }` |
| `#button` (default CTA) | `{ action }`                                                              |
| `#menu-item` (per item) | `{ action }`                                                              |

### Disabled with a reason

Server `disabled` predicate returns a string → row gets `$disabledReasons: { name: reason }` (`@atscript/db` 0.1.141+) → action SHOWN disabled instead of hidden. Since 0.1.144.

| #   | Rule                                                                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Gated copies carry `action.disabledReason` (non-empty); `state.actions.*` never do. Test `!!action.disabledReason`.                                                                                                                                                                             |
| 2   | Rendered `aria-disabled="true"`, never native / reka `disabled`: stays focusable (Tab, arrow keys) so the reason is announced. Accessible name + button `title` = `"Label, reason"`; menu items show the reason on its own line (`.as-*-menu-item-reason`).                                     |
| 3   | Inert on every path: click, Enter, middle/cmd-click, slot `invoke`, the menu (`select` swallowed, menu stays open). A disabled `navigate` action gets no href (never an anchor).                                                                                                                |
| 4   | Bulk (≥2 selected): allowed by no loaded row but reasoned by some → disabled with the distinct reasons (max 3, `"A; B; C; +2 more"`); any row allowing it wins.                                                                                                                                 |
| 5   | Main action (dblclick / Enter fallback) resolves the active row's default through `resolveRowActions`: hidden, disabled, excluded or not `include`d → does NOT fire; `overrides` (e.g. `promptText`) apply. A registered `@main-action` listener still gets every request.                      |
| 6   | `:row-actions` `overrides` keep the reason; `include`/`exclude` still hide. `extra[].enabled(row)`: non-empty string = disabled with that reason; `false` = hidden; `true` / `""` = enabled.                                                                                                    |
| 7   | `#button` / `#menu-item` slots replace content only (wrapper keeps the disabled state). A `default`-slot replacement or a custom row-actions cell (`controls.rowActions` + `resolveRowActions(state, row)`) must render it and skip `invoke` itself (`state.actions.invoke` does not check it). |
| 8   | A request that slips through → 409 `ActionDisabledError`; `message` is the reason (toast-ready via `result.error.message`); db-client error has `.reason` / `.reasons`.                                                                                                                         |

## AsActionFormDialog

Lazy-mounted by `<AsTableRoot>` (avoids re-bundling `@atscript/vue-form` into every consumer that has no `@InputForm` actions).

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

`state.actions: TableActionsState`:

| Field            | Type                                    | Notes                                                                      |
| ---------------- | --------------------------------------- | -------------------------------------------------------------------------- |
| `table`          | `TVueTableActionInfo[]`                 | Every table-level action.                                                  |
| `row`            | `TVueTableActionInfo[]`                 | Every row-level action; includes synthesized `__remove` when opted in.     |
| `rows`           | `TVueTableActionInfo[]`                 | Every rows-level (bulk) action.                                            |
| `default.table`  | `TVueTableActionInfo \| undefined`      | The declared default at that level.                                        |
| `default.row`    | `TVueTableActionInfo \| undefined`      | Never the synthesized `__remove`.                                          |
| `default.rows`   | `TVueTableActionInfo \| undefined`      |                                                                            |
| `others.<level>` | `TVueTableActionInfo[]`                 | The per-level list with the declared default removed.                      |
| `cellRow`        | `TVueTableActionInfo[]`                 | `[default?, ...others.row, ...rows]` — not gated; see `resolveRowActions`. |
| `invoke`         | see below                               | Dispatcher.                                                                |
| `countTarget`    | `(action, target, event?)`              | 0.1.147+. Query-target dry-run count — see select-all-matching.md.         |
| `invoking`       | `ShallowRef<Set<string>>`               | Action names with in-flight invokes.                                       |
| `lastResult`     | `ShallowRef<Map<string, ActionResult>>` | Latest result per action name.                                             |

Invoke signature:

```typescript
state.actions.invoke(
  action: TVueTableActionInfo,
  pk?: Record<string, unknown> | Record<string, unknown>[],
  opts?: {
    suppressRefresh?: boolean;
    event?: KeyboardEvent | MouseEvent;
    input?: unknown;
    row?: Record<string, unknown>;
    target?: ActionQueryTarget; // 0.1.147+: run on a query (pk = undefined) — select-all-matching.md
    expectCount?: number;
    confirmTargetChange?: (matched: number) => Promise<boolean>;
  },
): Promise<ActionResult>;
```

Per invariant on level: `pk = pkForLevel(action.level, identifiers)`:

| `action.level` | `pk` shape                          |
| -------------- | ----------------------------------- |
| `'table'`      | `undefined`                         |
| `'row'`        | `identifiers[0]` (single id object) |
| `'rows'`       | full identifier array               |

The convenience helper `triggerAction(state, action, ctx, event)` routes through `requestActionInput` (form actions) or `confirmAction` (prompt-text actions) before calling `invoke`. Use it when wiring custom action triggers; `<AsRowActions>` and `<AsTableActions>` use it internally.

## Action result processing

```typescript
type ActionResult =
  | { ok: true; kind: "backend"; data: unknown; message?: string }
  | { ok: true; kind: "navigate" }
  | { ok: true; kind: "custom"; dispatched: true }
  | { ok: true; kind: "remove"; data: TDbDeleteResult }
  | { ok: false; kind: "error"; error: ClientError | Error };
```

Processor → result mapping:

| `action.processor`    | Behavior                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'backend'` (default) | `client.action(name, pk, opts.input)` → `{ ok: true, kind: 'backend', data, message? }`                                                                                   |
| `'navigate'`          | Renders as `<a href>` (href = `navigateHrefFor` → `resolveHref`). Plain-left-click → invoke → SPA `navigate` hook + `{ ok: true, kind: 'navigate' }`. See gestures below. |
| `'__remove'`          | `client.remove(pk)` → `{ ok: true, kind: 'remove', data }`                                                                                                                |
| `'custom'`            | Bypasses HTTP. `{ ok: true, kind: 'custom', dispatched: true }` — caller writes the side effect via the `@action` emit.                                                   |

Refetch policy: post-success refetch only fires for `'backend'` / `'__remove'` and only when:

- `opts.suppressRefresh !== true`
- `refreshOnAction()` returns truthy (default `true`).

The `<AsTableRoot @action="(action, ids, result, event) => …">` emit settles **after** the refetch is scheduled — listeners can detect success and run additional UX (toasts, route changes).

### Navigate action rendering & gestures

`import { navigateHrefFor } from "@atscript/ui"` — pure render-time href helper: `navigateHrefFor(action, id, preferredId): string | undefined`. Returns `undefined` (→ render a `<button>`) when the action isn't `navigate` or a row-level action has no identifiable pk. Level `!== 'row'` → `action.value` verbatim; level `'row'` → `$1` replaced with URL-encoded `preferredId`. The built-in components pipe its result through `resolveHref`.

Trigger — user clicks a linkable navigate action (anchor variant):

| Gesture                                                | Effect                                                                                                                                                   |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plain left click (main button, no ctrl/meta/shift/alt) | `preventDefault()` → same invoke path (`triggerAction` → `state.actions.invoke`). SPA `navigate` hook runs **and** `@action` fires (`kind: 'navigate'`). |
| Modified / middle / right click                        | Native browser (new tab, copy link). **No invoke, no `@action` emit.**                                                                                   |

Confirmable navigate action (has `promptText`) stays a `<button>`: plain click → confirm → invoke; middle / cmd(ctrl)+click → same confirm → on accept `window.open(href, "_blank", "noopener,noreferrer")` (no invoke, no emit).

**`resolveHref`** — `<AsTableRoot :resolve-href>` prop / `useTable({ resolveHref })` option, `(url: string) => string`, default identity. Maps the interpolated href for base-path apps (`(url) => router.resolve(url).href`). Applied ONLY to the anchor `href` / `window.open` target — **never** on the invoke path (the client `navigate` hook already accounts for the base).

Invariants:

| #   | Rule                                                                                                                                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | **Native new-tab navigations are silent to `@action`.** Only a plain left click on a navigate action invokes + emits (`kind: 'navigate'`). Modified/middle/right clicks are owned by the browser — no `invoke`, no emit. Never hang new-tab side effects off `@action`. |
| N2  | **`resolveHref` never touches the invoke path.** It maps only the anchor `href` and `window.open` target. The plain-left-click SPA route goes through the client `navigate` hook, which already applies the base path.                                                  |

## Selection model

| Field / fn                       | Source                                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `state.selectedRows`             | `ShallowRef<unknown[]>` — PKs derived via `rowValueFn(row)`.                                                                                     |
| `state.selectedCount`            | `ComputedRef<number>`.                                                                                                                           |
| `state.isPkSelected(pk)`         | Quick membership check.                                                                                                                          |
| `state.selectAll(rows)`          | ADD the eligible rows' PKs (0.1.142+; replaced the selection before). Everything else stays.                                                     |
| `state.deselectAll(rows)`        | 0.1.142+. Remove the eligible rows' PKs; everything else (and ineligible picks) stays.                                                           |
| `state.toggleAll(rows)`          | 0.1.142+. The header's action over `rows`: deselect when every eligible one is selected, else select.                                            |
| `state.clearSelection()`         | 0.1.142+. The real clear — every PK, loaded or not, eligible or not.                                                                             |
| `state.getActiveRow()`           | Active-row resolver — nav-mode-aware (see invariant below). Returns `undefined` when `activeIndex < 0`. Signature: API ref `ReactiveTableState`. |
| `state.rowValueFn(row)`          | Default extracts `preferredId` field(s); consumer can override via `<AsTableRoot :row-value-fn>`.                                                |
| `state.rowOf(value)`             | 0.1.144+. Loaded row behind a selection value (object → itself, scalar → lookup); `undefined` if not loaded.                                     |
| `state.selectedRowObjects`       | 0.1.144+. `ComputedRef` — the selection's LOADED rows, in order (unloaded values left out).                                                      |
| `state.rowByValue`               | 0.1.144+. `ComputedRef<ReadonlyMap>` of loaded rows by `rowValueFn` value; rebuilt once per fetch, lazily.                                       |
| `togglePk(sel, pk, mode)`        | `@atscript/ui-table` helper. `"none"` no-op; `"single"` replaces; `"multi"` toggles.                                                             |
| `trimSelection(sel, presentPks)` | Drops PKs not in the result set. Identity-stable on no-op.                                                                                       |
| `rowsToPks(rows, rowValueFn)`    | Map a row array → PK array.                                                                                                                      |

Invariants:

| #   | Rule                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | **`state.getActiveRow()` is the single correct active-row resolver.** Nav-mode-aware: paginated `<AsTable>` → page-relative into `results`; windowed `<AsWindowTable>` → absolute via `windowCache`. Selection, the `@main-action` emit, and the `<AsTableActions level="row">` toolbar all share it — correct on every page (incl. page ≥ 2). Don't index `results` by `absIndex` to find the active row; call `getActiveRow()`. |

Selection persistence policy on every results-replacement (`<AsTableRoot :selection-persistence>`):

| Mode        | Effect on `selectedRows`                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `"trim"`    | Default. Drop PKs missing from new results; keep the rest. Survives sort / filter changes when PK still matches. |
| `"clear"`   | Drop everything.                                                                                                 |
| `"persist"` | Never write to `selectedRows`; full consumer ownership.                                                          |

### Per-row selectability (`:row-selectable`, since 0.1.133)

`<AsTable :row-selectable="(row, { index, selected }) => boolean | string | undefined">`. `false` or a string blocks selection; the string is the disabled reason; `true` / `undefined` allow it. Works on `<AsWindowTable>` too — the rule lives in the selection model (`state.rowSelectable`, pushed by the renderer like `:row-delete`), not in either renderer.

Gated paths: row click, Space/Enter toggle, header select-all, and the select-all "all" count (measured against selectable rows only).

| Rule                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Select-all is ADDITIVE for ineligible rows: a pk that is already selected but is now ineligible is KEPT, and it does not stop the header reading "all". |
| The tri-state header compares the selection against ELIGIBLE rendered rows only.                                                                        |
| The header select-all control is `role="checkbox"` + `aria-label="Select all rows"` and activates on Space / Enter as well as click.                    |

### Header scope (0.1.142+)

| #   | Rule                                                                                                                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | `<AsTable>` header acts on LOADED rows only: select = union with the selection, deselect = remove only loaded eligible PKs. Picks on other pages (`selectionPersistence: 'persist'`) survive both.                                       |
| H2  | Header state `none`/`some`/`all` is measured against eligible LOADED rows — off-page picks alone read `none`. Before 0.1.142 they read `some` and a click CLEARED everything.                                                            |
| H3  | `<AsWindowTable>` renders the header checkbox ONLY once every row of the dataset is loaded (then = H1 over all rows). Partial dataset → no control; `#header-__select` gets `state: undefined` + `selectedCount` for a host count/clear. |
| H4  | Need "clear everything" → `state.clearSelection()`. "Select all N matching" (unloaded rows) is NOT supported.                                                                                                                            |

### `select-on` + `__select` slots (0.1.142+)

`<AsTable select="multi" select-on="control">` (also `<AsWindowTable>`): only the checkbox toggles; a row click just moves the active row and still emits `row-click`. Default `"row"` = click anywhere toggles. Space / Enter on the active row toggle in both. A checkbox click in `control` mode emits no `row-click` and no dblclick main-action.

| Slot                                                                    | Props                                                                                                                  |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `#header-__select="{ state, toggle, selectedCount }"`                   | `state`: `SelectAllState` or `undefined` (no select-all available); `toggle()` = the header's action.                  |
| `#cell-__select="{ row, index, selected, selectable, reason, toggle }"` | `index` absolute in window mode; `selectable`/`reason` from `:row-selectable`; `toggle()` toggles (gated) + activates. |

| Rule                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------- |
| Call `toggle` with `@click.stop` — in `select-on="row"` an unstopped click also reaches the row and toggles it back.                     |
| A slot replaces the default control's a11y — supply `role="checkbox"`/`aria-checked`/a name (or a native checkbox) yourself.             |
| Both slots are forwarded through `<AsTable>` / `<AsWindowTable>`; `__select` is a slot name only, never a column in `state.columnNames`. |

```vue
<AsTable
  select="multi"
  :row-selectable="(row) => (row.archived ? 'Archived rows cannot be picked' : true)"
/>
```

Rendered contract on a standalone `<AsTable>`:

| Element                     | Attribute                                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| selection cell (every row)  | `role="checkbox"`, `aria-checked`, `aria-label="Select row"`, `tabindex="0"`, Space toggles                    |
| selection cell (ineligible) | `aria-disabled="true"`, `title="<reason>"`, `aria-label="Select row, <reason>"`, `.as-table-checkbox-disabled` |
| `<tr>` (ineligible)         | `data-selectable="false"`                                                                                      |

Both `<AsTable>` and `<AsWindowTable>` accept the row hooks (since 0.1.133) — the rule lives in the selection model (`state.rowSelectable`, `isRowSelectable`, `selectAll`), pushed in by whichever renderer is mounted, so neither renderer re-implements it. See [customization.md](customization.md#row-hooks-since-01133).

### Running-action feedback (since 0.1.133)

`<AsTableActions>` marks an in-flight trigger `aria-busy="true"` and suffixes its ACCESSIBLE name with `", running"` (visible label unchanged). It also renders one `role="status" aria-live="polite"` sr-only region OUTSIDE the default slot, announcing `"<label> running"` → `"<label> finished"` / `"<label> failed"`. A custom `#default` slot keeps the announcements; per-item states inside `<AsRowActions>` menus are not covered.

Window-mode scroll extensions don't reconcile selection — only fresh top-level fetches (query, invalidate, pagination jump) re-evaluate `selectedRows` against the new results. Switching `select` from `"multi"` to `"none"` clears the current selection.

## Per-screen row-action policy (`:rowActions`, since 0.1.134)

`<AsTableRoot :row-actions="config">` narrows / relabels the server's row-action set for one screen and appends app-owned actions. Pushed into `state.rowActions` like `:row-delete` and compiled once into `state.rowActionsPolicy`, which EVERY row-action surface reads: `<AsRowActions>` (including a standalone one inside the table) and the `<AsTableActions level="row">` selection toolbar. They cannot show different sets.

```ts
interface RowActionsConfig {
  include?: string[]; // allowlist of SERVER action names
  exclude?: string[]; // denylist, applied after include; also drops a same-named extra
  overrides?: Record<
    string,
    Partial<Pick<TVueTableActionInfo, "label" | "icon" | "intent" | "promptText">>
  >;
  extra?: LocalRowAction[]; // app-owned, appended after the server ones
}

interface LocalRowAction {
  name: string;
  label: string;
  icon?: string;
  intent?: TDbActionIntent;
  promptText?: string | [string, string];
  href?: (row) => string; // → real <a>, mapped through state.resolveHref
  onInvoke?: (row, pk?) => void | Promise<void>; // → awaited, then @action kind: 'custom'
  enabled?: (row) => boolean;
}
```

```vue
<AsTableRoot
  url="/api/db/tables/orders"
  :row-actions="{
    include: ['approve', 'cancel'],
    overrides: { cancel: { label: 'Void', intent: 'negative' } },
    extra: [{ name: 'audit', label: 'Audit trail', onInvoke: (row) => openAudit(row) }],
  }"
/>
```

Order of application: the per-row `$actions` gate runs FIRST, then the policy. So `include` can only narrow what the server already allowed for that row, and `overrides` are cosmetic — neither can surface a gated action. `include` does NOT apply to `extra` (being listed there is the opt-in); `exclude` and `enabled(row)` do. `include: []` therefore hides every server action and keeps the extras — the way to replace a screen's row actions wholesale.

`<AsRowActions :actions="[...]">` renders an explicit list, bypassing both the server set and the policy — for a standalone cell that must show something hand-picked.

## Row actions on a view (delegated, since 0.1.147)

A view controller with `@DbActionsFrom(() => SourceController)` (moost-db) lists the source table's row/rows actions in its `/meta` and `$actions`. Nothing to wire in the UI.

| #   | Rule                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Delegated `TDbActionInfo` carries `owner` (source base path), usually `idMap` (source id field → view column, e.g. `{ id: "taskId" }`), `formUrl` (source's form) and, when it takes one, `queryTarget.url` (the view's delegated route). `disabled` is not sent — `$actions` / `$disabledReasons` decide.                                                                                                      |
| D2  | `tableDef.identifierFields` = `preferredId` ∪ every `idMap` value; every built-in surface extracts identifiers with it (`identifierFieldsOf(def)`). `actionIdentifiers(action, ids, preferredId)` narrows per action: delegated → exactly the `idMap` paths (db-client maps them to the owner's id and POSTs to `value`, the source route); own action → exactly `preferredId` (the server rejects extra keys). |
| D3  | Views usually have no `preferredId` — identifiers come from the `idMap` columns alone; the server adds them to `$select` even when hidden. Keep the default `rowValueFn` (row object) or one keyed by an `idMap` column on view tables: a scalar key whose row is not loaded cannot be mapped → the client's `TypeError` settles as the action's error result.                                                  |
| D4  | `navigateHrefFor` / row anchors map through `idMap` too (`$1` = owner id in `Object.keys(idMap)` order).                                                                                                                                                                                                                                                                                                        |
| D5  | Delegated query-target actions work in a query selection like own ones (exclusions keyed by the `idMap` view paths).                                                                                                                                                                                                                                                                                            |

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

### CSV export — native hook (preferred, since 0.1.134)

```ts
import { useTableExport, downloadExport } from "@atscript/vue-table";

const { exportRows, exporting } = useTableExport();
downloadExport(await exportRows({ filename: "orders.csv", csv: { bom: true } }));
```

Reuses the table's live query, visible column order and cell-value resolution, and pages through every matching row. Full contract: [export.md](export.md).

### CSV export — custom processor (server-side exports)

Still the right shape when the file must be produced by the backend (signed URL, heavy report job).

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

Server `@DbAction` `disabled` predicate decides per row; the row's `$actions: string[]` lists the allowed names. The row-actions cell and toolbar hide the others automatically — or show them disabled when the predicate returns a reason string ([Disabled with a reason](#disabled-with-a-reason)). No client-side wiring required — `state.includeActions` is set on by `:row-actions-column` (on `<AsTable>` or `<AsWindowTable>`) so the query carries `?$actions=true` and the gate is fed.

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
