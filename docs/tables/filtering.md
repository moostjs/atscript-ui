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

## Filterable columns

Which columns take a filter, and which conditions they offer, comes from
the server's `/meta` (see [Annotations Reference](/tables/annotations)):

| `/meta.fields[path]`                          | Filter UI offers                                   |
| --------------------------------------------- | -------------------------------------------------- |
| `filterable: true`                            | the column type's conditions (text, number, date…) |
| `filterable: false`, `filterOps: ["$exists"]` | only _is empty_ / _is not empty_                   |
| `filterable: false`, no `filterOps`           | nothing — the column is not in any filter UI       |

The middle row is a column whose value cannot be compared but whose
presence can — typically a JSON-stored object or array on a relational
database (`@atscript/moost-db` 0.1.132+ reports it). Since 0.1.139 the
column menu, config dialog, filter dialog and filter bar offer it with
exactly those two conditions; up to 0.1.138 it was hidden from
filtering. As everywhere, `null` / `notNull` are dropped for a
non-nullable column, which leaves such a column with nothing to offer.

### Storage kind (`valueKind`)

_Since 0.1.148._ A column also carries `valueKind` — the scalar storage kind
`createTableDef` derives from its atscript type, which is what the server's
filter guard checks. The filter UI follows it, so a column never offers a
filter the server would refuse:

