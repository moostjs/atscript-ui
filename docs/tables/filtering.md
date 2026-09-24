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

Building your own filter UI? Read the same answer the built-ins read:

```ts
import {
  columnDefaultCondition,
  columnFilterConditions,
  isColumnFilterable,
  parseColumnFilterInput,
} from "@atscript/ui-table";

const filterable = state.allColumns.value.filter(isColumnFilterable);
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
  client-owned (`local`) column cannot reach the server.
- **Don't** expect presets to keep them. A preset cannot store one; applying
  a preset that owns the filter conditions clears them, and while one is
  active the view counts as changed — see
  [Presets](/tables/presets#the-snapshot-model).
- **Don't** use them for filters that must always apply — that is
  `:force-filters`, which survives `resetFilters()` and never reaches
  the URL.
- Server tables only: the in-memory (`:rows`) mode ignores them, as it
  ignores field filters.

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

Leaving out an AND-ed piece can only widen the match, so the result is a
superset of the input — and the caller is told:

```ts
import { uniqueryFilterToFieldFilters } from "@atscript/ui-table";

const filters = uniqueryFilterToFieldFilters(expr, knownFields, (issue) =>
  console.info(issue.reason, issue.fields, issue.expr),
);
```

Without a handler each piece is reported with a `console.warn` in
development builds. Conditions on fields outside `knownFields` are
ignored silently (they are not this table's), unless they share a piece
with a known field. `urlQueryStringToState` never warns — it returns the
pieces as `unsupported` on its result — and `<AsTableRoot>` surfaces
them as the `@unsupported-filter` event (`useTable({ onUnsupportedFilter })`
without the component) — see
[URL State](/tables/url-state#links-the-filter-model-cannot-hold).
Up to 0.1.138 these pieces were dropped or reshaped without a report
(a cross-field OR became an AND, `$in` vanished).

### Keeping what the model cannot hold

_Since 0.1.140._ `decomposeUniqueryFilter(expr, { knownFields, carry: true })`
returns `{ filters, residual, unsupported }`: the exact field filters,
the pieces they cannot hold as [custom filter conditions](#custom-filter-conditions),
and the pieces that are still left out (a piece mixing known and unknown
fields). `filters` AND `residual` selects exactly `expr`, minus the
`unsupported` pieces and pieces on fields outside `knownFields`.

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
