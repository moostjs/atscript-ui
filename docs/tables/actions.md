---
outline: deep
---

# Actions & Selection

Actions are server-callable operations on a row, on a set of rows,
or on the table itself. They're declared on the server next to the
table's controller and the table renders them in the right place — a
dropdown in the row, a button on the toolbar, or a bulk button that
lights up only when rows are selected. Each action can declare an
`@InputForm` so the table opens a form dialog before submitting.

## Action levels

Three scopes:

| Scope   | Where it renders      | Operates on      |
| ------- | --------------------- | ---------------- |
| `row`   | per-row dropdown      | one row          |
| `rows`  | toolbar (bulk button) | selected rows    |
| `table` | toolbar               | the table itself |

Row actions render through `<AsRowActions>` — a single button when
the row has exactly one action, a `…` dropdown when it has more.
Table and bulk actions render through `<AsTableActions>` in the
toolbar.

Declaration lives on the server — `@atscript/moost-db`'s `@DbAction`
decorator on the table's controller. The level is **inferred** from
the handler's parameter decorators (`@DbActionID()` → `row`,
`@DbActionIDs()` → `rows`, neither → `table`), and the table receives
the finished list — name, label, level, icon, intent — from the
`/meta` response's `actions` array:

```typescript
import {
  AsDbController,
  TableController,
  DbAction,
  DbActionID,
  DbActionIDs,
} from "@atscript/moost-db";
import { Post } from "@moostjs/event-http";
import { Order } from "./schema/order.as";
import { ordersTable } from "./db";

@TableController(ordersTable)
export class OrdersController extends AsDbController<typeof Order> {
  @Post("actions/ship")
  @DbAction("ship", { label: "Ship" })
  async ship(@DbActionID() id: { id: string }) {
    // one identifier → level: 'row'
  }

  @Post("actions/export")
  @DbAction("export", { label: "Export" })
  async exportOrders(@DbActionIDs() ids: { id: string }[]) {
    // identifier array → level: 'rows'
  }
}
```

`@DbAction` carries the full server-side wiring — handler, input
form, intent, gating, and the level itself. See the
[db.atscript.dev annotations reference](https://db.atscript.dev)
for the full surface. The table just renders what `/meta` reports.

## Input forms

An action with `@InputForm` declares a `.as` type as its input
schema:

```atscript
export interface RefundInput {
    @meta.label 'Amount'
    amount: number

    @meta.label 'Reason'
    reason: string
}
```

```typescript
@Post("actions/refund")
@DbAction("refund", { label: "Refund" })
async refund(@DbActionID() id: { id: string }, @InputForm(RefundInput) input: RefundInput) {
  // ...
}
```

When the user invokes `refund`, the table opens
`<AsActionFormDialog>`. The dialog fetches the form schema, renders
it through `<AsForm>` (from `@atscript/vue-form`), and submits with
the form data wrapped as `{ input: ... }`. The dialog is mounted
lazily — only when an action with `@InputForm` is detected on the
table.

To customise the dialog body, use `<AsTableRoot>`'s `#actionForm`
slot — it forwards through to the dialog. To replace the dialog
entirely, swap `controls.actionFormDialog` (Tier 2).

## Selection

`state.selectedRows` is a `ShallowRef<unknown[]>` — the primary
keys (or composite-PK objects) of selected rows. The selection
mode is set on `<AsTable :select="...">`:

- `"none"` (default) — no checkboxes; row clicks fire the default action.
- `"single"` — radio-style: row clicks replace the selection with that row's PK.
- `"multi"` — checkbox column; clicks toggle selection.

```vue
<AsTable :select="select" :row-delete="canDeleteRows" />
```

`canDeleteRows` is a boolean (or `RowDeleteOpt`) — when true, the
table synthesises a `__remove` row action with a confirm prompt.

`state.selectedCount` is a computed for badge counts.
`state.isPkSelected(pk)` is the O(1) "is this row selected"
predicate used internally by the checkbox cell.

## Programmatic invocation

`state.actions.invoke(action, pk?, opts?)` invokes any action
without going through the UI:

```ts
import { useTableActions } from "@atscript/vue-table";

const actions = useTableActions();

// Per-row
const result = await actions.invoke(action, { id: "order-123" });

// Bulk
const result = await actions.invoke(action, [{ id: "order-1" }, { id: "order-2" }]);

if (result.ok) {
  // result.kind: 'backend' | 'navigate' | 'custom' | 'remove'
} else {
  // result.kind === 'error', result.error: ClientError | Error
}
```

`pk` is always an identifier **object** (or array of objects),
never a bare scalar. This is per `@atscript/db-client`'s invariant
#11 — even a single-PK table sends `{ id: "..." }`.

`InvokeOpts.input` carries the `@InputForm` payload for actions
that have one; `InvokeOpts.suppressRefresh` skips the post-success
re-query for this one call; `InvokeOpts.event` bridges to the
`<AsTableRoot @action>` emit.

The result is a discriminated union — it never throws. Toast / log
based on `result.ok` and `result.kind`.

## The `@action` emit

`<AsTableRoot @action="onAction">` fires after every action result.
This is where apps wire **custom processors** — actions whose
`processor === 'custom'` skip the server entirely and dispatch to
client code:

```ts
function onAction(action: TVueTableActionInfo, ids: unknown[], result: ActionResult) {
  if (action.processor === "custom" && action.name === "export-csv") {
    void downloadCsv(apiPath, ids);
    return;
  }
  if (!result.ok) {
    pushToast(false, `${action.label} failed: ${result.error.message}`);
    return;
  }
  if (result.kind === "remove") {
    const removed = (result.data as { deletedCount?: number })?.deletedCount ?? 1;
    pushToast(true, `Deleted ${removed} row(s).`);
  }
  // ...
}
```

The CSV export pattern is straightforward: declare the action as
`processor: 'custom'` on the `.as`, then match it by name in the
`@action` handler.

## Row-level default action

A row action can be marked default. The framework's **main-action**
path invokes it on `dblclick` or **Enter** when the table is in
`select="none"` mode. Single-click is always reserved for cursor
placement / selection — never the default action. The current
default is exposed as `state.actions.default.row`.

The selection state is reactive end-to-end: a `multi → none`
transition auto-clears `selectedRows`; the actions column
appears / disappears live without a remount; bulk action buttons
disable when nothing is selected.

## Toggling action-column visibility

`state.includeActions` is a writable ref controlled by the
renderer. The `<AsTable :row-actions-column="...">` prop (or
`<AsWindowTable>`'s equivalent) flips it on when the table has at
least one row-level action. When on, `buildTableQuery` requests
per-row `$actions: string[]` from the server so the dropdown can
hide actions that are server-disabled for this specific row.

## Next steps

- [Customization](/tables/customization) — swap dialogs and row
  action chrome.
- [Server-Side Presets](/tables/server-presets) — wire up the
  Moost backend.
