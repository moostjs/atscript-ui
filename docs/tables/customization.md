---
outline: deep
---

# Customization

Three layers of override, from coarse to fine:

1. **Slot** — replace one cell or one header on one table.
2. **`:types`** — replace every cell of one cell type for one
   table.
3. **`:components`** + `@ui.table.component` — replace one named
   cell, reusable across tables.
4. **`:controls`** — replace dialogs, header chrome, row-action
   menu, column menu, preset picker.

Slots are fast and local. Maps are reusable and apply per-table.
Pick the smallest layer that does the job.

## Slots

`<AsTable>` exposes per-column slots plus a handful of globals:

| Slot                | Payload                  | Renders                            |
| ------------------- | ------------------------ | ---------------------------------- |
| `#header-<colPath>` | `{ column }`             | The `<th>` for that column         |
| `#cell-<colPath>`   | `{ value, row, column }` | The `<td>` for that column         |
| `#empty`            | —                        | Body when results are empty        |
| `#query-loading`    | —                        | Overlay while a query is in flight |
| `#error`            | `{ error }`              | Body when the last query failed    |
| `#last-row`         | —                        | Pseudo-row after the last data row |

```vue
<AsTable>
  <template #header-name="{ column }">
    <th class="min-w-[15em]">
      <span class="scope-primary font-700 text-current-hl">{{ column.label }}</span>
    </th>
  </template>

  <template #cell-price="{ value }">
    <td class="text-right tabular-nums">${{ Number(value).toFixed(2) }}</td>
  </template>

  <template #empty>
    <div class="p-$xxl text-center text-current/60">
      <p class="text-body-l mb-$s">No rows</p>
      <p class="text-body">Try adjusting your filters</p>
    </div>
  </template>

  <template #error="{ error }">
    <div class="scope-error p-$xxl text-center text-current-hl">
      <p class="font-600">Something went wrong</p>
      <p class="mt-$xs">{{ error.message }}</p>
    </div>
  </template>
</AsTable>
```

A `#header-<colPath>` slot also renders for the synthesised
`__actions` column, whose default header is deliberately blank — pass
the slot when that gutter needs a label. The column stays locked
(no drag-reorder, no resize) either way. Since 0.1.133.

## Row hooks

Three optional props on `<AsTable>` and `<AsWindowTable>` decorate or
gate the row element, without a slot. Each receives
`(row, { index, selected })` — in windowed mode `index` is the
absolute row index. Since 0.1.133.

| Prop              | Returns                                         | Effect                                                                         |
| ----------------- | ----------------------------------------------- | ------------------------------------------------------------------------------ |
| `:row-selectable` | `boolean \| string`                             | `false`/string ⇒ the row is not selectable (the string is the disabled reason) |
| `:row-class`      | `string \| string[] \| Record<string, boolean>` | Extra classes on the `<tr>`                                                    |
| `:row-attrs`      | `Record<string, unknown>`                       | Extra attributes on the `<tr>`                                                 |

```vue
<AsTable
  select="multi"
  :row-selectable="(row) => (row.archived ? 'Archived rows cannot be picked' : true)"
  :row-class="(row) => ({ 'opacity-60': row.archived })"
  :row-attrs="(row) => ({ 'data-status': row.status })"
/>
```

`:row-attrs` can decorate a row but never rewrite its accessibility
contract: the framework's own `id`, `role`, `aria-*`, `data-*`,
`class` and `style` always win. Use `:row-class` for classes.

