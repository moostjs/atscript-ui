---
outline: deep
---

# Server-Side Presets

`@atscript/moost-ui-presets` is the server half of the preset
feature. It ships `AsPresetEntry` (the `.as` schema for the
storage row), `AsPresetsController` (an abstract Moost controller),
and the read-gate / write-rule machinery that backs the client's
`PresetsClient`.

You extend the controller, plug in `getCurrentUser()`, and mount it
at a URL. The client points `usePresets()` / `<AsTableRoot :preset>`
at that URL.

## Install

```bash
pnpm add @atscript/moost-ui-presets @atscript/moost-db @atscript/db-sqlite
```

Pick the DB adapter that matches your stack — sqlite / postgres /
mysql / mongo. The schema is portable.

## The storage row

`AsPresetEntry` is one row per preset, userConf, or appConf. The
schema lives at
[`packages/moost-ui-presets/src/as-preset-entry.as`](https://github.com/mav-rik/atscript-ui/blob/main/packages/moost-ui-presets/src/as-preset-entry.as):

```atscript
@db.table 'as_presets'
export interface AsPresetEntry {
    @meta.id
    @db.default.uuid
    id: string

    @db.index.plain 'preset_scope_idx'
    type: 'preset' | 'userConf' | 'appConf'

    @db.index.plain 'preset_scope_idx'
    @db.index.unique 'preset_public_label_idx'
    app: string

    @db.index.plain 'preset_scope_idx'
    @db.index.unique 'preset_public_label_idx'
    tableKey?: string

    @db.index.plain 'preset_scope_idx'
    @db.index.plain 'preset_user_idx'
    user: string

    userLabel?: string

    @db.index.plain 'preset_public_idx'
    public?: boolean

    @db.index.plain 'preset_label_idx'
    label?: string

    @db.index.unique 'preset_public_label_idx'
    publicLabel?: string

    aspects?: PresetAspect[]

    @db.json
    data: PresetContent | UserConfContent | AppConfContent

    @db.default.now createdAt: number
    @db.default.now updatedAt: number
}
```

Three notable design points:

- **`publicLabel` enforces public-name uniqueness** at the DB layer.
  Stamped equal to `label` only when `type='preset' AND public=true`,
  `NULL` otherwise. The composite unique index over `(app, tableKey,
publicLabel)` relies on `NULL ≠ NULL` semantics so private rows
  don't collide.
- **`aspects[]` is derived** by the controller from `data.content`
  keys on every write. The picker projects this without loading
  the snapshot blob, which keeps the list view cheap.
- **`tableKey` is absent for appConf** — appConf rows are
  per-`(user, app)` only.

Sync the schema with your DB adapter before the controller mounts.
See [db.atscript.dev sync](https://db.atscript.dev/sync) for the
adapter-specific commands.

## Extending the controller

`AsPresetsController` is `@Inherit()`-annotated abstract. You
subclass it, override **at least** `getCurrentUser()`, and apply
your auth / table-mounting decorators:

```ts
import { AsPresetsController } from "@atscript/moost-ui-presets";
import { TableController } from "@atscript/moost-db";
import { Authenticate, HttpError } from "@moostjs/event-http";
import { presetsTable } from "../db";
import { useSession } from "../auth/use-session";
import { SessionGuard } from "../auth/session.guard";

@Authenticate(SessionGuard)
@TableController(presetsTable, "db/_presets")
export class PresetsController extends AsPresetsController {
  protected async getCurrentUser(): Promise<string> {
    const session = useSession();
    if (!session?.userId) throw new HttpError(401, "Not authenticated");
    return String(session.userId);
  }

  protected async canPublishPresets(
    _app: string,
    _tableKey: string,
    _user: string,
  ): Promise<boolean> {
    return useSession()?.roleName === "admin";
  }

  protected async getMaxPresetsPerUser(
    _app: string,
    _tableKey: string,
    _user: string,
  ): Promise<number> {
    const role = useSession()?.roleName;
    if (role === "admin") return 100;
    return 10;
  }

  protected async getUserLabel(_user: string): Promise<string | undefined> {
    return useSession()?.username;
  }
}
```

Hookable methods:

| Method                                      | Default                               | Purpose                               |
| ------------------------------------------- | ------------------------------------- | ------------------------------------- |
| `getCurrentUser()`                          | abstract — **required**               | Resolve the caller's user id          |
| `getMaxPresetsPerUser(app, tableKey, user)` | returns `this.maxPresetsPerUser` (10) | Per-user cap on preset creation       |
| `canPublishPresets(app, tableKey, user)`    | returns `true`                        | Gate for `private → public` writes    |
| `getUserLabel(user)`                        | returns `undefined`                   | "by alice" attribution on public rows |

`getUserLabel()` exists so the controller doesn't need a join to
the users table on every preset write — read straight from the
session.

## REST surface

The controller exposes one custom endpoint plus the four inherited
from `AsDbController`:

| Method | Path            | Purpose                                         |
| ------ | --------------- | ----------------------------------------------- |
| GET    | `/capabilities` | `{ canPublish, presetLimit, userId }`           |
| GET    | `/`             | List rows (gated by read-rule, optional filter) |
| POST   | `/`             | Create row                                      |
| PATCH  | `/:id`          | Partial update                                  |
| DELETE | `/:id`          | Remove row                                      |

`/capabilities` is the only bespoke endpoint. It runs both hooks
(`canPublishPresets`, `getMaxPresetsPerUser`) with the caller's
`(app, tableKey, user)` and returns the result for the client to
gate its UI without guessing. The client calls it once on mount.

## Permission model

### Read gate

The controller installs a read filter via `transformFilter()`:

```ts
user === currentUser OR (type === 'preset' AND public === true)
```

Every list query is rewritten to match the gate. Even an explicit
`filter` from the client is `AND`-ed with this rule. Users can't
read other users' private rows; everyone reads public preset rows
in their `(app, tableKey)`.

### Write rules

- **Reserved id prefixes** `sys:`, `uc:`, `ac:` are rejected from
  client writes. The controller stamps `uc:*` and `ac:*` ids
  itself; `sys:*` is client-only.
- **Public-label uniqueness** within `(app, tableKey)` is enforced
  by the `preset_public_label_idx` unique index. Two users racing
  the same public name produces a 409 instead of slipping past a
  read-then-write window.
- **Per-user cap** is enforced on every create. `getMaxPresetsPerUser()`
  is called inside the transaction; over-cap requests get HTTP `409`
  with `code: "preset_limit_reached"`, plus `limit` and `count` in
  the payload so the client can render an accurate message.
- **`canPublishPresets()` gates the `private → public` transition**.
  Already-public rows are grandfathered — revoking publish
  permission doesn't unpublish existing preset rows. This is
  deliberate: a role demotion shouldn't disappear a shared
  view that other users may be relying on.

### Stamping

The controller transparently stamps:

- `user` from `getCurrentUser()` (clients can't impersonate).
- `userLabel` from `getUserLabel()` on every preset write.
- `label` mirroring `data.label` on every preset write.
- `publicLabel` equal to `label` when `type='preset' AND public=true`,
  else `NULL`.
- `aspects[]` derived from `data.content` keys on every preset
  write.
- `createdAt` / `updatedAt` from `@db.default.now`.

The client doesn't need to know any of this — it sends a clean
`PresetSnapshotWire`, the controller fills the rest.

## Client wiring

The client points at the controller's URL via the table root's
`:preset` prop:

```vue
<AsTableRoot
  :url="`/api/db/tables/orders`"
  :preset="{
    url: '/api/db/_presets',
    tableKey: 'orders',
    systemPresets: [
      {
        id: 'open',
        label: 'Open',
        content: {
          /* ... */
        },
      },
    ],
  }"
>
  <AsTableActions>
    <AsPresetPicker />
  </AsTableActions>
  <AsTable />
</AsTableRoot>
```

For a custom picker or programmatic flows — use
`usePresets()`:

```ts
import { usePresets } from "@atscript/vue-table";

const presets = usePresets({
  url: "/api/db/_presets",
  tableKey: "orders",
  systemPresets,
});

await presets.savePresetAs("Q4 Open", snapshot, { public: true });
```

## Mounting once for the whole app

The controller mounts at one URL per app — there's no per-table
routing. All `(app, tableKey)` scoping happens in the data layer.
Mount once in your Moost app, pass the same URL to every
`<AsTableRoot :preset>`, and the controller filters rows by
`(app, tableKey)` on the way out.

## Next steps

- [Presets](/tables/presets) — the client-side model.
- [db.atscript.dev](https://db.atscript.dev) — DB adapter wiring,
  `AsDbController` reference, schema sync.
- [moost](https://moost.org) — controller decorators, guards,
  interceptors.
