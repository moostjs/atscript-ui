---
outline: deep
---

# Custom Cells

Three ways to render a column differently from the default:

1. **Slot** — quick per-table override via `<template #cell-{path}>`.
2. **Type swap** — replace every cell of one `type` for one table.
3. **Named component** — opt-in per column with
   `@ui.table.component`, swap it via the `:components` map.

The first is template-local. The second and third reuse a component
across every table that opts in.

## The cell contract

Every cell component receives exactly two props:

```ts
import type { ColumnDef } from "@atscript/ui";

defineProps<{
  row: Record<string, unknown>;
  column: ColumnDef;
}>();
```

`row` is the raw row object from the server. `column` is the
runtime column descriptor — type, label, path, precision, currency
ref, etc.

The cell uses `getCellValue(row, column.path)` to walk the dotted
path:

```vue
<script setup lang="ts">
import { computed } from "vue";
import { getCellValue } from "@atscript/vue-table";
import type { ColumnDef } from "@atscript/ui";

const props = defineProps<{
  row: Record<string, unknown>;
  column: ColumnDef;
}>();

const value = computed(() => getCellValue(props.row, props.column.path));
</script>

<template>
  <td>{{ value }}</td>
</template>
```

Render a `<td>`. The cell sits inside a `<tr>` rendered by `<AsTable>`
— it owns the row, not the cell. Set classes / styles directly on
the `<td>` you emit.

::: warning Annotation-driven bindings
`@ui.table.classes`, `@ui.table.styles`, `@ui.table.attr`, and their
`fn.*` variants are applied automatically by the per-cell resolver
(`useCellResolver`) before the cell mounts. Your custom cell doesn't
need to read them — they v-bind onto the cell's `<td>` outer element
via the parent's `<component :is="..." v-bind="cellBindings">`.
:::

The type for cell-type maps is `TAsCellTypeComponents`:

```ts
import type { TAsCellTypeComponents } from "@atscript/vue-table";

const types: TAsCellTypeComponents = {
  ...createDefaultCellTypes(),
  rating: MyRatingCell,
};
```

## Pattern A — type swap

Replace every cell of one type for one table. Useful when an entire
project standardises on a richer renderer (your own date picker,
your own currency formatter).

```ts
import { createDefaultCellTypes } from "@atscript/vue-table";
import MyDateCell from "./cells/MyDateCell.vue";

const types = { ...createDefaultCellTypes(), date: MyDateCell, datetime: MyDateCell };
```

```vue
<AsTableRoot url="/db/orders" :types="types" />
```

Every `date` and `datetime` column on this table renders through
`MyDateCell`.

## Pattern B — named per-column override

`@ui.table.component` tags a single field; the table looks it up in
the `:components` map. Other columns of the same type stay on the
default.

```atscript
@db.table 'products'
export interface Product {
    @meta.id id: string

    @meta.label 'Status'
    @ui.table.component 'statusBadge'
    status: 'active' | 'archived' | 'pending'
}
```

```ts
import StatusBadgeCell from "./cells/StatusBadgeCell.vue";

const components = { statusBadge: StatusBadgeCell };
```

```vue
<AsTableRoot url="/db/products" :components="components" />
```

The resolver tries named lookup first, falls back to type lookup,
then `AsTableCellValue`. Tagging more fields with
`@ui.table.component 'statusBadge'` reuses the same renderer.

## Pattern C — slot

The fastest override is a slot on the table. No `.as` change, no
component file — just inline template per column:

```vue
<AsTable>
  <template #cell-price="{ value }">
    <td class="text-right tabular-nums">${{ Number(value).toFixed(2) }}</td>
  </template>

  <template #cell-inStock="{ value }">
    <td>
      <span :class="['as-status-badge', value ? 'scope-good' : 'scope-error']">
        {{ value ? "In Stock" : "Out of Stock" }}
      </span>
    </td>
  </template>
</AsTable>
```

`<AsTable>` exposes one slot per column path plus four global slots:

- `#header-<path>` — replace the `<th>`.
- `#cell-<path>` — replace the `<td>`.
- `#empty` — body when results are empty.
- `#query-loading` — overlay while a fetch is in flight.
- `#error` — body when the last query failed (receives `{ error }`).

Pick a slot when the override is one-off and template-local. Pick a
component swap (Pattern A or B) when the cell repeats across tables.

## Worked example: status badge

A reusable cell that paints a coloured pill using the `scope-good` /
`scope-error` tokens from vunor's shortcuts engine. Works on any
column whose value is a discriminator string.

```vue
<!-- cells/StatusBadgeCell.vue -->
<script setup lang="ts">
import { computed } from "vue";
import { getCellValue } from "@atscript/vue-table";
import type { ColumnDef } from "@atscript/ui";

const props = defineProps<{
  row: Record<string, unknown>;
  column: ColumnDef;
}>();

const value = computed(() => getCellValue(props.row, props.column.path));

const scope = computed(() => {
  switch (value.value) {
    case "active":
    case "shipped":
      return "scope-good";
    case "archived":
    case "cancelled":
      return "scope-error";
    case "pending":
      return "scope-attention";
    default:
      return "scope-neutral";
  }
});
</script>

<template>
  <td>
    <span class="as-status-badge" :class="scope">{{ value }}</span>
  </td>
</template>
```

Add the matching shortcut to ui-styles (or your own UnoCSS preset)
so the class compiles:

```ts
defineShortcuts({
  "as-status-badge": "inline-flex items-center px-$s py-$xxs text-callout rounded-base c8-light",
});
```

Wire it on the `.as`:

```atscript
@db.table 'orders'
export interface Order {
    @meta.id id: string

    @meta.label 'Status'
    @ui.table.component 'statusBadge'
    status: 'pending' | 'shipped' | 'cancelled'
}
```

And on the Vue mount:

```ts
import StatusBadgeCell from "./cells/StatusBadgeCell.vue";

const components = { statusBadge: StatusBadgeCell };
```

```vue
<AsTableRoot url="/db/orders" :components="components" />
```

Every order row now shows a coloured status pill; the rest of the
table stays on the default renderers.

## Next steps

- [Cells](/tables/cells) — the built-in cell library and locale
  provider.
- [Customization](/tables/customization) — swap dialogs, headers,
  row actions, the column menu.
