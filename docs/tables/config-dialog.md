---
outline: deep
---

# Config Dialog

`AsConfigDialog` is the table's settings panel. Three tabs:
**Columns**, **Sorters**, **Filters**. The dialog mutates state
arrays only — the root watcher reacts and re-queries. There is no
"Apply" button that calls the server; "Apply" is a synchronous state
write.

## Opening it

The dialog is mounted once by `<AsTableRoot>`. It binds its `open`
state to `state.configDialogOpen`. Three triggers ship out of the
box:

- The toolbar **Settings** button in `<AsTableActions>`.
- Each column header's dropdown menu (`<AsColumnMenu>`) — opens the
  dialog directly on the matching tab.
- Programmatic: `state.showConfigDialog(tab?)` from any composable
  with access to `useTableContext()`.

```ts
import { useTableContext } from "@atscript/vue-table";

const { state } = useTableContext();

function openFilters() {
  state.showConfigDialog("filters");
}
```

The tab argument is typed as `ConfigTab = 'columns' | 'sorters' | 'filters'`.
Omit it to reopen on the last-used tab (the dialog persists
`state.configTab` across opens).

## The three tabs

The dialog copies state into local refs on open and writes back to
state on **Apply**. Cancel discards the local copy. This makes the
dialog feel snappy — you can drag rows around without firing
queries on every keystroke.

### Columns

Controls **visibility** and **order** of the column list. The user
checks columns on and off, drags rows to reorder, and the dialog
writes the merged `string[]` back to `state.columnNames` on Apply.
Width controls live on the column header (resize handle, "Reset
width" entry in the column menu) — the dialog doesn't duplicate
them.

### Sorters

Reorder, add, or remove `SortControl[]`. Drag rows to set priority.
The dialog shows only fields where `column.sortable === true` (see
the `sortableColumns` filter in `<AsConfigDialog>`).

The Sorters tab is also where you'd hit **Clear all** to drop every
sorter in one click.

### Filters

This is the **display list**, not the applied conditions. Checking a
field makes its filter input appear in the filter bar; unchecking
hides the input. **Hiding an input does not clear its value** — the
applied filter on `state.filters[path]` stays put until you clear
it explicitly. The tab shows a small count badge for fields that
have an applied condition.

The two concerns are independent on purpose: a user can hide a
filter input to clean up the bar without losing the condition they
already typed.

## Mutation model

The dialog's **Apply** button is three writes:

```ts
state.columnNames.value = columnsModel.value;
state.filterFields.value = filtersModel.value;
state.sorters.value = sortersModel.value;
state.configDialogOpen.value = false;
```

That's the entire flow. The root watcher in `use-table-query.ts`
observes these arrays and fires a re-query when needed. The dialog
does **not** call `state.query()`. This is part of the broader
model-driven contract — every writer (this dialog, the column
header menu, programmatic callers, URL hydration) triggers the same
reaction through the same watcher.

## Swapping the dialog

`AsConfigDialog` is a Tier-2 default. Replace it via the `controls`
map on the root:

```ts
import { createDefaultControls } from "@atscript/vue-table";
import MyConfigDialog from "./MyConfigDialog.vue";

const controls = { ...createDefaultControls(), configDialog: MyConfigDialog };
```

```vue
<AsTableRoot url="/db/products" :controls="controls" />
```

Your replacement reads `state.configDialogOpen`, `state.configTab`,
and the same state arrays as the default. Anchor your dialog to
`v-model:open="state.configDialogOpen"` and write the same three
arrays on Apply — every other reaction (re-query, URL sync, preset
dirty-check) flows automatically from those writes.

If you only want a different look on one tab, keep the swap at the
dialog level: your replacement reads the same state arrays
(`columnNames`, `filterFields`, `sorters`) and writes them back —
build the inner tab UI however your design system prefers. The
default's per-tab building blocks are package internals and not part
of the public surface.

## Next steps

- [URL State](/tables/url-state) — share table state via the address
  bar.
- [Presets](/tables/presets) — save and restore named configurations.
- [Customization](/tables/customization) — full list of swappable
  controls.
