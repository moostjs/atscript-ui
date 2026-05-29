---
outline: deep
---

# State Persistence

Workflow state has to live somewhere between steps. The framework
ships two strategies; this page covers when to use which, and how to
plug an atscript-db table in as a durable backend with `AsWfStore`.

## The two strategies

### `EncapsulatedStateStrategy` (default for short flows)

The state token is the state. Each round-trip the framework encrypts
the current `{ schemaId, indexes, context }` into a signed blob and
sends it back as `wfs`. The client returns the blob, the server
decrypts, runs the next step.

- No DB row, no cleanup, no migrations.
- Token lives wherever you put it (body / cookie / URL).
- **Lost if the client loses the token** (page reload without the
  token in cookie/URL).
- Token size scales with context size — keep `ctx` lean.

Good for: login, MFA, password change, multi-step forms where the
whole thing finishes in one sitting.

### `HandleStateStrategy` (DB-backed; `AsWfStore`)

The token is a UUID handle; the state lives in a database row. Each
step reads/writes the row.

- Survives process restarts.
- Survives the client dropping the token (you can hand the same
  UUID to another channel — see [Outlets & Resume](/workflows/outlets-resume)).
- Smaller tokens (just the UUID).
- Indexable: shadow columns expose context values as real DB
  columns, so an admin UI can `SELECT FROM wf_states WHERE
inviteEmail = 'a@b.com'`.
- Needs cleanup of expired rows.

Good for: email magic links (invite + finish-account), multi-day
approvals, "save and continue later", anything where the user
might come back after the browser tab is gone.

## Picking per workflow

`state` accepts either a single `WfStateStrategy` instance (the
shortcut — auto-registered under the name `'default'`) or a **named
registry** when you want to mix strategies across flows:

```ts
const encapsulatedStrategy = new EncapsulatedStateStrategy({ secret: WF_SECRET });
const handleStrategy = new HandleStateStrategy({ store: wfStore });

const HANDLE_STATE_WFIDS = new Set<string>(["users/invite", "approvals/multi-step"]);

@Post("wf")
async handle() {
  // ...
  return handleAsOutletRequest(
    {
      allow: ALLOWED_WORKFLOWS,
      state: {
        strategies: { handle: handleStrategy, encapsulated: encapsulatedStrategy },
        default: (wfid) => (HANDLE_STATE_WFIDS.has(wfid) ? "handle" : "encapsulated"),
      },
      // ...
    },
    deps,
  );
}
```

`default` picks the strategy name when a flow **starts** — a plain
string or a `(wfid) => name` function. The chosen name is embedded in
the issued token as `<name>.<raw>`, so on **resume** the framework
re-selects the strategy that persisted the state automatically — no
need to inspect token shape. Each strategy keeps its own independent
storage; names must match `/^[A-Za-z0-9_-]+$/`.

::: tip Version note
The named registry landed in `@wooksjs/event-wf` 0.7.16
(`@moostjs/event-wf` 0.6.18) and **replaced** the old
`state: (wfid) => WfStateStrategy` callback form, which was removed.
A step can also escalate at runtime with `swapStrategy('name')` (it
applies to the next pause). See the Moost docs for the full registry
contract.
:::

## Wiring `AsWfStore`

`AsWfStore` implements `WfStateStore` from `@prostojs/wf/outlets`,
backed by any `AtscriptDbTable` whose row shape extends
`AsWfStateRecord`.

### 1. Define the row type

Create a `.as` file that extends the base record with your
`@meta.id` primary key (and optionally shadow columns — covered
below):

```atscript
import { AsWfStateRecord } from '@atscript/moost-wf/store'

@db.table 'wf_states'
export interface WfStateRow extends AsWfStateRecord {
    @meta.id
    @ui.table.hidden
    @db.default.uuid
    id: string

    // Indexable shadow columns from workflow context — covered below.
    @meta.label 'Invite Email'
    @wf.store.fromContext 'email'
    @db.index.plain 'email_idx'
    inviteEmail?: string

    @meta.label 'Invite Role'
    @wf.store.fromContext 'roleName'
    @db.index.plain 'role_idx'
    inviteRole?: string
}
```

The base `AsWfStateRecord` already declares:

| Column           | Type               | Notes                                                                                    |
| ---------------- | ------------------ | ---------------------------------------------------------------------------------------- |
| `handle`         | `string`           | Opaque correlation token; uniquely indexed (`handle_idx`).                               |
| `schemaId`       | `string`           | The workflow ID (`auth/login`, `users/invite`); indexed (`schema_idx`).                  |
| `state`          | JSON               | `{ context, indexes, meta? }` — the full state blob. `@db.json`, hidden from list views. |
| `expiresAt?`     | `number.timestamp` | Optional expiry; indexed (`expires_idx`).                                                |
| `updatedAt`      | `number.timestamp` | Set on every write; indexed (`updated_idx`).                                             |
| `createdAt`      | `number.timestamp` |                                                                                          |
| `createdBy?`     | `string`           | Stamped by the `actor` resolver.                                                         |
| `lastUpdatedBy?` | `string`           |                                                                                          |

### 2. Register the table with your db space

