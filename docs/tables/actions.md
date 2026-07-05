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

::: warning Native new-tab navigations are silent to `@action`
When a [navigate action](#navigate-actions) is opened in a new tab
(middle-click, cmd/ctrl+click), the browser owns the navigation — it
does **not** call `invoke` and does **not** fire `@action`. Only a
plain left click on a navigate action routes in-SPA and emits (with
`kind: 'navigate'`). Don't hang new-tab side effects off `@action`.
:::

## Navigate actions

An action declared with `processor: 'navigate'` (see the
[db.atscript.dev annotations reference](https://db.atscript.dev)) sends
the user to a URL instead of mutating a row. The table renders these as
real `<a href>` anchors — so all native link affordances work:
middle-click and cmd/ctrl+click open a new tab, right-click offers "copy
link address" / "open in new tab", and the URL previews in the status
bar on hover. Menu items in the `…` dropdown render as links too.

Declare one server-side with `processor: 'navigate'` and a `value`
template — `$1` is the row identifier placeholder (see the
[db.atscript.dev annotations reference](https://db.atscript.dev)):

```typescript
@DbRowActions({
  view: { label: "View", processor: "navigate", value: "/customers/$1" },
})
class CustomersController extends AsDbController<typeof Customer> {}
```

### When it renders as a link

An action becomes an anchor when **all** hold:

- `processor === 'navigate'`;
- it has no confirm prompt (`@ui.action.confirm` / `promptText`);
- it has no `@InputForm`;
- a href is computable.

The href is computed at render time from the action's `value`. For a
row-level action, `$1` is replaced with the row's URL-encoded
`preferredId` — the same interpolation the client performs on invoke.
A row with no identifiable primary key (empty `preferredId`) yields no
href and the action falls back to a `<button>`. Confirmable navigate
actions and `@InputForm` navigate actions also stay buttons.

The signature of the render-time helper —
[`navigateHrefFor`](/api/ui#navigate-action-hrefs) — is exported from
`@atscript/ui` for consumers building their own action chrome.

### Click semantics

| Gesture on a linkable navigate action        | What happens                                                                                                                                                   |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plain left click (no modifier key)           | `preventDefault()` → routed through the normal invoke path. SPA routing runs via the client's `navigate` hook **and** `@action` fires with `kind: 'navigate'`. |
| Middle click / cmd(ctrl)+click / right click | Native browser behaviour (new tab, copy link, …). No `invoke`, **no `@action` emit** — the current tab's state is unchanged.                                   |

Confirmable navigate actions (those with a confirm prompt) stay
`<button>`s, because a confirm dialog can't guard a native anchor
navigation. On them a middle-click / cmd+click runs the **same
confirmation**, then on accept opens the target in a new tab via
`window.open(href, "_blank", "noopener,noreferrer")` — still no invoke,
no emit. A plain left click confirms then invokes, exactly as before.

### DOs and DON'Ts

- **DO** treat a plain left click as the only navigate gesture that
  reaches your app — SPA routing and `@action` both run there.
- **DON'T** rely on `@action` to observe new-tab navigations. Modified
  and middle clicks are native and silent to the emit; put nothing on
  `@action` that a new-tab open must trigger.
- **DO** set `resolveHref` when your app is served under a router base
  path (see below); root-hosted apps need nothing.

### `resolveHref` for base-path apps

`action.value` is interpolated to a raw path like `/customers/1`. When
your app is served under a router base path, map that raw path to a
fully-resolved href with the `resolveHref` prop on `<AsTableRoot>` (also
a `useTable({ resolveHref })` option):

```vue
<AsTableRoot url="/api/db/tables/customers" :resolve-href="resolveHref" />
```

```ts
import { useRouter } from "vue-router";

const router = useRouter();
const resolveHref = (url: string) => router.resolve(url).href;
```

`resolveHref` is applied **only** to the anchor's `href` attribute and
the new-tab `window.open` target — **never** to the plain-left-click
invoke path. That path goes through the client's `navigate` hook, which
already accounts for the base. Default is identity `(url) => url`.

Navigate actions are gated by per-row `$actions` exactly like any other
action (see [Per-row action availability](#per-row-action-availability)),
and their `ActionResult` on the invoke path is `{ ok: true, kind: 'navigate' }`.

## Row-level default action

A row action can be marked default. The framework's **main-action**
path invokes it on `dblclick` or **Enter** when the table is in
`select="none"` mode. Single-click is always reserved for cursor
placement / selection — never the default action. The current
default is exposed as `state.actions.default.row`.

The main-action (and the `@main-action` emit) always operate on the
currently **active** row, resolved by
[`state.getActiveRow()`](/api/vue-table#reactivetablestate) — the single
nav-mode-aware resolver (page-relative in pagination, absolute in
windowed mode). This resolves correctly on **every page**, including
page ≥ 2 in paginated tables. The same resolver backs selection and the
`<AsTableActions level="row">` toolbar, so all three stay in sync.

The selection state is reactive end-to-end: a `multi → none`
transition auto-clears `selectedRows`; the actions column
appears / disappears live without a remount; bulk action buttons
disable when nothing is selected.

## Per-row action availability

`state.includeActions` is a writable ref controlled by the
renderer. The `<AsTable :row-actions-column="...">` prop (or
`<AsWindowTable>`'s equivalent) flips it on when the table has at
least one row-level action. When on, `buildTableQuery` requests
per-row `$actions: string[]` from the server — the names of the
actions the server evaluated as **enabled** for that row.

The table gates its action chrome against that list:

- **Per-row dropdown** and the **single-selection toolbar** hide any
  action whose name is absent from that row's `$actions`.
- **Bulk selection** (≥2 rows) shows a bulk action when **at least
  one** selected row allows it — the union of the selected rows'
  `$actions`. An action enabled for only part of the selection stays
  visible; the server re-filters per row at invoke time, so it simply
  no-ops on the rows that don't qualify.

Every server-declared action is gated this way **regardless of its
processor** (`backend`, `navigate`, `custom`). The one exemption is the
client-synthesised `__remove` (from `:row-delete`): its name never
appears in `$actions`, so its visibility is governed by the table's
`canRemove` flag instead — the server still authorises the delete at
call time. Tables that don't opt into the actions column (no `$actions`
in the payload) skip gating entirely and render every declared action.

## Next steps

- [Customization](/tables/customization) — swap dialogs and row
  action chrome.
- [Server-Side Presets](/tables/server-presets) — wire up the
  Moost backend.
