---
outline: deep
---

# Cells

Every visible column in `<AsTable>` resolves to a Vue component. The
resolver picks one of the built-in cells based on the column's
`.as`-derived metadata, or honours an explicit named override. Apps
override individual cells without forking the table.

## Default cell-type map

`createDefaultCellTypes()` returns a fresh, mutable map seeded with
every built-in. Spread it to add or replace entries:

```ts
import { createDefaultCellTypes } from "@atscript/vue-table";

const types = {
  ...createDefaultCellTypes(),
  rating: MyRatingCell,
};
```

The seeded entries:

| Column type                      | Component          |
| -------------------------------- | ------------------ |
| `text`, `boolean`, `enum`, `ref` | `AsTableCellValue` |
| `number`                         | `AsCellNumber`     |
| `date`, `datetime`, `relative`   | `AsCellDate`       |
| `array`                          | `AsCellArray`      |
| `object`                         | `AsCellJson`       |
| `union`                          | `AsCellUnion`      |
| `__actions` (synthesised pseudo) | `AsRowActions`     |

Every built-in cell is also importable individually via its kebab
subpath (e.g. `import AsCellDate from "@atscript/vue-table/as-cell-date"`)
when you'd rather hand-pick entries than spread the full default map.

Pass the map to the table root:

```vue
<AsTableRoot url="/db/products" :types="types" />
```

## Resolution rules

`useCellComponents()` runs once per column on mount and on every
TableDef change. The order matches `<AsField>` in vue-form:

1. `@ui.table.component "name"` on the field → `ctx.components[name]`.
2. Column `type` (`text`, `number`, …) → `ctx.types[type]`.
3. Fallback → `AsTableCellValue`.

The lookup happens per-column, not per-row — a 50×10 table avoids
about 500 redundant resolutions per render. Named overrides win
because they're explicit; type-map overrides cover whole categories
(every `date` column or every `number` column) without touching the
`.as`.

## Built-in cells

Every cell receives the same two props:

```ts
defineProps<{
  row: Record<string, unknown>;
  column: ColumnDef;
}>();
```

The cell uses `getCellValue(row, column.path)` to walk the dotted
path. Per-cell class / style / attribute annotations are applied by
the resolver before the cell mounts — your cell doesn't read them.

### `AsTableCellValue`

The default for scalar types (`text`, `boolean`, `enum`, `ref`).
Renders the raw value through `formatCellValue(value, type)`:
booleans become `Yes` / `No`, nullish values render as empty. Adds
`as-cell-number` when the column happens to be numeric so right
alignment kicks in.

### `AsCellNumber`

Locale-formatted, right-aligned, tabular-nums. Reads four pieces of
`.as` metadata off `column`:

- `@db.amount.currency 'USD'` → `column.currencyCode`. Wins over
  precision; `Intl.NumberFormat` derives the fraction digits from
  CLDR.
- `@db.amount.currency.ref 'currency'` → `column.currencyRefField`.
  Per-row currency code; the cell reads `row[refField]`.
- `@db.column.precision 4` → `column.precisionScale`. Static fraction
  digits when no currency is set.
- `@db.unit 'kg'` / `@db.unit.ref 'unit'` → `column.unitCode` /
  `column.unitRefField`. Renders as `Intl.NumberFormat({ style:
"unit", unit })`.

Shares `formatDecimalForDisplay` with `<AsNumber>` so form input and
table cell render identically.

### `AsCellDate`

Locale-and-timezone aware. The column type picks the format:

- `date` → `{ year, month: 'short', day: '2-digit' }`
- `datetime` → adds `{ hour: '2-digit', minute: '2-digit' }`
- `relative` → `formatTimeAgoIntl(value)` (e.g. `3 hours ago`).

Null-like values (`null` / `undefined` / `""`) and the Unix-epoch
sentinel (timestamp `0`) render as blank cells.

The cell always stamps `title` with the absolute ISO string so e2e
tests can assert the canonical timestamp regardless of locale.

### `AsCellArray`

Comma-separated chips when every element is primitive; a popover
button with a JSON tree when at least one element is a non-primitive.
Empty arrays render as blank.

### `AsCellJson`

Button glyph (`{}`) opens a popover that pretty-prints the object as
a JSON tree. Used for free-form `@db.json` columns.

### `AsCellUnion`

Dispatches by runtime shape — primitive → text, object → JSON
popover, array of primitives → chips, array of objects → JSON
popover. Useful for tagged-union columns where each variant renders
differently per row.

## App-wide locale

The cell suite reads two values via provide / inject: a BCP-47
language tag and an IANA timezone. Pipe them in once at the app root
and every cell picks them up:

```vue
<script setup lang="ts">
import { provideCellLocale, useAppPrefs } from "@atscript/vue-table";
const { prefs } = useAppPrefs({ url: "/api/db/_presets" });
provideCellLocale(() => ({
  language: prefs.value.language,
  timezone: prefs.value.timezone,
}));
</script>
```

`provideCellLocale` accepts a `MaybeRefOrGetter<CellLocale>`, so a
getter closing over reactive state recomputes on every change.
Without a provider, `useCellLocale` falls back to `navigator.language`
and the browser's resolved timezone.

## Adding a custom cell renderer

Two-step: tag the field with `@ui.table.component`, then register the
component in the `:components` map. `@ui.table.component` is the
dedicated mechanism for hand-rolled cells — `@ui.table.type` (and the
cross-cutting `@ui.type`) is reserved for the built-in renderer ids
above.

```atscript
@meta.label 'Rating'
@ui.table.component 'rating'
rating: number
```

```ts
import MyRatingCell from "./cells/rating.vue";

const components = { rating: MyRatingCell };
```

Pass it through `<AsTableRoot :components="components">` (or the
controls/options object that consumes it).

:::tip Convention

- `:types` map — **built-in** cell renderer ids (`text`, `number`,
  `date`, `array`, …). Touched by `@ui.table.type` / `@ui.type`.
- `:components` map — your custom cells. Touched by
  `@ui.table.component`.

The TS type for the cells map is `TAsCellTypeComponents`, exported
from `@atscript/vue-table`. It declares every built-in slot plus an
open `Record<string, Component>` index — but reserve that open slot
for renderers you genuinely want to dispatch by _type id_ across many
fields (e.g. a project-wide `currency` cell). One-off cells belong in
`:components`.
:::

## Next steps

- [Custom Cells](/tables/custom-cells) — write your own cell, or use
  a per-column slot.
- [Customization](/tables/customization) — swap dialogs, header
  cells, row actions, the column menu.
