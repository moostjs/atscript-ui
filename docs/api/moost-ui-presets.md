# @atscript/moost-ui-presets

Moost controller + atscript schema for table-preset persistence. Subclass `AsPresetsController` to wire the table to your auth layer; the rest (CRUD, dirty detection, public-label uniqueness, per-user quotas, capabilities endpoint) ships out of the box. Pair with [`@atscript/vue-table`](/api/vue-table)'s `usePresets()` / `<AsPresetPicker>` to ship full preset UX.

## Contents

- [Controller](#controller)
- [Schema — AsPresetEntry](#schema-aspresetentry)
- [Re-exports](#re-exports)

## Controller

### `AsPresetsController<T?>`

Abstract base extending `AsDbController` from `@atscript/moost-db`. Inherits the standard CRUD endpoints (GET, POST, PATCH, DELETE) and adds:

- `GET /capabilities?app=...&tableKey=...` — returns the user's preset capabilities (publish rights, quota).
- Read gating — `transformFilter` injects an owner-aware filter so users only see their own private rows and everyone's public rows.
- Write hooks — `onWrite` enforces label uniqueness, quota, and stamps `userLabel` / `publicLabel` / `aspects`.
- Delete gating — `onRemove` only allows owners to delete.

```typescript
@Inherit()
abstract class AsPresetsController<
  T extends TAtscriptAnnotatedType = typeof AsPresetEntry,
> extends AsDbController<T> {
  protected maxPresetsPerUser: number; // 10
  protected abstract getCurrentUser(): Promise<string>;

  protected getMaxPresetsPerUser(
    app: string,
    tableKey: string,
    user: string,
  ): Promise<number>;
  protected canPublishPresets(
    app: string,
    tableKey: string,
    user: string,
  ): Promise<boolean>;
  protected getUserLabel(user: string): Promise<string | undefined>;

  @Get("capabilities")
  capabilities(query: AsCapabilitiesQuery): Promise<PresetCapabilities>;
}
```

### Implementation example

```typescript
import { Controller } from "moost";
import { AsPresetsController } from "@atscript/moost-ui-presets";

@Controller("/presets")
class PresetsController extends AsPresetsController {
  constructor(private readonly auth: AuthService) {
    super();
  }

  protected async getCurrentUser(): Promise<string> {
    const user = await this.auth.currentUser();
    if (!user) throw new HttpError(401, "Unauthorized");
    return user.id;
  }

  /** Free tier: 10 presets. Paid: 100. Admin: unlimited. */
  protected async getMaxPresetsPerUser(app: string, _table: string, user: string) {
    const tier = await this.auth.tierOf(user);
    return tier === "admin" ? Number.MAX_SAFE_INTEGER : tier === "paid" ? 100 : 10;
  }

  protected async canPublishPresets(_app: string, _table: string, user: string) {
    return (await this.auth.tierOf(user)) !== "free";
  }

  protected async getUserLabel(user: string) {
    return (await this.auth.profileOf(user))?.displayName;
  }
}
```

### Extension points

| Method | Default | Override when |
| --- | --- | --- |
| `getCurrentUser()` | abstract | Always — wire to your auth layer. |
| `getMaxPresetsPerUser(app, tableKey, user)` | returns `this.maxPresetsPerUser` (10) | Tiered quotas (admin / paid / free). |
| `canPublishPresets(app, tableKey, user)` | returns `true` | Restrict public presets by tier or per-table policy. |
| `getUserLabel(user)` | returns `undefined` | Surface display names on shared presets. |

### REST endpoints

All endpoints inherited from `AsDbController` work with `AsPresetEntry` rows. The controller adds:

- `GET /capabilities?app=<app>&tableKey=<tableKey>` → `PresetCapabilities`.

The `@atscript/ui-table` [`PresetsClient`](/api/ui-table#presets-http-clients) targets this exact controller.

## Schema — AsPresetEntry

The atscript-db row shape. Stored in table `as_presets`.

```atscript
@db.table 'as_presets'
export interface AsPresetEntry {
  @meta.id
  @db.default.uuid
  id: string

  /** Row kind — drives the polymorphic `data` column. */
  type: 'preset' | 'userConf' | 'appConf'

  /** App scope. Required on every row. */
  app: string

  /** Per-table scope. Required for `preset` / `userConf`; absent for `appConf`. */
  tableKey?: string

  /** Owner user id. Stamped by the controller from session. */
  user: string

  /** Optional display name for shared presets. */
  userLabel?: string

  /** Visible to other users when true. Only meaningful for `type='preset'`. */
  public?: boolean

  /** Mirror of `data.label` — top-level for indexable lookups. `type='preset'` only. */
  label?: string

  /** Race-safe public-name uniqueness column. `type='preset' AND public=true` only. */
  publicLabel?: string

  /** Aspects this preset claims — derived by the controller on every write. */
  aspects?: PresetAspect[]

  @db.json
  data: PresetData | UserConfData | AppConfData

  @db.default.now createdAt: number
  @db.default.now updatedAt: number
}
```

### Polymorphic `data` shape

- **`type='preset'`** → [`PresetData`](/api/ui-table#presets-application-types): `{ label, content?: PresetSnapshotWire }`. The snapshot blob carries `columns`, `filters`, `filterOps`, `sorters`, `itemsPerPage`.
- **`type='userConf'`** → [`UserConfData`](/api/ui-table#presets-application-types): `{ defaultPresetId?, favPresetIds? }`. Per-table user preferences.
- **`type='appConf'`** → [`AppConfData`](/api/ui-table#presets-application-types): `{ appearance?, language?, timezone?, density?, dateFormat?, firstDayOfWeek?, customJson? }`. App-wide per-user preferences (one row per `(user, app)`).

### Validation rules enforced by the controller

- `aspects[]` is rebuilt from `data.content` keys on every write — clients can't fake aspect claims.
- `label` is mirrored from `data.label` on every `type='preset'` write.
- `publicLabel` is stamped equal to `label` on `type='preset' AND public=true` writes, NULL otherwise. The composite unique index `preset_public_label_idx (app, tableKey, publicLabel)` relies on NULL ≠ NULL semantics so private / userConf / appConf rows never collide.
- `user` is stamped from `getCurrentUser()` on every write — clients can't author rows under another user.
- Per-user quota is checked on insert; exceeding it returns `preset-limit-reached` with status 409.

## Re-exports

From [`@atscript/ui-table`](/api/ui-table) — re-exported so consumers can grab schema-relevant types from one import:

```typescript
export {
  // Types
  type AppConfData,
  type AsPresetEntryData,
  type AsPresetsErrorCode,
  type FilterCondition,
  type FilterConditionType,
  type PresetAspect,
  type PresetCapabilities,
  type PresetData,
  type PresetLimitReachedBody,
  type PresetSnapshotWire,
  type UserConfData,

  // Constants
  APP_CONF_PREFIX,
  PRESET_ASPECTS,
  RESERVED_ID_PREFIXES,
  SYSTEM_PRESET_PREFIX,
  USER_CONF_PREFIX,

  // Helpers
  appConfId,
  userConfId,
} from "@atscript/ui-table";
```

`appConfId(user, app)` and `userConfId(user, app, tableKey)` are the deterministic id builders the controller uses for the singleton `appConf` and per-table `userConf` rows.

## Cross-links

- [Tables — Presets](/tables/presets), [Server-Side Presets](/tables/server-presets)
- [@atscript/ui-table](/api/ui-table) — wire types, draft helpers, `PresetsClient`
- [@atscript/vue-table](/api/vue-table) — `usePresets()`, `<AsPresetPicker>`, `<AsPresetDialog>`
- [db.atscript.dev — Tables](https://db.atscript.dev/api/tables) — base CRUD endpoints inherited from `AsDbController`
- atscript.dev — `.as` syntax, `@db.*` annotations