Standard atscript-db wiring — see
[db.atscript.dev / API / Tables](https://db.atscript.dev):

```ts
import { dbSpace } from "./db";
import { WfStateRow } from "./schemas/WfStateRow.as";

export const wfStateTable = dbSpace.table(WfStateRow);
```

### 3. Construct the store

```ts
import { AsWfStore } from "@atscript/moost-wf/store";
import { wfStateTable } from "../db";
import { useSession } from "../auth/use-session";

export const wfStore = new AsWfStore({
  // biome-ignore lint/suspicious/noExplicitAny: store touches base columns; subtype generic
  table: wfStateTable as any,
  actor: () => useSession()?.username,
});
```

Three options:

- **`table`** — your `AtscriptDbTable` of `WfStateRow`. Loose
  generic because the subtype is structurally a different annotated
  type than the base; the store only touches base columns +
  shadow columns.
- **`clock`** _(optional)_ — `{ now(): number }`. Default is
  `Date.now`. Inject a fake clock in tests.
- **`actor`** _(optional)_ — returns the username/principal stamped
  onto `createdBy` / `lastUpdatedBy`. Called per write. Returning
  `undefined` leaves the columns null.

### 4. Hand it to `HandleStateStrategy`

```ts
import { HandleStateStrategy } from "@moostjs/event-wf";

const handleStrategy = new HandleStateStrategy({ store: wfStore });
```

Plug it into your workflow controller as shown at the top of this
page.

## Shadow columns: `@wf.store.fromContext`

The full workflow state lives inside the `state` JSON blob — opaque
to SQL. **Shadow columns** are top-level table columns that get
mirrored from `state.context` on every write, so you can query them
with regular indexes.

### Declaring a shadow

Add a column to your row that extends `AsWfStateRecord`, with
`@wf.store.fromContext 'path.in.context'`:

```atscript
@meta.label 'Invite Email'
@wf.store.fromContext 'email'
@db.index.plain 'email_idx'
@ui.form.grid.colSpan 'half'
inviteEmail?: string

@meta.label 'Invite Role'
@wf.store.fromContext 'roleName'
@db.index.plain 'role_idx'
inviteRole?: string
```

The plugin enforces a few rules at compile time:

- Path must be dot-notation only (`a.b.c`); no arrays, no wildcards.
- Field must be **optional** (`?:`) or have a default — context
  shape varies between steps and a path-miss writes null.
- Field's underlying primitive must be `string | number | boolean`.
  No arrays, decimals, timestamps, or objects.
- Cannot annotate a `@meta.id` field.

### What happens on each `set()`

Every `wfStore.set(handle, state)` runs through `applyShadows`:

1. For each declared shadow field, walk the dot-path into
   `state.context`.
2. Coerce the value to the declared primitive type. Wrong type →
   write null and log once per field per process.
3. **Hit**: copy to the column.
4. **Miss on optional field**: write null (clears stale value).
5. **Miss on default-bearing field**: omit (DB default fires on
   insert; prior value sticks on update).

### Querying shadows

Once written, shadows are first-class table columns:

```ts
const pending = await wfStateTable.findMany({
  filter: { schemaId: "users/invite", inviteEmail: "alice@example.com" },
});
```

The classic admin-UI use case: "show all pending invites for
this email" without scanning JSON blobs.

### Backfilling: `heal()`

Adding a shadow column after the fact? Existing rows have nothing
in the new column. `heal()` re-runs `applyShadows` over the table:

```ts
const updated = await wfStore.heal();
console.log(`Backfilled ${updated} rows.`);
```

Options:

- `filter?: Record<string, unknown>` — narrow the scan (e.g. only
  rows for one `schemaId`).
- `batchSize?: number` — default 100.

No-op when no `@wf.store.fromContext` fields are declared.

## Cleanup

Expired rows accumulate unless you cull them. `cleanup()` deletes
where `expiresAt <= now()`:

```ts
const deleted = await wfStore.cleanup();
```

Options:

- `retention?: number` — milliseconds. Delete rows where
  `expiresAt <= now() - retention` (a grace period past expiry).
  Default 0 (drop everything ≤ now).
- `Number.POSITIVE_INFINITY` — no-op (returns 0); useful as an
  "off" switch.

Wire it on a timer at startup:

```ts
const RETENTION_MS = 86_400_000; // 1 day grace
setInterval(() => {
  wfStore.cleanup({ retention: RETENTION_MS }).catch((err) => {
    console.error("[wf-store] cleanup failed:", err);
  });
}, 5 * 60_000).unref();
```

## Race-safe consume: `getAndDelete`

Outlet resume flows (magic links) are single-use by default — the
engine calls `consume(token)` which calls `wfStore.getAndDelete`.
The store guarantees:

1. `findRow(handle)` to load the state.
2. `deleteMany({ handle })` to consume.
3. `deletedCount === 1` gate — only the caller whose delete
   returned 1 gets the state; concurrent callers get `null`.

That's why two simultaneous clicks on a magic-link don't both
proceed. The pattern is preserved in subclasses — see the next
section.

## Subclassing for sharded / multi-tenant tables

Most behaviour lives in `protected` methods, designed for
extension. The two most common overrides:

```ts
class TenantedAsWfStore extends AsWfStore {
  constructor(
    private tenantId: string,
    opts: AsWfStoreOptions,
  ) {
    super(opts);
  }

  // Layer tenant scope into every read.
  protected async findRow(handle: string) {
    return (await this.table.findOne({
      filter: { handle, tenantId: this.tenantId },
    })) as never;
  }

  // Stamp tenantId on every write.
  protected buildSetPayload(handle: string, state: any, opts: any) {
    return { ...super.buildSetPayload(handle, state, opts), tenantId: this.tenantId };
  }
}
```

When overriding `findRow`, **preserve the `getAndDelete` contract**
— that method calls `findRow` then `deleteMany({ handle })` and
gates on `deletedCount === 1`. If your `findRow` adds filters
(`tenantId`), make sure your delete uses the same key shape so
race-safety still holds.

## Where to go next

- [Outlets & Resume](/workflows/outlets-resume) — the killer use
  case for durable state: pause + resume across channels.
- [db.atscript.dev](https://db.atscript.dev) — the `AtscriptDbTable`
  API, schemas, query syntax.
- [Recipes](/workflows/recipes) — the invite + register flow uses
  `AsWfStore` end-to-end.
