---
outline: deep
---

# Presets

Presets save a table view by name. The view is durable: a user can
build the perfect column / filter / sort combination, save it as
"My open orders", and recall it across reloads, devices, and
sessions. Public presets share the view across all users on the
same table.

The client side lives in `@atscript/vue-table`. The persistence
layer is `@atscript/moost-ui-presets` — see [Server-Side Presets](/tables/server-presets)
for the controller setup.

## The snapshot model

A preset is a partial `PresetSnapshot`:

```ts
interface PresetSnapshot {
  columns?: {
    columnNames: string[];
    columnWidths?: Record<string, string>;
  };
  filters?: string[]; // displayed filter field paths
  filterOps?: FieldFilters; // applied filter conditions
  sorters?: SortControl[];
  itemsPerPage?: number;
}
```

Every key is optional. A preset that names only `sorters` claims
only the sort aspect — on apply, the table writes new sorters and
leaves columns / filters / itemsPerPage untouched. This **per-aspect
opt-in** is the entire reason presets are useful: a "sort by
priority" preset doesn't fight a "show financial columns" preset.

Each aspect's presence on the snapshot is the claim that the
preset owns it. The wire form (`PresetSnapshotWire` with
entries-arrays for atscript validation) is converted via
`toWireSnapshot()` / `fromWireSnapshot()` from `@atscript/ui-table`.

## Three preset kinds

| Kind       | ID prefix | Persisted | Scope                |
| ---------- | --------- | --------- | -------------------- |
| **System** | `sys:`    | No        | Built into the app   |
| **User**   | (uuid)    | Yes       | One user, one table  |
| **Public** | (uuid)    | Yes       | All users, one table |

System presets are declared by the app, never round-trip to the
server, and always render in the picker at index 0 onwards. The
standard "All rows" entry is `STANDARD_PRESET_ID = 'sys:standard'`.

User presets are private to the creator. Public presets show in
every user's picker on the same `(app, tableKey)`. Public preset
labels are unique within `(app, tableKey)` — race-safe at the DB
layer via a unique index.

## User config (`userConf`)

Per-user, per-table preferences keyed deterministically as
`uc:${user}:${app}:${tableKey}`:

```ts
interface UserConfData {
  defaultPresetId?: string; // applied at first load
  favPresetIds?: string[]; // pinned in the picker
}
```

The userConf row is auto-stamped by the server when a write
arrives, and the client surfaces it as `state.preset.userConf`. Its
shape is exactly two fields, but they're load-bearing — `setDefault`
and `toggleFav` are atomic operations on this row.

## App config (`appConf`)

App-wide, one row per `(user, app)` — not per table. Carries
appearance, language, timezone, density, date format, custom JSON.
`useAppPrefs()` is the composable that owns it:

```ts
import { useAppPrefs, provideCellLocale } from "@atscript/vue-table";

const { prefs, save } = useAppPrefs({ url: "/api/db/_presets" });

provideCellLocale(() => ({
  language: prefs.value.language,
  timezone: prefs.value.timezone,
}));

await save({ appearance: "dark" }); // optimistic shallow merge
```

`save()` is optimistic: the local `prefs` updates immediately, the
server roundtrip happens in the background, and a failure rolls
back to the previous value.

## The Vue composables

### `usePresets(opts)`

Wraps `PresetsClient` (in ui-table) and exposes a reactive surface
— the same one mounted under `state.preset` when the table root is
configured with `:preset`. Direct use is for custom pickers; most
apps just pass the `preset` prop and let `<AsPresetPicker>` consume
`state.preset`.

```ts
const presets = usePresets({
  url: "/api/db/_presets",
  tableKey: "orders",
  systemPresets: [
    {
      id: "open",
      label: "Open",
      content: { filterOps: { status: [{ type: "eq", value: ["pending"] }] } },
    },
  ],
});
```

### `useLocalDraft(opts)`

Overlays in-progress edits on `localStorage`. The user fiddles with
filters, refreshes the tab, and the table opens in the same state.
The draft is per `(app, tableKey)`, debounced 300ms, and cleared
automatically when the live snapshot matches the active preset's
claimed aspects (so the URL bar stays clean once you're "done"
editing).

Wired automatically when `<AsTableRoot :preset="{ ..., persistDrafts: true }">`
is set; direct use is for programmatic setups.

### `useAppPrefs(opts)`

App-wide user prefs, as above. One round-trip on mount, optimistic
writes via `save()`, optional localStorage cache for cold paint
without a flash of defaults.

## The picker

`<AsPresetPicker>` is a Tier-1 component — a dropdown that lists
system + user + public presets, with **Save**, **Save as…**,
**Reset**, and **Manage…** actions. It reads `state.preset` so the
root has to be configured with `:preset`:

```vue
<AsTableRoot
  url="/api/db/tables/orders"
  :preset="{ url: '/api/db/_presets', tableKey: 'orders', systemPresets }"
>
  <AsTableActions>
    <AsPresetPicker />
  </AsTableActions>
  <AsTable />
</AsTableRoot>
```

When the picker is not configured (omit `:preset`), the preset
surface stays inert: `state.preset.available === false`, every
mutator throws, and the picker hides itself. This makes presets a
zero-cost opt-in.

## Date shortcuts

`dateShortcuts()` returns a fixed list of date-range presets useful
for `bw` (between) conditions: **Last 7 Days**, **Last 30 Days**,
**Month to Date**, **Last 90 Days**, **Last 6 Months**, **Last 12
Months**, **Year to Date**. The filter dialog's date input renders
them as quick-pick buttons.

```ts
import { dateShortcuts } from "@atscript/ui-table";

for (const sc of dateShortcuts()) {
  // { label: 'Last 7 Days', dates: ['2026-05-06', '2026-05-13'] }
}
```

Pass `dateShortcuts(now)` with an explicit reference date for
deterministic tests.

## End-to-end wiring

A typical table page shows the whole flow:

```vue
<AsTableRoot
  :key="path"
  v-model:url-query="urlQuery"
  :url="`/api/db/tables/${apiPath}`"
  :controls="controls"
  :preset="{
    url: '/api/db/_presets',
    tableKey: path,
    systemPresets,
    persistDrafts: true,
  }"
>
  <AsTableActions>
    <AsPresetPicker />
  </AsTableActions>
  <AsTable />
</AsTableRoot>
```

Note `:preset.systemPresets` is per-table — each table can declare
its own built-in views.

## Next steps

- [Server-Side Presets](/tables/server-presets) — wire up the
  Moost controller, override hooks, configure DB.
- [URL State](/tables/url-state) — the address-bar bridge that
  complements presets.
