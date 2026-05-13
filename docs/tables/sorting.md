---
outline: deep
---

# Sorting

The sort model is a flat array: `SortControl[]`. Multi-sort is the
default — later entries break ties of earlier ones. The state contract
is the same as for filters: pure mutators, single watcher reaction.

## The sort model

```typescript
interface SortControl {
  field: string;                  // column path (dot-notation)
  direction: "asc" | "desc";
}
```

State lives at `state.sorters`. The renderer translates it into the
`$sort` portion of `Uniquery`:

```typescript
// state.sorters
[
  { field: "status", direction: "asc" },
  { field: "createdAt", direction: "desc" },
]

// → controls.$sort
{ status: 1, createdAt: -1 }
```

Order matters. The server applies the directives in the same order, so
`status` is the primary sort and `createdAt` is the tiebreaker.

## How sorters get into the state

### Header click

Clicking a `<AsTableHeaderCell>` toggles the column's position in
`state.sorters`:

1. **Not in sorters** → appended as `asc`.
2. **Already `asc`** → flipped to `desc`.
3. **Already `desc`** → removed from the array.

Shift-click (or repeated clicks while another column is already sorted)
preserves the rest of the array — that's how the user builds a
multi-sort.

The header cell only fires the toggle when `column.sortable === true`,
which itself derives from `meta.fields[path].sortable` (the server flag
from `@db.index.*` / `@db.column.sortable` / `@db.table.sortable`). For
non-sortable columns the header is inert.

### The config dialog

`<AsConfigDialog>`'s *Sorters* tab is the heavy-duty editor:

- Reorder sorters by drag.
- Flip direction.
- Remove sorters.
- (Re-)add any sortable column.

All operations write back to `state.sorters`; nothing else changes
until the watcher re-fires the query.

### `v-model:sorters`

`<AsTableRoot>` accepts an external `Ref<SortControl[]>` via
`v-model:sorters`. Useful for surfacing sort state in a parent
component (URL state, persistence, sync between sibling tables).

## Force sorters

`<AsTableRoot :force-sorters="...">` (or the underlying
`useTable({ forceSorters })`) pins a list of sorters that always
prepend the user's:

```vue
<AsTableRoot
  url="/db/tables/items"
  :force-sorters="[{ field: 'priority', direction: 'desc' }]"
>
```

The merge rule is implemented by `mergeSorters` in
`@atscript/ui-table`:

```typescript
import { mergeSorters } from "@atscript/ui-table";

mergeSorters(
  [{ field: "priority", direction: "desc" }],
  [{ field: "priority", direction: "asc" }, { field: "name", direction: "asc" }],
);
// → [{ field: "priority", direction: "desc" }, { field: "name", direction: "asc" }]
```

If a user sorter targets the same field as a force sorter, the user
entry is dropped from the merged result — the force entry wins. The
user's array isn't mutated; only the merged result that flows into
`buildTableQuery` is affected.

This is the natural reading of "force": the server *always* sees the
force sorter, and the user can layer additional tie-breakers
underneath but cannot override.

## Programmatic sorting

For one-off application from the parent component, write directly to
the model:

```vue
<AsTableRoot ref="root" url="/db/tables/orders" v-slot="{ sorters }">
  <button
    @click="root!.state.sorters.value = [{ field: 'amount', direction: 'desc' }]"
  >
    Sort by amount
  </button>
  <AsTable />
</AsTableRoot>
```

Watchers downstream will re-fire the query automatically — you don't
need to call `state.query()`.

## What ends up on the wire

`buildTableQuery` (in `@atscript/ui-table`) assembles the `$sort`
controls block from the merged sorters:

```typescript
const sorters = forceSorters?.length
  ? mergeSorters(forceSorters, userSorters)
  : userSorters;

const $sort: Record<string, 1 | -1> = {};
for (const s of sorters) {
  $sort[s.field] = s.direction === "asc" ? 1 : -1;
}
```

Backends consume the same shape — see
[atscript-db query syntax](https://db.atscript.dev/api/queries) for the
adapter-specific lowering.

## Next steps

- [Pagination & Virtualization](/tables/pagination) — how sort
  changes interact with page reset and block invalidation.
- [URL State](/tables/url-state) — bookmarkable sort order.
- [Config Dialog](/tables/config-dialog) — the *Sorters* tab UX.
