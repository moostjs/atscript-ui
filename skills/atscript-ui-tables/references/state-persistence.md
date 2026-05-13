URL bridge, presets, drafts, app prefs, server controller.

## Contents

- [AsConfigDialog tabs](#asconfigdialog-tabs)
- [Programmatic open](#programmatic-open)
- [URL bridge: useTableUrlQuery](#url-bridge-usetableurlquery)
- [URL helpers](#url-helpers)
- [hydratingFromUrl flag](#hydratingfromurl-flag)
- [Preset model](#preset-model)
- [Per-aspect opt-in](#per-aspect-opt-in)
- [Wire form](#wire-form)
- [Three preset kinds](#three-preset-kinds)
- [userConf](#userconf)
- [appConf](#appconf)
- [usePresets composable](#usepresets-composable)
- [useAppPrefs composable](#useappprefs-composable)
- [useLocalDraft composable](#uselocaldraft-composable)
- [AsPresetPicker](#aspresetpicker)
- [Dirty detection](#dirty-detection)
- [Server-side AsPresetsController](#server-side-aspresetscontroller)
- [AsPresetEntry schema](#aspresetentry-schema)
- [REST endpoints](#rest-endpoints)
- [Server validation invariants](#server-validation-invariants)
- [Wiring a Moost controller](#wiring-a-moost-controller)
- [PresetsClient](#presetsclient)

## AsConfigDialog tabs

`packages/vue-table/src/components/defaults/as-config-dialog.vue`. Three tabs:

| Tab       | Default body component        | Edits                                                                           |
| --------- | ----------------------------- | ------------------------------------------------------------------------------- |
| `columns` | `<AsFieldsSelector>` (Tier-3) | `state.columnNames` (reorder, hide/show) + `state.columnWidths` (width slider). |
| `sorters` | `<AsSortersConfig>` (Tier-3)  | `state.sorters` (add/remove/reorder).                                           |
| `filters` | `<AsFieldsSelector>` (Tier-3) | `state.filterFields` (add/remove visible filter inputs).                        |

Bound to `state.configDialogOpen` + `state.configTab`. Override via `controls.configDialog`.

## Programmatic open

```typescript
state.showConfigDialog(); // default tab "columns"
state.showConfigDialog("sorters");
state.showConfigDialog("filters");
```

`ConfigTab` type: `"columns" | "sorters" | "filters"`.

## URL bridge: useTableUrlQuery

`packages/vue-table/src/composables/use-table-url-query.ts`. Bridge between `<AsTableRoot v-model:url-query>` and vue-router.

```vue
<script setup>
import { useRoute, useRouter } from "vue-router";
import { useTableUrlQuery } from "@atscript/vue-table";

const urlQuery = useTableUrlQuery(useRoute(), useRouter());
</script>

<template>
  <AsTableRoot v-model:url-query="urlQuery" url="..." />
</template>
```

| Option | Default     | Effect                                                                                      |
| ------ | ----------- | ------------------------------------------------------------------------------------------- |
| `mode` | `"replace"` | `router.replace` per write. `"push"` makes every filter/sort/page mutation a history entry. |

The bridge owns the **entire query string** — apps that share the URL with non-table params should write their own `computed<string>` instead.

Type-only import of `Router` + `RouteLocationNormalizedLoaded` — `@atscript/vue-table` does not add a runtime dependency on `vue-router`.

Per-aspect gate via `<AsTableRoot :url-query-sync>` (the `UrlQuerySync` type):

```vue
<AsTableRoot
  v-model:url-query="urlQuery"
  :url-query-sync="{
    filters: ['status', 'tenant'], // allowlist
    sorters: false, // private
    search: true,
    pagination: false, // sharable filtered view, recipient picks own page
  }"
/>
```

| Field        | Type                  | Default | Notes                                                                        |
| ------------ | --------------------- | ------- | ---------------------------------------------------------------------------- |
| `filters`    | `boolean \| string[]` | `true`  | `false` / `[]` = none; `string[]` = field-path allowlist.                    |
| `sorters`    | `boolean \| string[]` | `true`  | Same `boolean \| string[]` semantics; allowlist matches `SortControl.field`. |
| `search`     | `boolean`             | `true`  | Whether `$search` round-trips.                                               |
| `pagination` | `boolean`             | `true`  | `$skip` + `$limit` together — one knob.                                      |

## URL helpers

```typescript
import { stateToUrlQueryString, urlQueryStringToState } from "@atscript/ui-table";

const s = stateToUrlQueryString(
  { filters, sorters, page, itemsPerPage, searchTerm },
  { defaultItemsPerPage: 25, sync: { pagination: false } },
);
// "status=active&$sort=createdAt:-1"

const snapshot = urlQueryStringToState(s, {
  knownFields: ["status", "createdAt"], // optional; gates unknown paths
  sync: { pagination: false },
});
// { filters, sorters, skip?, searchTerm }
```

Both honour `UrlQuerySync` symmetrically. The encoder reuses `buildTableQuery` for the filter/sort/search shape and appends `$skip` / `$limit` for pagination. The decoder produces a `UrlQueryStateSnapshot` (`skip` is the raw record offset — consumer computes `page = floor(skip / itemsPerPage) + 1`).

## hydratingFromUrl flag

`state.applyUrlQuery(urlString)` sets a private `hydratingFromUrl` guard so the watcher-driven query scheduling stays suppressed during URL replay. Release happens on `nextTick` so per-mutator watchers see the guard. On mount the `urlQueryReady` gate ensures the **first** fetch composes URL + defaults + preset into one request (not two).

The `lastEmittedUrl` echo guard works in both directions:

- Outbound: skip emit when state re-serializes to the same string.
- Inbound: skip apply when called with our own echo.

The decoded-form comparison covers `URLSearchParams` re-encoding of `~` (operator marker), `/`, `'`.

## Preset model

```typescript
interface PresetSnapshot {
  columns?: {
    columnNames: string[];
    columnWidths?: Record<string, string>; // overrides only, never defaults
  };
  filters?: string[]; // visible filter field paths (display state)
  filterOps?: FieldFilters; // applied filter conditions
  sorters?: SortControl[];
  itemsPerPage?: number;
}
```

`packages/ui-table/src/presets/preset-types.ts:13-25`. Dict-shaped — what runtime state holds. Crossing the network requires `PresetSnapshotWire` (entries-array form for atscript validation).

## Per-aspect opt-in

`packages/ui-table/src/presets/preset-aspects.ts:7-14`:

```typescript
export const PRESET_ASPECTS = [
  "columns",
  "filters",
  "filterOps",
  "sorters",
  "itemsPerPage",
] as const;
export type PresetAspect = (typeof PRESET_ASPECTS)[number];
```

Per invariant 8, a snapshot's set of present keys claims those aspects; absent keys leave that slice untouched on apply. A "columns-only" preset doesn't dirty when filters change; a "filter-only" preset doesn't dirty when columns reorder.

App-level aspect availability is set via `<AsTableRoot :preset.aspects>` (default `['columns','filters','filterOps','sorters']`). Add `'itemsPerPage'` for paginated tables; drop any aspect the app doesn't use.

`AspectMask` (`Partial<Record<PresetAspect, boolean>>`) is used by `captureSnapshot(mask?)` to opt-in/out per aspect at capture time. Intersected with `availableAspects` — unavailable aspects never leak in.

`derivePresetAspects(content)` returns the array of present keys in canonical order (matches `PRESET_ASPECTS` order). Stamped on the server-side row's `aspects` column on every preset write so the picker can render aspect icons without loading the snapshot blob.

## Wire form

`packages/ui-table/src/presets/preset-wire-types.ts`. Entry-array encoding required by atscript validation (object dicts aren't validatable as Record<string, T>).

```typescript
interface PresetSnapshotWire {
  columns?: {
    columnNames: string[];
    columnWidths?: { field: string; width: string }[];
  };
  filters?: string[];
  filterOps?: { field: string; conditions: FilterCondition[] }[];
  sorters?: SortControl[];
  itemsPerPage?: number;
}
```

```typescript
import { toWireSnapshot, fromWireSnapshot } from "@atscript/ui-table";

const wire = toWireSnapshot(snapshot); // dict → entries
const snap = fromWireSnapshot(wire); // entries → dict
```

Entries are sorted by `field` so server-side aspect derivation, dirty checks, and equality all see a stable order. Use these whenever a snapshot crosses the network — never send the raw runtime dict.

## Three preset kinds

`packages/ui-table/src/presets/preset-id.ts`:

| Kind             | Id prefix                                 | Persisted | Visible to                          |
| ---------------- | ----------------------------------------- | --------- | ----------------------------------- |
| **system**       | `sys:`                                    | no        | everyone (always materialised)      |
| **user-private** | (uuid) — `type='preset' AND public=false` | yes       | row owner only                      |
| **public**       | (uuid) — `type='preset' AND public=true`  | yes       | all users on same `(app, tableKey)` |

Reserved id prefixes (invariant 9):

| Prefix | Use                                                       |
| ------ | --------------------------------------------------------- |
| `sys:` | Synthetic system presets; client-only.                    |
| `uc:`  | `userConf` deterministic id `uc:<user>:<app>:<tableKey>`. |
| `ac:`  | `appConf` deterministic id `ac:<user>:<app>`.             |

Client writes targeting these prefixes are rejected by the server controller (`reserved_id` error code).

System presets are configured via `<AsTableRoot :preset.systemPresets>`:

```typescript
const systemPresets: SystemPresetInput[] = [
  { id: "standard", label: "Default" }, // override Standard label
  {
    id: "monitoring",
    label: "Live Monitor",
    content: { sorters: [{ field: "createdAt", direction: "desc" }] },
  },
];
```

`resolveSystemPresets(input?)` (`packages/ui-table/src/presets/system-presets.ts`) places Standard at index 0, then named presets in array order. Auto-prefix: `id: "monitoring"` becomes `sys:monitoring`. Duplicate ids are dropped (first wins) with a console.warn.

## userConf

Per-user, per-table config row (`type='userConf'`), deterministic id `uc:<user>:<app>:<tableKey>`.

```typescript
interface UserConfData {
  defaultPresetId?: string; // pin a preset (system or stored)
  favPresetIds?: string[]; // favorite-pin list
}
```

`packages/ui-table/src/presets/preset-data-types.ts:27-35`. Stamped client-side via `usePresets.setDefault(id)` / `setFavorites(ids)` / `toggleFav(id)`.

Bootstrap resolution: pinned `defaultPresetId` if it still references a known preset, else `STANDARD_PRESET_ID`. Stale ids are left intact (may reactivate if the preset returns).

## appConf

Per-user, app-wide config row (`type='appConf'`), deterministic id `ac:<user>:<app>`.

```typescript
interface AppConfData {
  appearance?: "system" | "light" | "dark";
  language?: string; // BCP-47, max 5 chars
  timezone?: string; // IANA, max 64 chars
  density?: "compact" | "cozy" | "comfortable";
  dateFormat?: "iso" | "us" | "eu";
  firstDayOfWeek?: 0 | 1 | 6;
  customJson?: string; // app-specific escape hatch, max 1024 chars
}
```

`packages/ui-table/src/presets/preset-data-types.ts:42-54`. Read via `useAppPrefs`. Cells call `provideCellLocale` with `language` + `timezone`.

## usePresets composable

`packages/vue-table/src/composables/use-presets.ts`. Public dev-facing — powers `<AsPresetPicker>` internally.

```typescript
const presetsHandle = usePresets({
  url: "/api/db/_presets",
  tableKey: "products",
  app: "shop", // defaults to inject(AS_PRESETS_APP)
  systemPresets,
  autoLoad: true, // default
});
```

Returns:

| Field                                  | Type                                         | Notes                                                                    |
| -------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------ |
| `presets`                              | `ShallowRef<AsPresetEntryRow[]>`             | Owned + public rows for `(app, tableKey)`.                               |
| `presetsById`                          | `ComputedRef<Map<string, AsPresetEntryRow>>` | O(1) lookup.                                                             |
| `userConf`                             | `ShallowRef<AsPresetEntryRow \| null>`       | This user's `type='userConf'` row.                                       |
| `capabilities`                         | `Ref<PresetCapabilities \| null>`            | `{ canPublish, presetLimit, userId }`.                                   |
| `systemPresets`                        | `ComputedRef<SystemPreset[]>`                | Resolved order (Standard first).                                         |
| `available`                            | `ComputedRef<boolean>`                       | False on 401/403 — UI hides itself.                                      |
| `loading`                              | `Ref<boolean>`                               |                                                                          |
| `error`                                | `Ref<unknown>`                               | Last non-auth error.                                                     |
| `currentUser`                          | `ComputedRef<string \| null>`                | From capabilities or row scan.                                           |
| `activePresetId`                       | `Ref<string \| null>`                        | Owned by the table state, not auto-resolved here.                        |
| `activePreset`                         | `ComputedRef<ActivePresetView \| null>`      | `{ kind: 'system' \| 'stored', entry }`.                                 |
| `isOwned(id)`                          | `(id: string) => boolean`                    | False for system. True for private. Public: only if owner.               |
| `reload()`                             | `() => Promise<void>`                        |                                                                          |
| `batch(fn)`                            | `<T>(fn) => Promise<T>`                      | Defer trailing reloads until `fn` resolves; one coalesced reload at end. |
| `savePreset(snapshot)`                 | overwrite active                             | Throws on system preset.                                                 |
| `savePresetAs(label, snapshot, opts?)` | `{ public?: boolean }`                       | Returns new id; sets `activePresetId`.                                   |
| `renamePreset(id, label)`              | —                                            | Throws on system.                                                        |
| `deletePreset(id)`                     | —                                            | Throws on system. Active id falls back to Standard.                      |
| `togglePublic(id)`                     | —                                            | Throws on system.                                                        |
| `setDefault(id \| null)`               | —                                            | Writes `userConf.defaultPresetId`.                                       |
| `toggleFav(id)`                        | —                                            | Writes `userConf.favPresetIds`.                                          |
| `setFavorites(ids)`                    | —                                            | Replace full list (one round-trip).                                      |

Mutators trigger a follow-up reload — `batch(fn)` collapses N round-trips when the manage dialog flushes several edits at once.

## useAppPrefs composable

`packages/vue-table/src/composables/use-app-prefs.ts`. Singleton-per-`(app, url)`. Multiple calls share one underlying instance.

```typescript
const { prefs, save } = useAppPrefs({
  url: "/api/db/_presets",
  app: "shop", // defaults to inject(AS_PRESETS_APP)
  autoLoad: true, // default
  cache: true, // default — localStorage cache for instant paint
});
```

| Field         | Type                                             | Notes                                                   |
| ------------- | ------------------------------------------------ | ------------------------------------------------------- |
| `prefs`       | `WritableComputedRef<AppConfData>`               | Non-null `{}` until first load. Mutate via `save` only. |
| `loading`     | `Ref<boolean>`                                   |                                                         |
| `error`       | `Ref<unknown>`                                   | Last non-auth error.                                    |
| `available`   | `ComputedRef<boolean>`                           | False on 401/403.                                       |
| `reload()`    | `() => Promise<void>`                            |                                                         |
| `save(patch)` | `(patch: Partial<AppConfData>) => Promise<void>` | Optimistic shallow merge; rollback on error.            |
| `reset()`     | `() => void`                                     | Drop in-memory + cached state (sign-out flow).          |

Cross-instance sync: `useEventBus` (in-window) + `BroadcastChannel` (cross-tab). One save propagates to every `useAppPrefs(app, *)` mount, including a different `url`.

`disposeAppPrefs(app, url)` is a test escape hatch — tears down the singleton.

## useLocalDraft composable

`packages/vue-table/src/composables/use-local-draft.ts`. Opt-in localStorage overlay for in-progress edits. Survives reloads; cleared when the user explicitly applies / saves a preset.

```typescript
const draft = useLocalDraft({
  app: "shop",
  tableKey: "products",
  enabled: true, // or a Ref<boolean>
  availableAspects: ["columns", "filters", "sorters"], // persisted slices
  debounceMs: 300, // optional
});
```

| Method                                   | Effect                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `hydrate(applied)`                       | Layer the persisted draft over `applied` and return merged snapshot.                                                |
| `watchAndPersist(getCurrent, getActive)` | Debounced watcher: writes to localStorage on each change; removes the entry when current matches the active preset. |
| `clear()`                                | Drop the localStorage entry.                                                                                        |
| `readDraft()`                            | Raw `PresetDraft \| null` from storage.                                                                             |

Storage key format: `as-table-draft:${app}:${tableKey}`. `filterOps` / `searchTerm` / `pagination` are NOT persisted in drafts by design.

Enable per table via `<AsTableRoot :preset="{ ..., persistDrafts: true }"`. Inert when `enabled=false`.

## AsPresetPicker

`packages/vue-table/src/components/as-preset-picker.vue`. Tier-1 dropdown picker. Renders the presets menu (Save / Save as / Reset / Manage) when `state.preset.available.value` is true; renders nothing otherwise.

Reads from `state.preset` (the `PresetSurface` on `ReactiveTableState`):

| Field            | Type                             | Use in picker                                |
| ---------------- | -------------------------------- | -------------------------------------------- |
| `presets`        | `ShallowRef<AsPresetEntryRow[]>` | Menu list of stored presets.                 |
| `systemPresets`  | `ComputedRef<SystemPreset[]>`    | Always-present `sys:*` entries above stored. |
| `activeId`       | `Ref<string \| null>`            | Highlighted item.                            |
| `activeSnapshot` | `ComputedRef<PresetSnapshot>`    | Source for "Reset" (re-apply active).        |
| `isDirty`        | `ComputedRef<boolean>`           | Unsaved indicator.                           |
| `canSaveActive`  | `ComputedRef<boolean>`           | Gates "Save".                                |

Mutators called from menu items:

```typescript
state.preset.apply(idOrSnapshot);
state.preset.resetActive();
state.preset.saveActive();
state.preset.saveAs(label, { aspects?: AspectMask, public?: boolean });
state.preset.rename(id, label);
state.preset.remove(id);
state.preset.togglePublic(id);
state.preset.setDefault(id | null);
state.preset.toggleFav(id);
state.preset.batch(fn);
```

`<AsPresetDialog>` (Tier-2) opens for rename / delete / public-toggle / favorite / default management — bound to `state.preset.dialogOpen`. Override via `controls.presetDialog`.

## Dirty detection

`packages/ui-table/src/presets/preset-dirty.ts`:

```typescript
import { isDirtyAgainst, stableStringify } from "@atscript/ui-table";

const dirty = isDirtyAgainst(activeSnapshot, currentSnapshot);
```

Per-aspect: only aspects the active preset **claims** (key present) are compared. A column-only preset stays clean while filters change. A filter-ops-only preset doesn't dirty when columns reorder. Order-insensitive on plain objects, order-sensitive on arrays. Short-circuits on first mismatch.

`stableStringify(value)` returns deterministic JSON (alphabetic keys at every depth). Used by the localStorage draft serializer; dirty detection itself uses `deepEqual` for speed.

## Server-side AsPresetsController

`@atscript/moost-ui-presets`. Abstract class.

```typescript
import { AsPresetsController, AsPresetEntry } from "@atscript/moost-ui-presets";
import { Inherit } from "moost";

@Inherit()
export class MyPresetsController extends AsPresetsController {
  protected async getCurrentUser(): Promise<string> {
    // Required override. Pull from session / JWT / etc.
    return this.session.userId;
  }

  protected override async canPublishPresets(
    app: string,
    tableKey: string,
    user: string,
  ): Promise<boolean> {
    return user === "admin"; // default: true
  }

  protected override async getMaxPresetsPerUser(
    app: string,
    tableKey: string,
    user: string,
  ): Promise<number> {
    return 25; // default: 10
  }

  protected override async getUserLabel(user: string): Promise<string | undefined> {
    return await this.users.getDisplayName(user); // stamped on each row
  }
}
```

`AsPresetsController<T = typeof AsPresetEntry>` extends `AsDbController<T>` (cross-link atscript-db skill `references/moost-db.md`). Overrides:

| Hook                            | Default             | When to override                                             |
| ------------------------------- | ------------------- | ------------------------------------------------------------ |
| `getCurrentUser()`              | **abstract**        | Always required. Returns opaque user id string.              |
| `getUserLabel(user)`            | returns `undefined` | Stamp display label per row. Re-resolved on every update.    |
| `canPublishPresets(a, t, u)`    | returns `true`      | Restrict public-preset creation (tiered / role / per-table). |
| `getMaxPresetsPerUser(a, t, u)` | returns `10`        | Override cap per user / app / table.                         |

## AsPresetEntry schema

`packages/moost-ui-presets/src/as-preset-entry.as`:

```atscript
@db.table 'as_presets'
export interface AsPresetEntry {
    @meta.id @db.default.uuid @expect.maxLength 256 @expect.minLength 3
    id: string

    @db.index.plain 'preset_scope_idx'
    type: 'preset' | 'userConf' | 'appConf'

    @db.index.plain 'preset_scope_idx'
    @db.index.unique 'preset_public_label_idx'
    @expect.maxLength 128 @expect.minLength 1
    app: string

    @db.index.plain 'preset_scope_idx'
    @db.index.unique 'preset_public_label_idx'
    @expect.maxLength 64 @expect.minLength 1
    tableKey?: string

    @db.index.plain 'preset_scope_idx'
    @db.index.plain 'preset_user_idx'
    @expect.maxLength 128 @expect.minLength 1
    @db.default ''
    user: string

    @expect.maxLength 128 @expect.minLength 1
    userLabel?: string

    @db.index.plain 'preset_public_idx'
    public?: boolean

    @db.index.plain 'preset_label_idx'
    @expect.maxLength 128 @expect.minLength 1
    label?: string

    @db.index.unique 'preset_public_label_idx'
    @expect.maxLength 128 @expect.minLength 1
    publicLabel?: string

    @expect.array.uniqueItems
    aspects?: PresetAspect[]

    @db.json
    data: { /* polymorphic — preset | userConf | appConf variants */ }

    @db.default.now createdAt: number
    @db.default.now updatedAt: number
}
```

Indexes:

| Name                      | Columns                        | Purpose                                           |
| ------------------------- | ------------------------------ | ------------------------------------------------- |
| `preset_scope_idx`        | `(type, app, tableKey)`        | Read-path scope filter.                           |
| `preset_user_idx`         | `user`                         | Owner queries.                                    |
| `preset_public_idx`       | `public`                       | Public-listing read.                              |
| `preset_label_idx`        | `label`                        | Public-label uniqueness scan (indexed).           |
| `preset_public_label_idx` | `(app, tableKey, publicLabel)` | Composite unique — race-safe collision detection. |

Cross-link: atscript skill for `.as` syntax; atscript-db skill for `@db.*` semantics.

## REST endpoints

Inherited from `AsDbController` plus the extra capabilities endpoint:

| Method | Path                           | Purpose                                                                                |
| ------ | ------------------------------ | -------------------------------------------------------------------------------------- |
| GET    | `/capabilities?app=&tableKey=` | Returns `PresetCapabilities` `{ canPublish, presetLimit, userId }`.                    |
| GET    | `/` (and other moost-db CRUD)  | List rows; read gate applied via `transformFilter`.                                    |
| POST   | `/`                            | Insert. Server stamps `user`, `userLabel`, `aspects`, derived `label` / `publicLabel`. |
| PATCH  | `/:id`                         | Update. Shallow merge of `data`; identity fields immutable.                            |
| DELETE | `/:id`                         | Remove. Owner check; system ids rejected.                                              |

Cross-link the atscript-db skill `references/moost-db.md` for the full CRUD URL syntax and `AsDbController` hooks.

## Server validation invariants

Source: `packages/moost-ui-presets/src/preset-rules.ts`.

| Rule                                  | Implementation                                                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Reserved id prefixes rejected         | `assertNotReservedId(id)` (`reserved_id` code) for `sys:` / `uc:` / `ac:` on client writes.                       |
| System ids rejected on update/remove  | `assertNotSystemId(id)` (`reserved_id` code).                                                                     |
| Public-label uniqueness               | Indexed `findOne` on `(app, tableKey, label, public=true)` before write + composite unique index race-safety.     |
| Per-user cap                          | `assertWithinCap` — counts only `type='preset'` rows for `(user, app, tableKey)`. Grandfathered on cap decrease.  |
| `type` immutable after create         | Throws `type_immutable` on any change.                                                                            |
| `user` / `app` / `tableKey` immutable | Throws `identity_immutable`.                                                                                      |
| Shallow `data` merge                  | Partial patches preserve unmodified fields (`existing.data ⨯ patch.data`).                                        |
| Public-create gate                    | `assertCanPublish` only on **private → public** transition. Already-public rows are grandfathered.                |
| Read gate                             | `transformFilter` wraps user filter with `{ $or: [{ user }, { type: "preset", public: true }] }`.                 |
| Scope required                        | Reads must include `app`; preset/userConf reads must also include `tableKey`. `$or` / `$not` collapse to no-info. |
| Bulk verbs disabled                   | `insertMany` / `update` / `updateMany` / `replace` / `replaceMany` rejected (`action_unsupported`).               |
| Identity from session                 | `user` and `userLabel` are stamped from session on every write — spoofed body fields are scrubbed.                |
| User-conf default-ref sanitisation    | `sanitiseUserConfData` drops `data.defaultPresetId` when the target preset is no longer visible.                  |

`AsPresetsErrorCode` discriminated union (`packages/ui-table/src/presets/preset-data-types.ts:58-69`):

```typescript
type AsPresetsErrorCode =
  | "preset_limit_reached"
  | "reserved_id"
  | "public_name_conflict"
  | "missing_scope"
  | "missing_id"
  | "invalid_type"
  | "type_immutable"
  | "identity_immutable"
  | "preset_not_found"
  | "publish_forbidden"
  | "action_unsupported";
```

## Wiring a Moost controller

```typescript
// src/_presets.controller.ts
import { AsPresetsController } from "@atscript/moost-ui-presets";
import { Inherit, Controller, Injectable } from "moost";

@Injectable()
@Controller("/api/db/_presets")
@Inherit()
export class PresetsController extends AsPresetsController {
  constructor(private readonly session: SessionService) {
    super();
  }
  protected async getCurrentUser(): Promise<string> {
    return this.session.userId;
  }
}
```

Mount in the Moost app; schema-sync via `DbSpace` (atscript-db). Then on the client:

```vue
<AsTableRoot
  url="/api/db/tables/products"
  :preset="{ url: '/api/db/_presets', tableKey: 'products', persistDrafts: true }"
/>
```

The default `<AsPresetPicker>` is not rendered automatically — drop one in the toolbar:

```vue
<AsTableActions />
<AsPresetPicker />
<AsFilters />
```

## PresetsClient

`packages/ui-table/src/presets/presets-client.ts`. Framework-agnostic wire client. Stateless; the Vue composable holds reactive state.

```typescript
import { PresetsClient, isAuthError, PresetsHttpError } from "@atscript/ui-table";

const client = new PresetsClient({
  url: "/api/db/_presets",
  app: "shop",
  tableKey: "products",
  // either pass `client: Client` directly, or supply `clientFactory: (url) => Client`.
});

const list = await client.list({ capabilities: true });
// { presets, userConf, capabilities, denied }
```

Methods:

| Method                                             | Notes                                                                                    |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `list({ capabilities? })`                          | Returns `{ presets, userConf, capabilities, denied }`. `capabilities=false` skips fetch. |
| `loadCapabilities()`                               | Standalone `/capabilities` request.                                                      |
| `savePreset(id, label, snapshot)`                  | Update existing.                                                                         |
| `savePresetAs(label, snapshot, { public? })`       | Insert; returns `{ id }`.                                                                |
| `renamePreset(id, label)` / `setPublic(id, value)` | Targeted PATCH calls.                                                                    |
| `deletePreset(id)`                                 | DELETE.                                                                                  |
| `upsertUserConf(existing, patch, user?)`           | Insert or update based on existing-row presence.                                         |

`isAuthError(err)` returns `true` for HTTP 401/403 across `ClientError` and `PresetsHttpError`. `available` / `denied` semantics rely on this.

`AppPrefsClient` (`packages/ui-table/src/presets/app-prefs-client.ts`) is the analogous client for `appConf` reads/writes — used internally by `useAppPrefs`.
