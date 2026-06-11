---
outline: deep
---

# Filtering

The filter model is plain data. Mutators are pure — they touch exactly
one entity — and the watcher at the table root translates state changes
into a fresh query. This means dialogs, custom toolbars, external
`v-model`s and devtools all use the same surface.

## The filter model

The model lives at `state.filters`:

```typescript
type FieldFilters = Record<string, FilterCondition[]>;

interface FilterCondition {
  type: FilterConditionType;
  value: (string | number | boolean)[];
}

type FilterConditionType =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "starts"
  | "ends"
  | "bw" // between (value[0]..value[1])
  | "null"
  | "notNull"
  | "regex";
```

A `FieldFilters` map can hold multiple conditions per field. Most
condition types use `value[0]`; `bw` uses `value[0]` (low) and
`value[1]` (high); `null` and `notNull` ignore the value.

### Combination rules

`filtersToUniqueryFilter` (in `@atscript/ui-table`) is the authoritative
translation:

- **Per field — inclusion conditions are OR-ed.** `eq`, `gt`, `gte`,
  `lt`, `lte`, `contains`, `starts`, `ends`, `bw`, `null`, `regex` are
  inclusive: any one matching counts.
- **Per field — exclusion conditions are AND-ed.** `ne` and `notNull`
  are exclusive: every one must hold.
- **Across fields — AND.** Every field group is AND-ed at the top
  level.

```typescript
// state.filters
{
  status: [
    { type: "eq", value: ["paid"] },
    { type: "eq", value: ["draft"] },
  ],
  amount: [
    { type: "gt", value: [100] },
  ],
}

// → Uniquery filter
{
  $and: [
    { $or: [{ status: "paid" }, { status: "draft" }] },
    { amount: { $gt: 100 } },
  ]
}
```

::: details Condition types and their Uniquery shape
| UI condition | Uniquery emission |
| ------------ | ----------------- |
| `eq` | `{ field: value }` |
| `ne` | `{ field: { $ne: value } }` |
| `gt`/`gte`/`lt`/`lte` | `{ field: { $gt: value } }` (etc.) |
| `contains` | `{ field: { $regex: "/<value>/i" } }` (escaped) |
| `starts` | `{ field: { $regex: "/^<value>/i" } }` |
| `ends` | `{ field: { $regex: "/<value>$/i" } }` |
| `bw` | `{ field: { $gte: lo, $lte: hi } }` |
| `null` | `{ field: { $exists: false } }` |
| `notNull` | `{ field: { $exists: true } }` |
| `regex` | `{ field: { $regex: <value> } }` |
:::

## Display state vs applied state

Two independent arrays drive filtering:

- **`state.filterFields: string[]`** — display state. Which filter
  inputs are currently shown in the filter bar.
- **`state.filters: FieldFilters`** — applied state. The actual
  conditions sent to the server.

They are independent on purpose:

- Hiding an input (`removeFilterField(path)`) does **not** clear its
  value. The next time you re-show it, the previous filter is still
  applied.
- Clearing a value (`removeFieldFilter(path)`) does **not** hide the
  input. The empty filter row stays in the bar so the user can re-type.

This is a hard rule of the model contract — see the Mutators-are-pure
section in `CLAUDE.md`. Apply it to anything you add downstream.

## Components

### `<AsFilters>` — the filter bar

`<AsFilters>` reads `state.filterFields` and renders one
`<AsFilterField>` per entry. It accepts an optional `:filter-fields`
prop if you want to render a static subset; otherwise it tracks the
state.

```vue
<AsTableRoot url="/db/tables/products" v-slot="slot">
  <AsFilters />
  <AsTable />
</AsTableRoot>
```

### `<AsFilterField>` — one inline filter

The Tier-2 default for a single inline filter chip / input. Reads
`column.type` and `column.options` to pick the right input shape
(text, number, date range, value-help typeahead, …). Calls
`state.setFieldFilter(path, conditions)` on change.

### `<AsFilterDialog>` — per-column condition builder

Mounted automatically by `<AsTableRoot>`. Opens when the user picks
_Filter_ from a column-menu, or when you call
`state.openFilterDialog(column)` directly. Lets the user compose
multiple conditions per column (e.g. `> 100` AND `<= 1000`) and pick
operators from the full `FilterConditionType` palette. The dialog
respects `column.nullable` — `null` / `notNull` are hidden for
non-nullable columns.

Override it via `:controls.filterDialog` (pass only the override —
other slots fall back to their built-ins):

```ts
import MyFilterDialog from "./MyFilterDialog.vue";

const controls = { filterDialog: MyFilterDialog };
```

### Value-help filters

When a column has `valueHelpInfo` (because the field carries
`@db.rel.FK`), the filter dialog mounts `AsFilterValueHelp` — a mini
table or typeahead that lets the user pick FK targets by their
`@ui.dict.label`. The picker queries the referenced table's value-help
endpoint with the columns flagged `@ui.dict.filterable` /
`@ui.dict.sortable` / `@ui.dict.searchable`.

The resulting filter is a plain `eq` (or `OR` of `eq`s) on the FK
column — no special wire shape; the value-help is purely a UI affordance.

## Programmatic filters

### Set an initial filter

Initial filters flow through whichever channel makes sense:

- **`v-model:filter-fields`** — control which filter inputs are
  displayed.
- **`v-model:url-query`** — let users bookmark filter state via the
  URL bridge.
- **`:force-filters`** — a `FilterExpr` that's AND-merged on top of the
  user's filters (and survives `state.resetFilters()`).

For one-off programmatic application from the parent component:

```vue
<AsTableRoot url="/db/tables/orders" ref="root" v-slot="{ setFieldFilter }">
  <button @click="setFieldFilter('status', [{ type: 'eq', value: ['open'] }])">
    Show open orders
  </button>
  <AsTable />
</AsTableRoot>
```

`setFieldFilter` writes to `state.filters` only. If you also want the
chip visible in `<AsFilters>`, call `addFilterField('status')`.

### Read current filters

The slot props on `<AsTableRoot>` expose `filters` directly. Inside the
default slot's scope they're already unwrapped from the ref. From
outside the slot, use the exposed `state`:

```ts
const root = ref<InstanceType<typeof AsTableRoot> | null>(null);
// ...
const currentFilters = root.value?.state.filters.value;
```

### `state.resetFilters()`

Clears every entry from `state.filters`. Does NOT touch
`state.filterFields` — the empty input rows remain visible, ready for
the next keystroke.

## `filtersToUniqueryFilter` directly

The translation is a pure function, exported from `@atscript/ui-table`:

```ts
import { filtersToUniqueryFilter } from "@atscript/ui-table";

const filter = filtersToUniqueryFilter({
  status: [{ type: "eq", value: ["paid"] }],
  amount: [{ type: "gt", value: [100] }],
});
// → { $and: [{ status: "paid" }, { amount: { $gt: 100 } }] }
```

Useful when you're piping filters into a non-table query (e.g. an
export endpoint) or wiring `forceFilters` from elsewhere in your app.

The inverse — `uniqueryFilterToFieldFilters` — is also exported, and
powers the URL-state bridge's hydration step. See
[URL State](/tables/url-state).

## Next steps

- [Sorting](/tables/sorting) — multi-sort and force-sort semantics.
- [URL State](/tables/url-state) — shareable filter URLs.
- [Annotations Reference](/tables/annotations) — how `@db.index.*`
  drives `meta.fields[*].filterable` and what flips operator
  availability.
