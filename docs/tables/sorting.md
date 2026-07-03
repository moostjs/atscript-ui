---
outline: deep
---

# Sorting

The sort model is a flat array: `SortControl[]` — later entries break
ties of earlier ones, so the array can express a multi-column sort. A
header click sets a **single** sort (it replaces the array); multi-column
sorts are composed in the [config dialog](#the-config-dialog). The state
contract is the same as for filters: pure mutators, single watcher
reaction.

## The sort model

```typescript
interface SortControl {
  field: string; // column path (dot-notation)
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

Clicking a `<AsTableHeaderCell>` **replaces** `state.sorters` with a
single sort on that column, driven by the column menu's _Ascending_ /
_Descending_ items:

1. **Not sorted (or sorted by another column)** → becomes the sole
   sorter — `asc`, or `desc` if you pick _Descending_.
2. **Already `asc`** → pick _Descending_ to flip it to `desc`.
3. **Pick the direction it already has** → clears the sort entirely.

A header click is a single-sort control: it discards every other sorter,
including preset- and `v-model`-sourced ones. To keep more than one
sorter active, build it in the [config dialog](#the-config-dialog) — that
is the only surface that composes a multi-column sort.

The header cell only offers sort when `column.sortable === true`, which
itself derives from `meta.fields[path].sortable` (the server flag from
`@db.index.*` / `@db.column.sortable` / `@db.table.sortable`). For
non-sortable columns the header exposes no sort control.

### The config dialog

`<AsConfigDialog>`'s _Sorters_ tab is the heavy-duty editor:

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
  [
    { field: "priority", direction: "asc" },
    { field: "name", direction: "asc" },
  ],
);
// → [{ field: "priority", direction: "desc" }, { field: "name", direction: "asc" }]
```

If a user sorter targets the same field as a force sorter, the user
entry is dropped from the merged result — the force entry wins. The
user's array isn't mutated; only the merged result that flows into
`buildTableQuery` is affected.

This is the natural reading of "force": the server _always_ sees the
force sorter, and the user can layer additional tie-breakers
underneath but cannot override.

## Search relevance & sort suppression

When a table has both a search box and a default sort — from a preset,
`v-model:sorters`, or an earlier header click — the two compete on the
wire. `$search` asks the backend to rank matches by relevance; an
explicit `$sort` **replaces** that ranking with the field order. On a
relevance-ranked backend (e.g. Atlas Search) the effect is a search
that returns the right _set_ of rows in the wrong order: the closest
match can land deep in the list because a default `-createdAt` sort
outranks it. It reads as a broken search, not as a sort problem.

`ignoreSortersWhenSearched` lets a table opt into preserving relevance
while a search is active:

```vue
<AsTableRoot url="/api/db/tables/products" ignore-sorters-when-searched />
```

The default is `false`, so nothing changes unless you opt in. Turn it
on only when the search index actually scores matches — for a backend
whose search is a plain `LIKE` filter with no relevance order,
suppressing the sort would leave results in an undefined order, which
is worse. It's a per-table trade, which is why the table owner holds
the switch.

### Semantics

The flag is a **model**, not a static setting — it follows the user's
intent across a search session:

1. **Suppressed while searching.** While the flag is `true` and
   `state.searchTerm` is non-empty, user sorters are dropped from
   `$sort` and the backend ranks by relevance. Suppression is
   query-time only — `state.sorters` is never mutated, so nothing is
   lost and preset-dirty tracking is unaffected.
2. **Sorting during a search is explicit intent.** Any write to
   `state.sorters` while a search is active flips the flag to `false`
   for the rest of that session — a header click, the config dialog, a
   preset applied mid-search, `v-model`, or a programmatic write all
   count. "All matches, newest first" is a legitimate choice, and the
   header arrows make the trade visible.
3. **A new search resets it.** When `searchTerm` transitions from empty
   to non-empty, the flag snaps back to the configured default, so the
   next search starts at relevance again. Clearing the search resumes
   emitting whatever `state.sorters` holds.
4. **`forceSorters` always emit.** Embed-owner sort (see
   [Force sorters](#force-sorters)) is never suppressed — it isn't a
   browse-order default the user can trade away.

Read or drive the runtime value via `state.ignoreSortersWhenSearched`
(a `Ref<boolean>`), or bind it externally with
`v-model:ignore-sorters-when-searched`:

```vue
<AsTableRoot url="/api/db/tables/products" v-model:ignore-sorters-when-searched="relevanceMode" />
```

The runtime value round-trips through the URL as `$relevance` (see
[URL State](/tables/url-state)), so a link shared mid-search reproduces
exactly the ordering the sharer saw.

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
const sorters = forceSorters?.length ? mergeSorters(forceSorters, userSorters) : userSorters;

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
- [Config Dialog](/tables/config-dialog) — the _Sorters_ tab UX.
