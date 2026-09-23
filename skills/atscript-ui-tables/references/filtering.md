Filter model, condition types, dialogs, OR/AND semantics.

## Contents

- [Filter model](#filter-model)
- [Per-field OR / AND semantics](#per-field-or--and-semantics)
- [filterFields vs filters](#filterfields-vs-filters)
- [filtersToUniqueryFilter](#filterstouniqueryfilter)
- [Decoding a Uniquery filter](#decoding-a-uniquery-filter)
- [Condition availability per column type](#condition-availability-per-column-type)
- [Existence-only columns](#existence-only-columns)
- [AsFilters component](#asfilters-component)
- [AsFilterField component](#asfilterfield-component)
- [AsFilterDialog component](#asfilterdialog-component)
- [AsFilterValueHelp](#asfiltervaluehelp)
- [Date shortcuts](#date-shortcuts)
- [Recipes](#recipes)

## Filter model

```typescript
export type FilterConditionType =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "starts"
  | "ends"
  | "bw"
  | "null"
  | "notNull"
  | "regex";

export interface FilterCondition {
  type: FilterConditionType;
  value: (string | number | boolean)[];
}

export type FieldFilters = Record<string, FilterCondition[]>;
```

Each entry on `state.filters` is a path → conditions array. Value usage:

| Type                     | Uses                                | Notes                                                       |
| ------------------------ | ----------------------------------- | ----------------------------------------------------------- |
| `eq`, `ne`               | `value[0]`                          | Exact compare.                                              |
| `gt`, `gte`, `lt`, `lte` | `value[0]`                          | Order ops.                                                  |
| `contains`               | `value[0]`                          | Compiled to `$regex: /escaped/i`.                           |
| `starts`                 | `value[0]`                          | Compiled to `$regex: /^escaped/i`.                          |
| `ends`                   | `value[0]`                          | Compiled to `$regex: /escaped$/i`.                          |
| `bw`                     | `value[0]` (low), `value[1]` (high) | Inclusive between.                                          |
| `null` / `notNull`       | ignored                             | `$exists: false` / `$exists: true`.                         |
| `regex`                  | `value[0]`                          | Raw uniqu regex (no escape, no `i` flag — caller controls). |

`isFilled(condition)` determines whether a condition contributes to the Uniquery: `null`/`notNull` always count; `bw` requires both values present; everything else needs `value[0]`.

## Per-field OR / AND semantics

`filtersToUniqueryFilter` semantics:

| Group within one field                                                                              | Combiner |
| --------------------------------------------------------------------------------------------------- | -------- |
| Inclusion ops (`eq`, `gt`, `gte`, `lt`, `lte`, `contains`, `starts`, `ends`, `bw`, `null`, `regex`) | `$or`    |
| Exclusion ops (`ne`, `notNull`)                                                                     | `$and`   |
| Across fields                                                                                       | `$and`   |

Single-condition groups unwrap to a bare expression (no enclosing `$or`/`$and`). Empty groups are skipped. The function returns `undefined` when nothing is filled — `buildTableQuery` then omits `filter` entirely.

`EXCLUSION_TYPES` is the source of truth for exclusion ops — extend only if a new condition type is added to the model.

## filterFields vs filters

`state.filterFields: string[]` — **display state**, ordered list of paths whose inline filter input is visible (`<AsFilters>` renders one `<AsFilterField>` per entry).

`state.filters: FieldFilters` — **applied state**, dict of conditions per path that compose the Uniquery filter.

Invariant 3:

| Mutation                         | Effect on `filterFields` | Effect on `filters` |
| -------------------------------- | ------------------------ | ------------------- |
| `state.addFilterField(path)`     | append if absent         | none                |
| `state.removeFilterField(path)`  | remove                   | none                |
| `state.setFieldFilter(path, [])` | none                     | delete `[path]`     |
| `state.removeFieldFilter(path)`  | none                     | delete `[path]`     |
| `state.resetFilters()`           | none                     | `{}`                |

A field can have applied conditions but no visible input (preset applied state, URL hydration); a field can have a visible input but no applied conditions (user opened the input but hasn't typed). When building a custom filter dialog, write `filterFields` and `filters` independently — cross-clearing one from the other fights the watcher and produces double-fetches.

## filtersToUniqueryFilter

```typescript
import { filtersToUniqueryFilter } from "@atscript/ui-table";

const filter = filtersToUniqueryFilter({
  status: [
    { type: "eq", value: ["active"] },
    { type: "eq", value: ["pending"] },
  ],
  name: [{ type: "contains", value: ["acme"] }],
});
// → { $and: [
//      { $or: [{ status: "active" }, { status: "pending" }] },
//      { name: { $regex: "/acme/i" } },
//    ] }
```

Pure function — no framework dependencies. The atscript-db skill documents the `Uniquery` `FilterExpr` shape (`$eq`, `$ne`, `$regex`, `$gt`, `$gte`, `$lt`, `$lte`, `$exists`, `$and`, `$or`, `$not`).

## Decoding a Uniquery filter

`uniqueryFilterToFieldFilters(expr, knownFields?, onUnsupportedFilter?)` rebuilds `FieldFilters`; the URL bridge decodes every restored URL with it.

| #   | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Exact for everything `filtersToUniqueryFilter` writes** — round-trip never reports.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2   | **Exact mappings:** `$in` → `eq` per value (OR); `$nin` → `ne` per value; `null` member → `null` / `notNull`; same-field `$or` → that field's OR'd conditions; `$not` of eq/ne/null/notNull → inverse (De Morgan over `$in`); split `$gte` + `$lte` → `bw`.                                                                                                                                                                                                                                                        |
| 3   | **Fields next to `$or` / `$and` / `$not` in one object are kept** (≤ 0.1.138 dropped them).                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 4   | **Never approximates.** An AND-ed piece the model can't hold is left out whole and reported: `reason` `"cross-field"` (`a=1 OR b=2`, correlated ORs), `"conjunction"` (second positive group on a field, e.g. `$gt` + `$lt`; the first is kept), `"negation"` (`$not` of a range, negative inside `$or`), `"operator"` (unknown `$op`, `$nor`, empty `$in`, object operand). Result = superset of the input. ≤ 0.1.138: cross-field `$or` became an AND per field (broader / narrower), `$in` vanished — silently. |
| 5   | **Report channel:** `onUnsupportedFilter(issue)` (`{ reason, expr, fields }`) when given, else dev-mode `console.warn("[ui-table] Filter left out …")`. `urlQueryStringToState` never warns — it returns the pieces as `result.unsupported` (omitted when none). The table reports them via `useTable({ onUnsupportedFilter })` / `<AsTableRoot @unsupported-filter>`, else dev `console.warn("[vue-table] URL filter left out …")`.                                                                               |
| 6   | **Unknown fields (`knownFields`) are ignored silently** (host flags, stale columns) unless they share a piece with a known field — then that piece is reported.                                                                                                                                                                                                                                                                                                                                                    |

Do not hand-roll a residual/fallback filter for the left-out piece; surface the report to the user instead.

## Condition availability per column type

| Column type | Available conditions                                                       |
| ----------- | -------------------------------------------------------------------------- |
| `text`      | `eq`, `ne`, `contains`, `starts`, `ends`, `bw`, `null`, `notNull`, `regex` |
| `number`    | `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `bw`, `null`, `notNull`              |
| `boolean`   | `eq`, `ne`, `null`, `notNull`                                              |
| `date`      | `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `bw`, `null`, `notNull`              |
| `enum`      | same as `text`                                                             |
| `ref`       | same as `text`                                                             |

Non-nullable columns (per `@expect.optional` absent) drop `null` / `notNull`. Use `conditionsForType(type, nullable)` to read the resolved list. Map a `ColumnDef.type` string to `ColumnFilterType` via `columnFilterType(columnType)`. For a concrete column use `columnFilterConditions(column)` (next section) — it also covers existence-only columns.

## Existence-only columns

Since 0.1.139 (needs `@atscript/moost-db` 0.1.132+): `/meta.fields[P]` = `{ filterable: false, filterOps: ["$exists"] }` for a column whose value can't be compared but whose presence can (JSON / array storage on a relational adapter). `createTableDef` copies it to `ColumnDef.filterOps`.

| #   | Rule                                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Built-in filter UIs offer only `null` / `notNull` on it** (column menu, config dialog, filter dialog, filter bar). ≤ 0.1.138: hidden from filtering.                                                                                                           |
| 2   | **Gate custom filter UIs on `isColumnFilterable(column)`, list ops with `columnFilterConditions(column)`** — never on `column.filterable` (value comparison only) or `getFilterableColumns` from `@atscript/ui`.                                                 |
| 3   | **Non-nullable existence-only column → `[]`** (never empty, nothing to offer). `filterOps: ["$geoWithin"]` alone → `[]` (no UI condition).                                                                                                                       |
| 4   | **Use the column-level helpers:** `parseColumnFilterInput(text, col)`, `columnDefaultCondition(col)` — keep typed input and the default inside what the column offers. The type-level `parseFilterInput` / `defaultCondition` don't know existence-only columns. |

### Value coercion in inline input

`parseFilterInput(text, columnType, nullable?)` (and `parseColumnFilterInput(text, column)`) coerces the typed value to the column's JS type: `number` columns get numbers, and since 0.1.133 `boolean` columns understand the `true` / `false` vocabulary (case-insensitive) and produce real booleans, so `false` round-trips through the URL as a boolean and actually matches. Any other text on a boolean column stays a string — the existing "no match" behaviour is unchanged.

## AsFilters component

Renders one `<AsFilterField>` per visible filter path.

| Prop           | Type                  | Notes                                                                                                   |
| -------------- | --------------------- | ------------------------------------------------------------------------------------------------------- |
| `filterFields` | `string[]`            | Override the visible list; defaults to `state.filterFields.value`.                                      |
| `maxVisible`   | `number`              | 0.1.133+. How many fields render inline; the rest overflow. Omitted → all inline (unchanged behaviour). |
| `overflow`     | `'popover' \| 'none'` | 0.1.133+. Default `'popover'` when `maxVisible` is set. `'none'` drops the extra fields entirely.       |

All `$attrs` pass through to each `<AsFilterField>` — including the ones inside the overflow popover.

### Overflow (0.1.133+)

`<AsFilters :max-visible="3" />` renders 3 fields inline plus a **More filters**
trigger (`as-filters-overflow-trigger`, a plain `<button>` with
`aria-label="More filters"`) that opens a Reka `Popover` holding the rest
(`as-filters-overflow`). The trigger badges the count of ACTIVE overflow filters
(`as-filters-overflow-badge`) so a filter narrowing the result set from
off-screen stays discoverable.

| Rule                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The cap is COUNT-based and deterministic — `<AsFilters>` never measures the toolbar. Width-driven responsiveness belongs to the host (feed a smaller `maxVisible` / `filterFields`).                              |
| `<AsFilters>` is a MULTI-ROOT fragment: no wrapper element, no `as-filters` class, no layout of its own. The fields and the trigger are direct children of the host's toolbar row, which is what the host styles. |
| `overflow: 'none'` does NOT clear anything: a filter applied to a dropped field still rides `state.filters` into the query. Only pick it when your app surfaces those fields elsewhere.                           |
| The popover renders the same resolved `controls.filterField` component as the inline row.                                                                                                                         |

Use a separate `<AsFilters>` block in the toolbar to render the chip strip; the "Add filter" affordance is up to the consumer (or use the Filters tab inside `<AsConfigDialog>` — see [state-persistence.md](state-persistence.md)).

## AsFilterField component

Renders the inline filter UI for one column: input + condition selector + delete button. Reads its conditions from `state.filters[column.path]` and writes via `state.setFieldFilter`.

Props (the only required one is `column`):

| Prop     | Type        |
| -------- | ----------- |
| `column` | `ColumnDef` |

Internally delegates value entry to `controls.filterInput` (`AsFilterInput` by default). Override `controls.filterField` to replace the entire shell, or `controls.filterInput` to change just the value editor.

## AsFilterDialog component

Per-column condition builder. Opens when `state.filterDialogColumn.value !== null`; close via `state.closeFilterDialog()`.

Open programmatically:

```typescript
state.openFilterDialog(column);
```

Or from the column-header menu via `<AsColumnMenu>` ("Filter…" item — `columnMenu.filters: true` on `<AsTable>` / `<AsWindowTable>`).

Dialog UI lets the user:

- pick `FilterConditionType` per condition row
- enter the value(s) (one or two for `bw`)
- add/remove condition rows (multiple rows produce the per-field OR/AND fold above)
- apply or cancel

On apply, calls `state.setFieldFilter(column.path, conditions)` once. Cancel does nothing — no in-place edits.

Override via `controls.filterDialog`.

## AsFilterValueHelp

A Tier-3 internal helper. Renders a typeahead / mini-table inside the filter UI for enum columns (`column.options`) or FK columns (`@db.ref`). Resolves enum members or queries the referenced table via `createStaticTableState` (in-memory dataset) for enum, or via the normal table client for FK.

Not directly imported by consumers — `<AsFilterDialog>` / `<AsFilterInput>` mount it automatically when the column type is `enum` or `ref`.

## Date shortcuts

```typescript
import { dateShortcuts } from "@atscript/ui-table";

dateShortcuts(); // → DateShortcut[]
// [
//   { label: "Last 7 Days",  dates: [iso, iso] },
//   { label: "Last 30 Days", dates: [iso, iso] },
//   { label: "Month to Date", dates: [iso, iso] },
//   { label: "Last 90 Days", dates: [iso, iso] },
//   { label: "Last 6 Months", dates: [iso, iso] },
//   { label: "Last 12 Months", dates: [iso, iso] },
//   { label: "Year to Date", dates: [iso, iso] },
// ]
```

Each shortcut maps to a `bw` condition: `{ type: "bw", value: [start, end] }`. Wire from a custom date filter dropdown by calling `state.setFieldFilter(path, [{ type: "bw", value: shortcut.dates }])`.

Optional `now` parameter for tests:

```typescript
dateShortcuts(new Date("2025-06-15"));
```

## Recipes

### Set an initial filter programmatically

```typescript
state.setFieldFilter("status", [{ type: "eq", value: ["active"] }]);
// Watcher reacts; query refires after 500ms debounce.
```

### Set an initial filter through the URL bridge

```typescript
state.applyUrlQuery("status=active"); // overlays the boot baseline (preset/draft/props)
state.applyUrlQuery("status=active&$snapshot"); // exactly this — clears the rest (0.1.139+)
// Or use useTableUrlQuery — see state-persistence.md.
```

### Read current applied filters

```typescript
const f = state.filters.value; // FieldFilters
const count = filledFilterCount(f); // from @atscript/ui-table
```

### Force a filter the user can't remove

Use `<AsTableRoot :force-filters>`:

```vue
<AsTableRoot url="/api/db/tables/orders" :force-filters="{ tenantId: currentTenantId }" />
```

`forceFilters` is a Uniquery `FilterExpr` — see atscript-db skill. AND'd at the top level with user filters; not visible in `state.filters`; not echoed in the URL bridge.

### Replace the filter chip strip

Render your own list, write to `state.filters` directly:

```vue
<button v-for="path in customChipPaths" :key="path" @click="state.removeFieldFilter(path)">
  {{ filterTokenLabel(path, state.filters.value[path] ?? []) }}
</button>
```

`filterTokenLabel(path, conditions, columnLabel?)` from `@atscript/ui-table` returns a one-line summary.

### Clear all applied filters

```typescript
state.resetFilters(); // state.filters = {}
```

This does NOT clear `filterFields` (display) — visible inputs stay. To clear both:

```typescript
state.resetFilters();
state.filterFields.value = [];
```