| Atscript type                                            | `valueKind` | Filter kind                                                      |
| -------------------------------------------------------- | ----------- | ---------------------------------------------------------------- |
| `number.timestamp` (and `.created` / `.updated`)         | `timestamp` | `datetime` — see [Date and time filters](#date-and-time-filters) |
| `string.isoDate`                                         | `isoDate`   | `datetime`                                                       |
| `string.date`                                            | `date`      | `date`                                                           |
| `number.int`, `@expect.int`, `@db.default.increment`…    | `integer`   | `number` (whole numbers only)                                    |
| `number`                                                 | `number`    | `number`                                                         |
| `decimal`                                                | `decimal`   | `number`                                                         |
| `boolean`                                                | `boolean`   | `boolean` (`true` / `false` only)                                |
| `string`                                                 | `string`    | `text`                                                           |
| a union of literals of one kind (`1 \| 2`, `'a' \| 'b'`) | that kind   | `enum`, with typed option values                                 |
| arrays, objects, JSON, mixed unions                      | none        | as before, no value coercion                                     |

A column whose `valueKind` is anything but `string` no longer offers the
pattern conditions (`contains`, `starts`, `ends`, `regex`) — they compile to
`$regex`, which the server only accepts on a string field. That removes them
from a numeric `ref` or `enum` column too. `@ui.table.type` and `@ui.type`
still choose how a cell renders; they change the filter kind only where noted
below (`number` on a timestamp column opts out to raw milliseconds).

Building your own filter UI? Read the same answer the built-ins read:

```ts
import {
  columnDefaultCondition,
  columnFilterConditions,
  columnFilterKind,
  isColumnFilterable,
  parseColumnFilterInput,
} from "@atscript/ui-table";

const filterable = state.allColumns.value.filter(isColumnFilterable);
const kind = columnFilterKind(column); // "datetime" for a timestamp, "number" for an integer…
const ops = columnFilterConditions(column); // e.g. ["null", "notNull"]
const initial = columnDefaultCondition(column); // "null" there, "contains" on text
const typed = parseColumnFilterInput("!<empty>", column); // { type: "notNull", value: [] }
```

- **Do** gate on `isColumnFilterable(column)` — **don't** gate on
  `column.filterable`, which is value comparison only and hides
  existence-only columns.
- **Do** use the column-level helpers `columnDefaultCondition(column)`
  and `parseColumnFilterInput(text, column)` so the default operator and
  typed input stay inside what the column offers. The type-level
  `defaultCondition(type)` / `parseFilterInput(text, type, nullable)`
  know nothing about existence-only columns.

## Date and time filters

_Since 0.1.148._ Timestamp (`number.timestamp`, epoch milliseconds),
`string.isoDate` and `string.date` columns get a **date filter** (`date` or
`datetime` kind): the same conditions as a number (`on`, `not on`, `before`,
`on or before`, `after`, `on or after`, `between`, plus _is empty_ / _is not
empty_ when nullable), with calendar-aware inputs. The text conditions
(`contains`, `regex`) are not offered — the server refuses them on non-string
storage.

The model stays in **calendar terms**; it is turned into what the server
takes only when the query is built, in the table's time zone. So URLs and
saved presets stay readable (`createdAt>='today-6'`), and "last 7 days" keeps
meaning that.

### Values

A date condition value is one of these, and each denotes a **period**
`[start, end)`:

| Value        | Example                                                                    | Period                                                   |
| ------------ | -------------------------------------------------------------------------- | -------------------------------------------------------- |
| Day          | `2026-10-05`                                                               | that day in the table's time zone                        |
| Minute       | `2026-10-05T14:30`                                                         | that minute                                              |
| Month        | `2026-10`                                                                  | that month                                               |
| Relative     | `today`, `today-6`, `week`, `week-1`, `month`, `month-1`, `year`, `year-1` | the current (minus N) day, week, month or year           |
| ISO instant  | `2026-10-05T12:00:00Z`, `…+02:00`                                          | that exact instant (1 ms)                                |
| Epoch number | `1759622400000`                                                            | that instant (1 ms) — app-built links and old deep links |

How a condition compares against its period `[s, e)` (for `between`, from the
first value's start to the second value's end):

| Condition          | Meaning           | Sent as                                            |
| ------------------ | ----------------- | -------------------------------------------------- |
| `eq`               | on                | `{ $gte: s, $lt: e }`                              |
| `ne`               | not on            | `{ $or: [{ f: { $lt: s } }, { f: { $gte: e } }] }` |
| `lt`               | before            | `{ $lt: s }`                                       |
| `lte`              | on or before      | `{ $lt: e }`                                       |
| `gt`               | after             | `{ $gte: e }`                                      |
| `gte`              | on or after       | `{ $gte: s }`                                      |
| `bw`               | between           | `{ $gte: s(a), $lt: e(b) }`                        |
| `null` / `notNull` | empty / not empty | unchanged (`$exists`; nullable columns only)       |

The bounds are written in the column's storage form: epoch milliseconds for a
timestamp (and for a number column shown as a date), an ISO string
(`toISOString()`) for `string.isoDate`, `YYYY-MM-DD` for `string.date` —
where an instant's time of day is cut and the end is the next day. Two rules
keep it exact: an **epoch number** against an epoch column is compared as is
(`eq 1759622400000` is `= 1759622400000`), and a string the grammar cannot
read (a hand-edited URL) is sent unchanged, so the server answers a clear 400
instead of the filter quietly meaning something else.

::: warning ISO strings compare lexically
A `string.isoDate` column is compared as text. The bounds are UTC
(`…Z`), which is exactly right when stored values are UTC-normalized — what
`toISOString()` and the database adapters write. A value stored with an
offset (`…+02:00`) compares by its spelling, not its instant.
:::

### Time zone

"Which instant is Oct 5" and "when does today start" belong to the **viewer**.
The table reads them in this order, and cells, filter inputs, chips and queries
all use the same one:

1. `<AsTableRoot :time-zone="…">` (or `useTable(url, { timeZone })`) — it is
   also provided to the subtree as the cell locale's time zone;
2. the surrounding [cell locale](/tables/cells) (`provideCellLocale({ timezone })`
   — what an app's preferences feed);
3. the browser's zone.

`state.timeZone` exposes the effective zone. Changing it re-queries when a
date filter is set (and only then). The week starts on the day the locale says
(`Intl.Locale#getWeekInfo`), Monday when the runtime cannot tell; override it
with `useTable(url, { weekStart: 7 })`. Wall times a daylight-saving change
skips take the later valid instant, repeated ones the earlier; days that are
23 or 25 hours long are measured, not assumed.

### Inputs, shortcuts and chips

- **Date** column: a native `<input type="date">`. **Date-time** column: the
  same, plus a clock button that switches the input (or both inputs of a
  _between_) to `datetime-local`; the precision follows the value's shape, so
  it survives a reload. No picker library is added — an app that wants one
  overrides `controls.filterInput`.
- A relative token or an epoch number shows as a **pill** worded like its chip
  ("yesterday", "Oct 5, 2026, 14:30"). Click the pill to edit it as a day (or
  minute); `×` empties it.
- The conditions panel's **Quick** row writes relative conditions —
  `temporalShortcuts()`: Today, Yesterday, Last 7 days (`bw today-6…today`),
  Last 30 days, This week, Last week, This month, Last month, This year.
- Chips word a condition for the column: an exact shortcut shows its name
  ("Last 7 days"), anything else an operator and a date in the table's zone and
  locale ("on Oct 5, 2026", "Oct 1 – Oct 5, 2026", "after Oct 5, 2026, 14:30").
- The filter bar takes the same grammar: `>=2026-01-01`, `today-6...today`,
  `month-1`. A value that is not a date sends nothing.

### URLs and presets stay relative

The URL carries the raw model — `createdAt>='today-6'&createdAt<=today`,
`createdAt='2026-10-05'` — and a saved preset stores it too. A shared "Last 7
days" link therefore means the recipient's last 7 days, in their time zone.
There is deliberately no "freeze to absolute dates" option: a user who wants
fixed dates picks an absolute range.

### Typed values, everywhere

One encoder turns every filter value — typed in, from a URL, from a preset or
from a dropdown — into the type the column stores, when the query is built.
Text input only **validates** (text that is not a value for the column is not
a filter and sends nothing); it shares the encoder's helpers, so a value means
the same whatever its source.

| `valueKind`                    | What is sent                                                                                                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `timestamp`, `isoDate`, `date` | the date periods above                                                                                                                                                 |
| `number`                       | a number (`'5'` from a URL becomes `5`); an empty box stays unfilled, never `0`                                                                                        |
| `integer`                      | a whole number; `5.5` is not a filter                                                                                                                                  |
| `decimal`                      | a numeric **string** (`'12.50'`; a number from a URL is stringified) — decimals are strings end to end, so no digit is rounded, and the server accepts numeric strings |
| `boolean`                      | `true` / `false` (case-insensitive text becomes a boolean; anything else is not a filter)                                                                              |
| literal union dropdown         | the typed literal (`true`, `3`), not its string key                                                                                                                    |
| anything else                  | as it is                                                                                                                                                               |

A string the encoder cannot read (a hand-edited URL) is sent unchanged, so the
server answers a clear 400.

### Upgrading to 0.1.148

- `number.timestamp` columns now get a date-time filter. Before, they got a
  text filter the server refused. **Remove** any table client that marks
  timestamps non-filterable in `/meta` as a workaround.
- `string.date` and `string.isoDate` columns move from the text filter to a
  date filter, so `contains` and `regex` are no longer offered on them. This
  is a fix — a lexical `contains` on dates is rarely what users want, and the
  encoded ranges are exact for ISO / UTC storage. `@ui.table.type`, `@ui.type`
  and cell rendering are unchanged.
- Columns with non-string storage (numeric `enum` and `ref` included) no
  longer offer the pattern conditions.
- `ColumnFilterType` gains `"datetime"`. A custom `controls.filterInput` with
  an exhaustive `switch` must handle it; falling through to a text input still
  works, because the encoder accepts typed day, minute and ISO strings.
- Clearing a number filter input no longer applies `= 0`; a boolean column
  rejects text other than `true` / `false`.
- `dateShortcuts()` (absolute dates) is deprecated in favour of
  `temporalShortcuts()` (relative conditions).
- Presets and URLs saved with `YYYY-MM-DD` values on a timestamp column now
  work (they used to fail); epoch-number links keep their exact meaning.
- A decimal filter value is now always a numeric string (`total>'100'` in the
  URL), where it used to be a number below 15 digits.
- `forceFilters` / `forceSorters` / `alwaysSelected` are live, so the `:key`
  that remounted a scoped table is no longer needed.
- `useTableUrlQuery` no longer inlines `vue-router` types (about 1,400 lines in
  the published typings), so the cast an app's own router needed can go.

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

After the fields it renders one "Custom filter" chip per
[custom filter condition](#custom-filter-conditions) — always inline,
never moved into the overflow popover. `:residual="false"` hides them
when you place `<AsResidualFilter>` yourself.

#### Overflow — capping the row

_Since 0.1.133._ A wide table can list more filter fields than a toolbar row can
hold. `:max-visible` caps how many render inline and moves the rest into a
popover behind a **More filters** trigger:

```vue
<AsFilters :max-visible="3" />
```

The trigger badges the number of **active** filters hidden inside it, so a
filter that is narrowing the result set from off-screen stays discoverable. Open
it with a click or <kbd>Enter</kbd>/<kbd>Space</kbd> — it is an ordinary button,
and focus moves into the panel, which renders the same `<AsFilterField>`s (your
`controls.filterField` swap included).

| Prop          | Default                            | Meaning                                                                                                                                                                                 |
| ------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `max-visible` | — (all fields inline)              | How many fields render inline.                                                                                                                                                          |
| `overflow`    | `'popover'` when `max-visible` set | `'popover'` → the More-filters panel; `'none'` → don't render the extra fields at all (only when your app surfaces them elsewhere — an active filter on a dropped field still applies). |

The cap is count-based and deterministic: `<AsFilters>` never measures the
toolbar. Width-driven responsiveness stays with the host, which knows its own
breakpoints — feed a smaller `:max-visible` (or a shorter `:filter-fields`) from
your own media query or container query.

`<AsFilters>` renders a bare fragment — the fields and the overflow trigger,
with no wrapper element of its own — so they are direct children of whatever
toolbar row you wrap them in, and you style that row.

Styling hooks: `as-filters-overflow-trigger`, `as-filters-overflow-badge`,
`as-filters-overflow`.

##### Controlling the popover

_Since 0.1.142._ The popover keeps its own open state unless you bind it:

| API                                         | What it does                                                                                                                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v-model:overflow-open`                     | Open state of the popover — drive it (close before your own dialog opens) or observe it. Unbound → uncontrolled.                                                              |
| `@overflow-open-auto-focus`                 | The popover is about to focus its first field. Cancellable: `event.preventDefault()` keeps focus where it is.                                                                 |
| `@overflow-close-auto-focus`                | The popover closed and is about to return focus to its trigger. Cancellable: `event.preventDefault()` to focus something else.                                                |
| `#overflow-trigger="{ activeCount, open }"` | Replaces the trigger. Render **one** focusable element (a `<button>`, or a component that forwards attrs) — the popover merges its ARIA attributes and click handler onto it. |
| `#overflow="{ columns, close }"`            | Replaces the popover body. `columns` = the overflowed fields' columns; `close()` closes the popover.                                                                          |

```vue
<script setup lang="ts">
import { ref } from "vue";
const moreOpen = ref(false);
</script>

<template>
  <AsFilters v-model:overflow-open="moreOpen" :max-visible="3">
    <template #overflow-trigger="{ activeCount }">
      <button type="button" class="my-more-btn">More ({{ activeCount }})</button>
    </template>
  </AsFilters>
</template>
```

<kbd>F4</kbd> inside an overflowed field opens the value help / filter dialog
and leaves the popover open, so closing the dialog returns focus to the same
input. When your app renders its own (non-reka) filter dialog that fights the
popover for focus, close the popover as the dialog opens —
`state.filterDialogColumn` is set while it is open:

```ts
const { state } = useTableContext();
watch(
  () => state.filterDialogColumn.value,
  (column) => column && (moreOpen.value = false),
);
```

`$attrs` still go to every filter field, never to the popover.

### `<AsFilterField>` — one inline filter

The Tier-2 default for a single inline filter chip / input. Reads
`column.type` and `column.options` to pick the right input shape
(text, number, date range, value-help typeahead, …). Calls
`state.setFieldFilter(path, conditions)` on change.

Typed values are coerced to the column's type: number columns get
numbers, and boolean columns understand `true` / `false`
(case-insensitive) — since 0.1.133 they produce real booleans, so a
boolean filter round-trips through the URL and matches. Any other
text on a boolean column stays a string and matches nothing.

### `<AsFilterDialog>` — per-column condition builder

Mounted automatically by `<AsTableRoot>`. Opens when the user picks
_Filter_ from a column-menu, or when you call
`state.openFilterDialog(column)` directly. Lets the user compose
multiple conditions per column (OR-ed, per the
[combination rules](#combination-rules) — use _between_ for a range) and
pick from the operators the column offers
([Filterable columns](#filterable-columns)). `null` / `notNull` are
hidden for non-nullable columns.

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
  user's filters (and survives `state.resetFilters()`). See
  [Forced scope is live](#forced-scope-is-live).

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

### Forced scope is live

_Since 0.1.148._ `:force-filters`, `:force-sorters` and `:always-selected`
are **live**: pass a computed (or any changing value) and the mounted table
follows it — no `:key`, no remount.

```vue
<script setup>
const route = useRoute();
const forceFilters = computed(() => ({ status: String(route.query.status) }));
</script>
<template>
  <AsTableRoot url="/api/db/tables/orders" :force-filters="forceFilters" />
</template>
```

What a change does:

- **`forceFilters`** — one new query on **page 1**, with the new filter. The
  user's filters, search, sorters and columns are kept. The value is compared
  structurally: a new object with the same content (an inline literal
  re-created on every render) does nothing, and editing a `reactive` filter in
  place is picked up. A held query selection ("select all matching") is
  dropped, as for any scope change (`@selection-reset` with `reason: "scope"`).
- **`forceSorters`** — one new query that keeps the page, like a user sorter
  change.
- **`alwaysSelected`** — one new query with the new `$select`.
- Changes landing in the same tick — several of these props, or one of them
  together with a URL change — send **one** query. Only a filter change resets
  the page; with a URL change the URL's page wins.
- Nothing is sent before the first query: a change that lands before `/meta`
  resolves is simply what the first fetch uses. To avoid fetching before the
  scope is known at all, hold the table with `:block-query` — a table that is
  blocked never sends the stale initial scope; on release it sends one query
  with the current one.

`state.forceFilters` and `state.forceSorters` expose the current values for
chrome (a "scoped to …" badge); the config dialog shows forced sorters locked.

Everything else on `<AsTableRoot>` that wires the table up — `url`,
`queryFn`, `clientFactory`, `preset`, `urlQuerySync`, `displayColumns`,
`limit`, `components`, `types`, and `columns` in `:rows` mode — is read once.
Changing one after mount warns in development; `:key` the component to switch
it.

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

Clears every entry from `state.filters` and every
[custom filter condition](#custom-filter-conditions)
(`state.residualFilters`). Does NOT touch `state.filterFields` — the
empty input rows remain visible, ready for the next keystroke.

## Custom filter conditions

_Since 0.1.140._ Some filters have no per-field shape: "fast-lane tickets
opened in the last 100 minutes, or slow-lane ones in the last 50" is a
cross-field OR that no set of field chips can hold. The table keeps such
conditions as **residual filters** — AND-ed Uniquery expressions applied
after the field filters — instead of dropping them:

```vue
<AsTableRoot url="/api/db/tables/tickets" v-slot="{ setResidualFilters }">
  <button
    @click="
      setResidualFilters([
        {
          $or: [
            { lane: 'fast', openedAt: { $lte: 100 } },
            { lane: 'slow', openedAt: { $lte: 50 } },
          ],
        },
      ])
    "
  >
    Overdue tickets
  </button>
  <AsFilters />
  <AsTable />
</AsTableRoot>
```

The usual source is a link: a URL whose filter the field model cannot
hold restores its extra pieces here automatically — see
[URL State](/tables/url-state#links-the-filter-model-cannot-hold).

| API                                        | What it does                                                  |
| ------------------------------------------ | ------------------------------------------------------------- |
| `state.residualFilters`                    | `ShallowRef<FilterExpr[]>` — read it, watch it, or replace it |
| `state.setResidualFilters(exprs)`          | Replace them (empty expressions and duplicates dropped)       |
| `state.removeResidualFilter(index)`        | Remove one                                                    |
| `state.resetFilters()`                     | Clear them together with the field filters                    |
| `formatFilterExpr(expr, labelOf?)`         | Words a condition like the chips do (`@atscript/ui-table`)    |
| `decomposeUniqueryFilter(expr, { carry })` | Split a `FilterExpr` into field filters + residual conditions |

A residual condition may filter by related rows on a relation the server
marks filterable (`tableDef.relations[].filterable`, `@db.rel.filterable`
on the server, `@atscript/moost-db` 0.1.147+) —
`{ ticket: { $some: { status: "open" } } }`; the chip words it
`Ticket has some (status equals open)` (`has none` for `$none`). The
table offers no UI to author one. Since 0.1.147.

They behave like the field filters: every change refetches (page 1),
writes the URL and shows in exports (`buildQuery`). `<AsFilters>` shows
each one as a chip in words — `(Lane equals fast and Opened at less or
equal 100) or (…)` — with a remove button; swap the chip through the
`residualFilter` [control](/tables/customization).

- **Do** decompose a `FilterExpr` you hold before applying it —
  `const { filters, residual } = decomposeUniqueryFilter(expr, { knownFields, carry: true })`,
  then write both. A representable condition written straight into
  `residualFilters` still filters correctly, but comes back as a field
  chip after a URL round trip.
- **Do** reference only server-backed columns: a condition on a
  client-owned (`local`) column cannot reach the server, and one on a
  field the caller cannot read is left out of the query whole
  ([Fields Hidden by Role](/tables/hidden-fields)).
- **Don't** expect presets to keep them. A preset cannot store one; applying
  a preset that owns the filter conditions clears them, and while one is
  active the view counts as changed — see
  [Presets](/tables/presets#the-snapshot-model).
- **Don't** use them for filters that must always apply — that is
  `:force-filters`, which survives `resetFilters()` and never reaches
  the URL.
- Server tables only: the in-memory (`:rows`) mode ignores them, as it
  ignores field filters.

### Encoding values for the server

_Since 0.1.148._ `filtersToUniqueryFilter(filters, { encode })` and
`buildTableQuery({ …, encodeCondition })` take a `ConditionEncoder` — a
function `(field, condition, now?) => FilterExpr | undefined` consulted before the
default conversion (`undefined` means "no opinion"; `now` is the query's one
clock reading). The table passes
`createColumnValueEncoder(columns, { timeZone, weekStart })`, which is how
[date filters and the other typed values](#typed-values-everywhere) become
what the server accepts; build your own queries with the same one:

```ts
import { buildTableQuery, createColumnValueEncoder } from "@atscript/ui-table";

const query = buildTableQuery({
  visibleColumnPaths: ["id", "createdAt"],
  sorters: [],
  filters: { createdAt: [{ type: "bw", value: ["today-6", "today"] }] },
  encodeCondition: createColumnValueEncoder(columns, { timeZone: "Europe/Berlin" }),
});
// → createdAt: { $gte: <Berlin midnight 6 days ago>, $lt: <tomorrow midnight> }
```

Residual and forced filters are already Uniquery and are never encoded. URLs
and presets carry the raw model — `stateToUrlQueryString` never encodes.

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

## Converting a Uniquery filter back

`uniqueryFilterToFieldFilters` rebuilds `FieldFilters` from a Uniquery
filter — the URL bridge decodes every restored URL with it. It is exact
for everything `filtersToUniqueryFilter` writes, and for:

| Input                                                 | Becomes                                 |
| ----------------------------------------------------- | --------------------------------------- |
| `{ status: { $in: ["open", "review"] } }`             | two `eq` conditions on `status` (OR-ed) |
| `{ status: { $nin: ["done"] } }`                      | an `ne` condition                       |
| `{ $or: [{ n: 1 }, { n: { $gte: 5, $lte: 9 } }] }`    | `eq 1` + `bw 5..9` on `n`               |
| `{ $not: { status: "done" } }`                        | `ne "done"`                             |
| `{ team: "core", $or: [...] }` (fields next to `$or`) | `team` kept alongside the `$or` result  |

Anything the per-field model cannot express is **left out whole and
reported** — never approximated (to keep those pieces instead, see
`decomposeUniqueryFilter` below):

| `reason`        | Example                                           |
| --------------- | ------------------------------------------------- |
| `"cross-field"` | `{ $or: [{ lane: "fast" }, { openedAt: 5 }] }`    |
| `"conjunction"` | `{ total: { $gt: 1, $lt: 5 } }` — keeps `$gt`     |
| `"negation"`    | `{ $not: { total: { $gt: 5 } } }`                 |
| `"operator"`    | `{ tags: { $all: ["a"] } }`, `{ n: { $in: [] } }` |
| `"relation"`    | `{ ticket: { $some: { status: "open" } } }`       |
| `"syntax"`      | URL segment `priority>>2` (URL decoding only)     |

A relational predicate (`$some` / `$none`, since 0.1.147) filters by
related rows, which no field chip expresses; `fields` names the relation
only. `"syntax"` comes from [URL decoding](/tables/url-state#links-the-filter-model-cannot-hold):
the segment is in `issue.raw` and `expr` is `{}`.

Leaving out an AND-ed piece can only widen the match, so the result is a
superset of the input — and the caller is told:

```ts
import { uniqueryFilterToFieldFilters } from "@atscript/ui-table";

const filters = uniqueryFilterToFieldFilters(expr, knownFields, (issue) =>
  console.info(issue.reason, issue.fields, issue.expr),
);
```

Without a handler each piece is reported with a `console.warn` in
development builds. Pieces that name a field outside `knownFields` are
ignored silently (they are not this table's), including a piece that
mixes a known field with an unknown one (reported up to 0.1.140).
`urlQueryStringToState` never warns — it returns the
pieces as `unsupported` on its result — and `<AsTableRoot>` surfaces
them as the `@unsupported-filter` event (`useTable({ onUnsupportedFilter })`
without the component) — see
[URL State](/tables/url-state#links-the-filter-model-cannot-hold).
Up to 0.1.138 these pieces were dropped or reshaped without a report
(a cross-field OR became an AND, `$in` vanished).

### Keeping what the model cannot hold

_Since 0.1.140._ `decomposeUniqueryFilter(expr, { knownFields, carry: true })`
returns `{ filters, residual, unsupported, unknown }`: the exact field
filters, the pieces they cannot hold as
[custom filter conditions](#custom-filter-conditions), the pieces that are
still left out because the model cannot express them, and (since 0.1.141)
the pieces left out because they name a field outside `knownFields`,
alone or mixed with known ones (each `{ expr, fields }`, `fields` being
the unknown paths). `filters` AND `residual` selects exactly
`expr`, minus the `unsupported` and `unknown` pieces. `unknown` means
"not this caller's to use" (see [Fields Hidden by Role](/tables/hidden-fields));
`unsupported` means "not expressible".

```ts
import { decomposeUniqueryFilter } from "@atscript/ui-table";

const { filters, residual } = decomposeUniqueryFilter(expr, {
  knownFields: state.allColumns.value.map((c) => c.path),
  carry: true,
});
state.filters.value = filters;
state.setResidualFilters(residual);
```

With `carry`, a field with two positive groups (`total > 1 AND total < 5`)
keeps **neither** as a field filter — both become residual conditions,
so no chip shows half of the range. Without `carry` the result is the
0.1.139 split, which `uniqueryFilterToFieldFilters` still returns.

## Next steps

- [Sorting](/tables/sorting) — multi-sort and force-sort semantics.
- [URL State](/tables/url-state) — shareable filter URLs.
- [Annotations Reference](/tables/annotations) — how `@db.index.*`
  drives `meta.fields[*].filterable` and what flips operator
  availability.
