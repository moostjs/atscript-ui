---
outline: deep
---

# Query Function

`<AsTableRoot>` is generic over its data source. There are two
supported wirings:

- **Path A — moost-db.** Point `:url` at a moost-db endpoint and the
  built-in `Client` (from `@atscript/db-client`) handles everything:
  metadata, paged data, value-help, actions.
- **Path B — custom `queryFn`.** Provide your own fetcher. The table
  still consumes the moost-db `/meta` response shape for capabilities,
  but you control how rows are loaded.

## Path A — moost-db

This is the default when you set `:url`:

```vue
<AsTableRoot url="/db/tables/products" :limit="25" v-slot="slot">
  <AsTable />
</AsTableRoot>
```

Under the hood `<AsTableRoot>`:

1. Resolves a `Client` via the shared `getMetaEntry(url, clientFactory)`
   cache. The first caller per URL creates the client; subsequent
   callers (tables AND value-help pickers) reuse it.
2. Fetches `/meta` and the serialized atscript type in parallel.
3. Calls `createTableDef(meta, type)` to merge them into a `TableDef`.
4. Calls `client.pages(query, page, size)` for data fetches. `query`
   is a `Uniquery` object built by `buildTableQuery`.

### The `/meta` response

`MetaResponse` (from `@atscript/db-client`, re-exported from
`@atscript/ui`) carries everything the client needs:

```typescript
interface MetaResponse {
  searchable: boolean;
  vectorSearchable: boolean;
  searchIndexes: SearchIndexInfo[];
  primaryKeys: string[];
  preferredId: string[];
  versionColumn?: string; // OCC version column (when `@db.column.version` is declared)
  crud: TCrudPermissions; // canCreate / canUpdate / canRemove
  actions: TDbActionInfo[]; // declarative server actions
  relations: RelationInfo[]; // to / from / via summaries
  fields: Record<string, FieldMeta>; // per-field { sortable, filterable }
  type: TSerializedAnnotatedType; // serialized .as type tree
}
```

