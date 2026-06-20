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

## Fetching sibling fields a cell needs

A custom cell can only read fields that are present in the row object —
and that object is exactly the **visible** columns. The table projects
just the displayed columns into `$select`, so if your cell tries to
composite a sibling field that isn't its own column, that field is
absent from `row` and the cell renders blank.

The classic case is an **identity cell**: a single `username` column
that paints an avatar plus a formatted "First Last". The `avatar`,
`firstName`, and `lastName` fields are never columns of their own — but
the cell needs all three to render.

### Per-column deps — `@ui.table.selectWith`

Co-locate `@ui.table.selectWith 'field'` on the field your cell
renders. Each annotation names one sibling **leaf** field path to also
fetch whenever the owning column is displayed; repeat it once per extra
field. The extra fields ride along in the row payload but are never
rendered as columns, never toggleable, and never appear in the config
dialog.

```atscript
@db.table 'users'
export interface UsersTable {
    @meta.id id: string

    @meta.label 'User'
    @ui.table.component 'identity'
    @ui.table.selectWith 'avatar'
    @ui.table.selectWith 'firstName'
    @ui.table.selectWith 'lastName'
    username: string

    @ui.table.exclude
    avatar: string

    @ui.table.exclude
    firstName: string

    @ui.table.exclude
    lastName: string
}
```

The `identity` cell now reads `avatar` / `firstName` / `lastName`
straight off `row`:

```vue
<!-- cells/IdentityCell.vue -->
<script setup lang="ts">
import { computed } from "vue";
import { getCellValue } from "@atscript/vue-table";
import type { ColumnDef } from "@atscript/ui";

const props = defineProps<{
  row: Record<string, unknown>;
  column: ColumnDef;
}>();

const avatar = computed(() => getCellValue(props.row, "avatar"));
const name = computed(
  () => `${getCellValue(props.row, "firstName")} ${getCellValue(props.row, "lastName")}`,
);
</script>

<template>
  <td>
    <img :src="String(avatar)" class="as-identity-avatar" alt="" />
    <span>{{ name }}</span>
  </td>
</template>
```

The deps are harvested from the visible columns: they ride **only**
while `username` is displayed, and disappear if the user toggles that
column off. `@ui.table.exclude` removes `avatar` / `firstName` /
`lastName` from the table entirely — they never become columns, can't
be added from the config dialog, and aren't filterable or sortable —
while `@ui.table.selectWith` still pulls their data into the payload so
the cell can read them.

### Renderless renderers — `alwaysSelected`

When you skip `ColumnDef` entirely — a fully custom renderer built on
`<AsTableRoot>`'s default slot — there's no column to hang
`@ui.table.selectWith` on. Use the table-level `alwaysSelected` prop to
add leaf paths to `$select` unconditionally, regardless of which
columns are visible:

```vue
<AsTableRoot url="/db/users" :always-selected="['avatar', 'firstName', 'lastName']">
  <template #default="{ results }">
    <article v-for="row in results" :key="String(row.id)" class="as-user-card">
      <img :src="String(row.avatar)" alt="" />
      <span>{{ row.firstName }} {{ row.lastName }}</span>
    </article>
  </template>
</AsTableRoot>
```

`alwaysSelected` is additive — it only unions extra paths into the
projection; it never restricts or removes anything. (Same option is
available on `useTable()`'s query options.)

### DOs and DON'Ts

- **DO** co-locate per-column deps with `@ui.table.selectWith` — they
  ride exactly when the owning column is visible.
- **DO** reach for `alwaysSelected` when a renderless / default-slot
  renderer needs fields unconditionally, with no column to attach deps
  to.
- **DON'T** use either for a number cell's currency or unit sibling
  (`@db.amount.currency.ref` / `@db.unit.ref`). moost-db already
  includes those server-side whenever the amount is projected — they
  ride for free.
- **DON'T** expect the extra fields to surface as columns, appear in the
  config dialog, or ride while the owning column is hidden. Need them
  unconditionally? Use `alwaysSelected`.

Both sources degrade gracefully: a declared dep that the (possibly
access-narrowed) metadata doesn't expose — e.g. a field removed by
server-side access control for the current user — is silently dropped
rather than requested, so projecting a field the user can't see never
errors.

See the [Annotations Reference](/tables/annotations) for the
`@ui.table.selectWith` row and [@atscript/vue-table](/api/vue-table)
for the `alwaysSelected` prop signature.

## Next steps

- [Cells](/tables/cells) — the built-in cell library and locale
  provider.
- [Customization](/tables/customization) — swap dialogs, headers,
  row actions, the column menu.
