Built-in cells, custom cell dispatch, slot API, locale.

## Contents

- [Default cell type map](#default-cell-type-map)
- [Resolution order](#resolution-order)
- [Built-in cell components](#built-in-cell-components)
- [provideCellLocale and useCellLocale](#providecelllocale-and-usecelllocale)
- [Custom cell renderer](#custom-cell-renderer)
- [Per-column slot API on AsTable](#per-column-slot-api-on-astable)
- [Per-cell styling annotations](#per-cell-styling-annotations)

## Default cell type map

| Cell type   | Default component  | Render                                                                                   |
| ----------- | ------------------ | ---------------------------------------------------------------------------------------- |
| `text`      | `AsTableCellValue` | Passthrough via `formatCellValue`.                                                       |
| `enum`      | `AsTableCellValue` | Enum label (lookup `column.options`).                                                    |
| `ref`       | `AsTableCellValue` | FK display label resolved from joined row data.                                          |
| `boolean`   | `AsTableCellValue` | Stringified (locale-aware via `formatCellValue`).                                        |
| `number`    | `AsCellNumber`     | `Intl.NumberFormat` with currency, precision, unit. Right-aligned, tabular-nums.         |
| `date`      | `AsCellDate`       | Date-only via `Intl.DateTimeFormat`.                                                     |
| `datetime`  | `AsCellDate`       | Date + time-of-day. Honours timezone from `useCellLocale`.                               |
| `relative`  | `AsCellDate`       | `formatTimeAgoIntl` ("3 hours ago").                                                     |
| `array`     | `AsCellArray`      | Primitive arrays → chip list; complex arrays → JSON popover.                             |
| `object`    | `AsCellJson`       | JSON tree popover.                                                                       |
| `union`     | `AsCellUnion`      | Per-row dispatcher: primitive / array / object branches; switches subtree per row.       |
| `__actions` | `AsRowActions`     | Synthesized row-actions pseudo-column. See [actions-selection.md](actions-selection.md). |

## Resolution order

1. `@ui.table.component "name"` annotation on the field → `ctx.components[name]`
2. `column.type` → `ctx.types[type]`
3. Fallback → `AsTableCellValue`

```atscript
@db.table 'orders'
export interface Order {
    @ui.table.component 'orderStatusBadge'  // resolves :components.orderStatusBadge
    status: 'pending' | 'shipped' | 'cancelled'

    // No @ui.table.component → resolves :types.number → AsCellNumber
    total: number
}
```

Per invariant 4, `@ui.table.type` is **only** for swapping among built-in renderer ids (e.g. forcing a relative date on a `number` epoch column with `@ui.table.type 'relative'`). Custom cells always go through `@ui.table.component` + the `:components` map.

Resolution is computed once per column via `useCellComponents(() => columns)` and reused for every row in that column.

## Built-in cell components

Every cell component accepts the same minimal contract:

```typescript
defineProps<{
  row: Record<string, unknown>;
  column: ColumnDef;
}>();
```

### AsTableCellValue

`components/defaults/as-table-cell-value.vue`. Passthrough via `formatCellValue(getCellValue(row, column.path), column.type)`. Adds `as-cell-number` class for numeric columns so the alignment shortcut applies.

### AsCellNumber

`components/defaults/as-cell-number.vue`. Locale-aware decimal formatter. Reads:

| Source                  | Annotation                                | Field on `ColumnDef`        |
| ----------------------- | ----------------------------------------- | --------------------------- |
| Locale                  | `useCellLocale().locale`                  | —                           |
| Currency code (fixed)   | `@db.amount.currency 'USD'`               | `currencyCode`              |
| Currency code (per-row) | `@db.amount.currency.ref 'currencyField'` | `currencyRefField`          |
| Unit (fixed / per-row)  | `@db.unit 'kg'` / `@db.unit.ref 'unit'`   | `unitCode` / `unitRefField` |
| Precision scale         | `@db.column.precision 2`                  | `precisionScale`            |

Money branch wins over precision (CLDR currency fraction digits beat static config). Non-finite raw values render the source string so malformed decimals stay visible. Internally delegates to `formatDecimalForDisplay` from `@atscript/ui`.

### AsCellDate

`components/defaults/as-cell-date.vue`. Three sub-modes based on `column.type`:

- `date` → `{ year: "numeric", month: "short", day: "2-digit" }`
- `datetime` → adds `{ hour: "2-digit", minute: "2-digit" }`
- `relative` → `formatTimeAgoIntl` from `@vueuse/core`

Reads timezone from `useCellLocale().timezone` (omitted → browser default). `title` attribute always carries the canonical ISO string for e2e tests.

### AsCellArray

`components/defaults/as-cell-array.vue`. Branches on element type:

- Empty array → empty cell.
- All primitive elements → chip list `<span class="as-cell-chips">`.
- Any complex element → `<AsCellJsonPopover>` with `[N]` count.

### AsCellJson

`components/defaults/as-cell-json.vue`. Object → JSON tree popover via `<AsCellJsonPopover>`. Non-object values render empty (use `AsTableCellValue` for those).

### AsCellUnion

`components/defaults/as-cell-union.vue`. Per-row dispatcher: inspects `getCellValue(row, column.path)`, picks one of `array-chips` / `array-json` / `array-empty` / `object` / `primitive`, and renders the matching sub-component. Use for fields whose `.as` type is a union of disparate shapes.

### AsRowActions

`components/defaults/as-row-actions.vue`. Renders either:

- 0 actions → empty `<td>` (placeholder for `table-layout: fixed`).
- 1 action → single labelled / icon button.
- ≥2 actions → `…` dropdown via `<AsActionMenuContent>`.

Reads `state.actions.cellRow` (pre-flattened `[default?, ...others.row, ...rows]`). Per-row availability gate via `applyRowGate` — actions disabled by the server (per-row `$actions: string[]`) are hidden. See [actions-selection.md](actions-selection.md).

## provideCellLocale and useCellLocale

```typescript
import { provideCellLocale } from "@atscript/vue-table";

provideCellLocale(() => ({
  language: "en-US", // BCP-47, drives Intl.* formatters
  timezone: "America/New_York", // IANA, or undefined / "system" → browser TZ
}));
```

Accepts `MaybeRefOrGetter<CellLocale | undefined>`. Reactive — flipping the source updates cell formatting live.

```typescript
import { useCellLocale } from "@atscript/vue-table";

const { locale, timezone } = useCellLocale();
// locale.value : ComputedRef<string>  (falls back to navigator.language → "en-US")
// timezone.value : ComputedRef<string | undefined>
```

Fallback resolution when no provider:

- `locale` → `navigator.language` → `"en-US"`.
- `timezone` → `undefined` (Intl picks the browser TZ).
- `"system"` is treated as `undefined` (avoids `Intl.DateTimeFormat` throw on a non-IANA name).

Pair with `useAppPrefs` to wire from the user's `appConf`:

```typescript
const { prefs } = useAppPrefs({ url: "/api/db/_presets" });
provideCellLocale(() => ({
  language: prefs.value.language,
  timezone: prefs.value.timezone,
}));
```

Cross-link: [state-persistence.md](state-persistence.md) for `useAppPrefs`.

## Custom cell renderer

Component contract:

```vue
<script setup lang="ts">
import type { ColumnDef } from "@atscript/ui";
import { getCellValue } from "@atscript/vue-table";

const props = defineProps<{
  row: Record<string, unknown>;
  column: ColumnDef;
}>();

const value = computed(() => getCellValue(props.row, props.column.path));
</script>

<template>
  <td :class="['as-cell-status', `status-${value}`]">{{ value }}</td>
</template>
```

Wire via the `:components` map (named, per-field):

```vue
<script setup>
import StatusBadgeCell from "./StatusBadgeCell.vue";

const components = {
  statusBadge: StatusBadgeCell,
};
</script>

<template>
  <AsTableRoot :components="components" ... />
</template>
```

Annotate the field:

```atscript
@ui.table.component 'statusBadge'
status: 'pending' | 'shipped' | 'cancelled'
```

Or wire via the `:types` map (cell-type-wide):

```vue
<script setup>
import { createDefaultCellTypes } from "@atscript/vue-table";
import MyEnumCell from "./MyEnumCell.vue";

const types = { ...createDefaultCellTypes(), enum: MyEnumCell };
</script>

<template>
  <AsTableRoot :types="types" ... />
</template>
```

Use `getCellValue(row, column.path)` for nested-path support (`"address.city"` etc.). Use `formatCellValue(value, type)` for the default string-coercion behaviour.

For numeric cells, prefer composing with `useCellLocale()` + `formatDecimalForDisplay` from `@atscript/ui` so currency / precision / unit annotations keep working.

## Per-column slot API on AsTable

`<AsTable>` / `<AsWindowTable>` forward named slots from the consumer through `<AsTableBase>`:

| Slot name           | Slot props                                   | Replaces                                                           |
| ------------------- | -------------------------------------------- | ------------------------------------------------------------------ |
| `#header-<colPath>` | `{ column, sorters, multiIndex, direction }` | The default `<th>` content for that column.                        |
| `#cell-<colPath>`   | `{ row, column, value, rowIndex }`           | The default `<td>` content for that column (one row).              |
| `#empty`            | `{ filters, searchTerm, clearFilters }`      | Empty-state body when results are empty.                           |
| `#query-loading`    | —                                            | Spinner / skeleton during fetch (default is a small icon overlay). |
| `#error`            | `{ error, kind, retry }`                     | Error-state body.                                                  |
| `#last-row`         | —                                            | Pseudo-row rendered after the last data row (footer / totals).     |

Slot scope-name uses the column path verbatim (dots included): `<template #cell-address.city="...">`. Slots win over the cell-component dispatch for matched columns.

## Per-cell styling annotations

Static annotations (resolved once per column, cached):

| Annotation                       | Effect                                               |
| -------------------------------- | ---------------------------------------------------- |
| `@ui.table.classes "name"`       | Add CSS class. Repeatable.                           |
| `@ui.table.styles "color: red"`  | Inline style.                                        |
| `@ui.table.attr "title", "hint"` | HTML attribute. Repeatable; key/value pairs.         |
| `@ui.table.width "8em"`          | Default column width (rendered if not user-resized). |

Dynamic variants (per-cell, require `@atscript/ui-fns`):

| Annotation                                                    | Type signature                                                |
| ------------------------------------------------------------- | ------------------------------------------------------------- |
| `@ui.table.fn.classes 'row.foo > 10 ? "hot" : "cold"'`        | `(row, ctx) => string \| string[] \| Record<string, boolean>` |
| `@ui.table.fn.styles 'row.bg ? `background: ${row.bg}` : ""'` | `(row, ctx) => string \| Record<string, unknown>`             |
| `@ui.table.fn.attr 'title', 'row.tooltip'`                    | `(row, ctx) => string`. Repeatable per attribute name.        |

Function expressions run inside a sandbox built from `useCellResolver`'s `scope`:

```typescript
{
  row,
  ctx: {
    searchTerm,
    filters,
    sorters,
    rowIndex,
  },
}
```

Available variables: `row.<field>` (current row), `ctx.searchTerm`, `ctx.filters`, `ctx.sorters`, `ctx.rowIndex`. The resolver is opt-in — cells with no annotations skip the per-cell `v-bind` entirely. Static-only columns reuse a cached object.

```atscript
@db.table 'orders'
export interface Order {
    @ui.table.fn.classes 'row.status === "cancelled" ? "as-row-cancelled" : ""'
    status: string

    @ui.table.fn.attr 'data-row-state', 'row.archived ? "archived" : "active"'
    name: string
}
```

`@ui.table.fn.*` requires installing `@atscript/ui-fns` and wiring it as the `FieldResolver` — see the atscript-ui-styles skill for the runtime setup. Without it, dynamic annotations are silently ignored.