`versionColumn` is present only on tables annotated with `@db.column.version` (see atscript-db's optimistic concurrency reference). It names the column the server manages for optimistic concurrency. Custom `queryFn` implementations don't need to do anything with it — atscript-ui handles the version-field hiding and 409 handling automatically. Just preserve the field in your returned `MetaResponse` shape. See the [Edit forms with optimistic concurrency](/tables/edit-form-occ) pattern guide.

The capability flags drive UI gates:

- `meta.fields[path].filterable` / `.sortable` enable the column menu's
  filter and sort entries.
- `meta.searchable` enables the search bar.
- `meta.crud.canRemove` gates the synthesised `__remove` row action.
- `meta.actions` populates `state.actions.table / .row / .rows` with
  declarative actions.

See [db.atscript.dev/http/crud](https://db.atscript.dev/http/crud) for
the full meta + CRUD route reference.

### The `Uniquery` data shape

`buildTableQuery` produces a `Uniquery` object combining filters,
sorters, projection, search and pagination:

```typescript
{
  filter: FilterExpr | undefined,
  controls: {
    $select?: string[],          // visible column paths (projection)
    $sort?: { [path]: 1 | -1 },  // user + force sorters
    $search?: string,            // search term (or "$search:indexName")
    $actions?: true,             // ask server for per-row gateable actions
  }
}
```

Pagination is passed separately as the `page` and `size` arguments —
moost-db returns a `PageResult<T> = { data, page, itemsPerPage, pages,
count }` for every page. The table reads `count` for the total row
count and uses the rest to align block prefetch with the server's
page math.

Detailed Uniquery semantics, operators and projection rules live in the
[atscript-db query syntax docs](https://db.atscript.dev/api/queries).

## Path B — custom `queryFn`

Bring your own fetcher. The signature:

```typescript
type QueryFn = (
  query: Uniquery,
  page: number,
  size: number,
) => Promise<PageResult<Record<string, unknown>>>;

interface PageResult<T> {
  data: T[];
  page: number;
  itemsPerPage: number;
  pages: number;
  count: number;
}
```

You still need a `/meta`-shaped response somewhere — the table relies on
its capability flags, field metadata and serialized type. The simplest
approach is to write a static endpoint that returns a `MetaResponse`
built from your atscript file at server startup.

```vue
<script setup lang="ts">
import { AsTableRoot, AsTable, createDefaultCellTypes } from "@atscript/vue-table";
import type { Uniquery } from "@uniqu/core";

const types = createDefaultCellTypes();

async function queryFn(query: Uniquery, page: number, size: number) {
  const res = await fetch(
    `/api/my-rows?${new URLSearchParams({
      page: String(page),
      size: String(size),
      q: JSON.stringify(query),
    })}`,
  );
  const json = await res.json();
  return { data: json.rows, total: json.total };
}
</script>

<template>
  <AsTableRoot url="/api/my-rows" :query-fn="queryFn" :types="types" :limit="50">
    <AsTable />
  </AsTableRoot>
</template>
```

`:url` is still required — it's the cache key used by
`getMetaEntry`, and the built-in client uses it for the `/meta` fetch
unless you also supply a custom `clientFactory`. For fully-custom
backends, the most common pattern is to expose `<your-base>/meta` that
returns a `MetaResponse`, and route `<your-base>/q` through your
`queryFn`.

::: tip Already have the rows?
Don't wrap an in-memory array in a fake client — use
[local rows](#path-c-local-rows) instead.
:::

## Path C — local rows

When the data is already in hand — a fixture, a dev playground, a small
list fetched by the page itself — give `<AsTableRoot>` the rows and the
columns instead of a `:url`. Since 0.1.134.

```vue
<script setup lang="ts">
import { ref } from "vue";
import { AsTableRoot, AsTable } from "@atscript/vue-table";
import type { ColumnDef } from "@atscript/ui";

const columns: ColumnDef[] = [
  {
    path: "id",
    label: "ID",
    type: "number",
    sortable: true,
    filterable: false,
    nullable: false,
    order: 0,
  },
  {
    path: "name",
    label: "Name",
    type: "text",
    sortable: true,
    filterable: false,
    nullable: false,
    order: 1,
  },
];

const rows = ref([
  { id: 1, name: "alice" },
  { id: 2, name: "bob" },
]);
</script>

<template>
  <AsTableRoot :rows="rows" :columns="columns" :search-paths="['name']">
    <AsTable select="multi" />
  </AsTableRoot>
</template>
```

In local mode the table builds its state with `createStaticTableState`
and provides the same context as the fetching path, so **cells, keyboard
navigation, header and cell slots, selection, the config dialog
(visibility + reordering) and pagination all work unchanged**. Sorting,
searching and paging run in memory over `rows`.

No client is constructed, no `/meta` request is made, and no entry lands
in the URL-keyed metadata cache — so a local table costs nothing after
unmount.

| Prop          | Meaning                                                                            |
| ------------- | ---------------------------------------------------------------------------------- |
| `rows`        | The dataset. **Reactive** — replace the array and the table re-queries locally.    |
| `columns`     | `ColumnDef[]`, read once at setup.                                                 |
| `searchPaths` | Field paths `searchTerm` matches (substring, case-insensitive). Omit to disable.   |
| `localSort`   | Sort in memory from the active sorters. Default `true`; `false` keeps array order. |
| `limit`       | Page size, as usual.                                                               |

Features that need a server are inert and warn once in the console when
configured: `:preset`, `v-model:url-query`, `:query-fn`, and `:url`
itself (ignored when `:rows` is present). Server actions do not exist in
local mode either — use
[`:row-actions` `extra`](/tables/actions#selecting-and-extending-row-actions)
for app-owned row actions.

::: tip Writing your own root
`provideTableContext` / `useTableContext` and the `TableContext` type
are exported from `@atscript/vue-table`, so a fully custom root can
build any state (including `createStaticTableState`) and provide it to
`<AsTable>`. Advanced — `<AsTableRoot>` covers both the fetching and the
local case.
:::

## Force filters and force sorters

Both wirings support always-applied constraints that the user cannot
remove:

```vue
<AsTableRoot
  url="/db/tables/orders"
  :force-filters="{ status: 'open' }"
  :force-sorters="[{ field: 'createdAt', direction: 'desc' }]"
/>
```

`buildTableQuery` merges these with user state via `mergeFilters` and
`mergeSorters`:

- **`mergeFilters(force, user, ...more)`** — combines with `$and` at the top
  level (variadic since 0.1.140; residual conditions ride along). If `force` exists, every user condition AND-s with it. Both
  are `FilterExpr`s from `@uniqu/core`.
- **`mergeSorters(force, user)`** — prepends `force` first. If a field
  appears in both lists, the force entry wins; the matching user entry
  is dropped from the merged result.

Both are exported from `@atscript/ui-table` for direct use in
non-AsTableRoot contexts.

## Holding queries back

`:block-query` short-circuits every fetch trigger — the initial
bootstrap, `query()`, `queryNext()` and window `loadRange()`. Use it
while a prerequisite is still missing (a tenant not yet picked, a
parent record not yet loaded):

```vue
<AsTableRoot :url="url" :block-query="!tenantId" />
```

Since 0.1.133 the prop is read reactively: while it is `true` the
table stays idle and empty, and the moment it flips back to `false`
the held-back query runs — exactly once, with the state as it stands
then. Flipping it back to `true` stops everything again. Before
0.1.133 the value was captured at mount, so a table mounted while
blocked never fetched at all.

## Cache and reuse

A single `/meta` fetch is shared across every component that points at
the same URL — multiple tables, value-help pickers and form `ref`
fields all consult the same `MetaCacheEntry`. The cache lives in
`@atscript/ui` (`getMetaEntry` / `resetMetaCache`). Call
`clearTableCache()` (alias for `resetMetaCache`) if you need to drop a
stale entry — for instance after a schema reload during development.

## Next steps

- [Filtering](/tables/filtering) — how `state.filters` becomes the
  `FilterExpr` half of `Uniquery`.
- [Sorting](/tables/sorting) — `state.sorters` and force-sort
  semantics.
- [Pagination & Virtualization](/tables/pagination) — how `page` /
  `size` (and block-aligned fetches for windowed tables) work in
  practice.