See [Actions & Selection](./actions.md#per-row-selectability) for how
`:row-selectable` gates click, keyboard and select-all. The rule lives
in the selection model, not in the renderer, so both table components
enforce it identically.

`<AsTableRoot>` exposes additional top-level slots — its default
`v-slot` receives the full table-state surface so the page chrome
(toolbar, pagination, filter bar) reads from one source: `tableDef`,
`loadingMetadata`, `metadataError`, `allColumns`, `columnNames`,
`columnWidths`, `columns`, `filterFields`, `filters`, `sorters`,
`results`, `querying`, `queryingNext`, `totalCount`, `loadedCount`,
`pagination`, `queryError`, `mustRefresh`, `searchTerm`, `selectedRows`,
`selectedCount`, `navBridge`, `query`, `queryNext`, `resetFilters`,
`showConfigDialog`, `openFilterDialog`, `closeFilterDialog`,
`setFieldFilter`, `removeFieldFilter`, `addFilterField`,
`removeFilterField`, `actions`, `prompt`.

## Display-only columns

Columns come from `/meta`. When a screen needs a column the server has
no field for — a derived value, a count, a link, a widget — declare it
with `:display-columns` on `<AsTableRoot>`. Since 0.1.134.

```vue
<AsTableRoot
  url="/api/db/tables/orders"
  :display-columns="[
    { key: 'margin', label: 'Margin', width: '7em', order: 5 },
    { key: 'actions', label: 'Links', component: 'orderLinks' },
  ]"
>
  <AsTable>
    <template #cell-margin="{ row }">{{ marginOf(row) }}</template>
  </AsTable>
</AsTableRoot>
```

A display column is a **real column** everywhere it matters: it has a
label, a width, a position, it appears in the config dialog (badged
`client`), it can be hidden and reordered, and presets store its
visibility and order like any other column. What it never does is reach
the backend — it is excluded from `$select`, from server sorting and
from filters.

| Field       | Meaning                                                                                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key`       | Stable key; becomes the column's `path`, so `cell-<key>` / `header-<key>` slots, the `columnNames` model and presets refer to it. Must not collide with a field path. |
| `label`     | Header label.                                                                                                                                                         |
| `width`     | Default width (any CSS length).                                                                                                                                       |
| `order`     | Position among the server columns (lower = earlier). Appended when omitted.                                                                                           |
| `sortable`  | `'local'` to offer sorting, applied client-side over the loaded page. Unsortable otherwise.                                                                           |
| `sortValue` | The value `sortable: 'local'` orders by. Without it the sorter reads `row[key]`.                                                                                      |
| `component` | Named cell component, looked up in `:components`.                                                                                                                     |
| `type`      | Cell type for the `:types` dispatch. Default `"text"`.                                                                                                                |

Cells render through the normal dispatch — a `#cell-<key>` slot, a
`component` name, or a `type` — exactly like a server column. See
[Cells](/tables/cells#display-only-columns).

### `sortable: 'local'`

Sorting a display column is **page-local**: the framework can only order
the rows it has loaded. By default it sorts on `row[key]` — which a
display column has no reason to carry — so tell it what to order by:

```vue
<AsTableRoot
  url="/api/db/tables/orders"
  :display-columns="[
    { key: 'margin', label: 'Margin', sortable: 'local', sortValue: (row) => marginOf(row) },
  ]"
/>
```

Without `sortValue` the sorter reads `row[key]`, which only works when
the value really is in the payload but not rendered as a server column
(pull it in with `:always-selected`). Leave `sortable` off when neither
holds.

The page is sorted by the **whole** sorter list, not just the local
part: a server sorter the page is already ordered by stays in force, and
the local sorter takes effect at its own priority. So
`[name asc, margin asc]` orders by name and breaks ties by margin, while
`[margin asc, name asc]` re-orders the page.

An in-memory table (`<AsTableRoot :rows>`) does better than page-local:
it sorts the whole dataset in its query function before slicing a page
out of it, so a display column with `sortValue` orders **every** row,
not just the visible one. That holds in `<AsWindowTable>` too — every
absolute index the window asks for already arrives in place.

Behind a **server** fetcher, `<AsWindowTable>` is the one place local
sorting is unavailable: it caches rows by absolute index and drops them
as the viewport moves, so there is no page to re-order and the ordering
would shift under the user as they scrolled. The sort affordance for a
display column is withheld there, in the header and in the config dialog
alike. One rule decides it for both — `state.localSortAvailable`. Since
0.1.135 the exclusion is scoped to the server case; before it, in-memory
window tables were caught by it too.

An unknown key in a stored preset is ignored, so removing a display
column later doesn't break saved views.

## Cell-type map (`:types`)

Replace whole categories per table. The map is keyed by column
`type` (`text`, `number`, `date`, …). Use
`createDefaultCellTypes()` for a fresh seeded map and spread to
override:

```ts
import { createDefaultCellTypes } from "@atscript/vue-table";
import MyDateCell from "./cells/MyDateCell.vue";

const types = {
  ...createDefaultCellTypes(),
  date: MyDateCell,
  datetime: MyDateCell,
};
```

```vue
<AsTableRoot :types="types" url="/db/orders" />
```

The TS type is `TAsCellTypeComponents`. See [Custom Cells](/tables/custom-cells)
for the per-cell contract.

## Named cell (`:components`)

Tag a column with `@ui.table.component "name"` and pass the
component in the `:components` map:

```atscript
@ui.table.component 'statusBadge'
status: 'open' | 'shipped' | 'cancelled'
```

```ts
const components = { statusBadge: StatusBadgeCell };
```

Named wins over type-map; useful when only one column wants a
different renderer.

## Controls map (`:controls`)

The chrome map. Replace any of the table's Tier-2 dialogs / header
parts / row action menu. Pass **only the entries you replace** — every
slot falls back to its built-in internally, so spreading
`createDefaultControls()` is redundant and statically bundles (and
eager-mounts) the dialogs you didn't touch:

```ts
import MyConfigDialog from "./MyConfigDialog.vue";
import MyRowActions from "./MyRowActions.vue";

const controls = {
  configDialog: MyConfigDialog,
  rowActions: MyRowActions,
};
```

```vue
<AsTableRoot :controls="controls" url="/db/orders" />
```

The full `TAsTableControls` shape:

| Key                | Default             | Purpose                                    |
| ------------------ | ------------------- | ------------------------------------------ |
| `headerCell`       | `AsTableHeaderCell` | One `<th>` per column                      |
| `columnMenu`       | `AsColumnMenu`      | Dropdown menu on column headers            |
| `rowActions`       | `AsRowActions`      | Per-row action button / dropdown           |
| `filterInput`      | `AsFilterInput`     | Editable filter pill in the filter bar     |
| `filterDialog`     | `AsFilterDialog`    | Per-column filter dialog                   |
| `filterField`      | `AsFilterField`     | One filter field row inside the filter bar |
| `filterValueHelp`  | (lazy)              | Value-help dialog (`?` lookups)            |
| `configDialog`     | `AsConfigDialog`    | Three-tab settings dialog                  |
| `fieldsSelector`   | (lazy)              | Inner column / filter list                 |
| `sortersConfig`    | (lazy)              | Inner sorters list                         |
| `confirmDialog`    | `AsConfirmDialog`   | In-app `state.prompt()` dialog             |
| `actionFormDialog` | (lazy)              | Wraps `<AsForm>` for `@InputForm` actions  |
| `presetDialog`     | `AsPresetDialog`    | Rename / delete / publish / favorite       |

The preset **picker** is not a control — `<AsPresetPicker>` is a
Tier-1 component you mount (or don't) in your own toolbar markup.

The table root bundles and mounts the dialogs lazily — only when
needed (the dialog first opens, an action declares an `@InputForm`, a
filter input opens a value-help, etc.). Supplying a dialog in
`controls` opts it into **eager** bundling and mounting, so pass only
the dialogs you actually replace. The same applies if you want to
eager-load a built-in dialog deliberately:

```ts
import AsActionFormDialog from "@atscript/vue-table/as-action-form-dialog";

const controls = { actionFormDialog: AsActionFormDialog };
```

`AsActionFormDialog` pulls in the full `@atscript/vue-form` runtime,
so the main entry doesn't export it — import the dedicated subpath
above when you need to override or eager-load.

::: tip Bundle impact
Lazy controls download on first open; assigning any `controls.X` makes
that dialog eager. After replacing a default, shed its now-unused styles
with `excludeComponents` — see [Bundle Optimization](/guide/bundle-optimization).
:::

## Worked example: design-system row actions

A common need: the project's design system has its own buttons,
icons, and dropdown menu chrome. We swap `rowActions` while letting
the table own the action invocation.

```vue
<!-- DesignSystemRowActions.vue -->
<script setup lang="ts">
import { computed } from "vue";
import { useTableContext } from "@atscript/vue-table";
import type { TVueTableActionInfo } from "@atscript/vue-table";
import { DsButton, DsMenu, DsMenuItem } from "@my-org/design-system";

const props = defineProps<{
  row: Record<string, unknown>;
  column: { type: "__actions" };
}>();

const { state } = useTableContext();
const actions = computed(() => state.actions.cellRow);

function onClick(action: TVueTableActionInfo) {
  void state.actions.invoke(action, { id: props.row.id });
}
</script>

<template>
  <td>
    <DsButton
      v-if="actions.length === 1"
      :icon="actions[0].icon"
      :label="actions[0].label"
      @click="onClick(actions[0])"
    />
    <DsMenu v-else trigger-icon="more-vertical">
      <DsMenuItem
        v-for="action in actions"
        :key="action.name"
        :icon="action.icon"
        :label="action.label"
        :destructive="action.intent === 'destructive'"
        @select="onClick(action)"
      />
    </DsMenu>
  </td>
</template>
```

```ts
const controls = { rowActions: DesignSystemRowActions };
```

`state.actions.cellRow` is the pre-flattened, per-row action list
(`[default?, ...others.row, ...rows]`) — every row reads the same
array, so the composable does the slicing once per table-def
change. `state.actions.invoke()` returns the discriminated
`ActionResult`; the table's `@action` emit fires after invoke
resolves so the page chrome can toast.

The default `AsRowActions` does the same thing with vunor's
`c8-*` button primitives and reka-ui's dropdown. The swap above replaces only the
chrome — the table's reactivity, confirm dialog, input form
dialog, and `@action` emit all keep working.

## Headless — no header row

`:headless` renders the table body without a header. It omits `<thead>`
entirely (it does **not** `display:none` it), which is the right shape for a
compact, label-less island — e.g. a small read-only grid embedded in a card
where the column labels add nothing.

```vue
<AsTable :headless="true" />
<AsWindowTable :headless="true" />
```

Works the same on both renderers. Column widths survive without a header:
they are carried by a `<colgroup>` (not the header `<th>`s), so a column
annotated `@ui.table.width "32ch"` keeps its width even with no header to
size from. Without `:headless` the header is the only place those widths
live, so hiding it with `:deep(thead){display:none}` collapses every column
to equal width — reach for `:headless` instead of that CSS hack.

::: warning Header-driven interactions go away
With no header there is no sort/filter/reorder/resize UI or column menu.
Drive those from elsewhere — a toolbar bound to `state.sorters` /
`state.filters`, or the [Config Dialog](/tables/config-dialog) — or keep the
header. `:headless` is for display-only grids, not interactive ones.
:::

::: tip Not the same as a _renderless_ table
`:headless` still renders `<AsTable>` — just without the header row. A
**renderless** table is the opposite layer: you drop `<AsTable>` entirely and
build your own markup (cards, lists) from `<AsTableRoot>` state — see
[Renderless renderers](/tables/custom-cells#renderless-renderers-alwaysselected).
:::

## Next steps

- [Cells](/tables/cells) — the built-in cell library.
- [Config Dialog](/tables/config-dialog) — anatomy of the
  three-tab settings dialog.
- [Actions & Selection](/tables/actions) — the underlying action
  model.
