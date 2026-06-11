---
outline: deep
---

# URL State

Filters, sorters, pagination, and full-text search round-trip
through the browser address bar. Sharing a URL shares the exact
view. Bookmarking a URL bookmarks the exact view. Back/forward
navigates between views.

## The composable

`useTableUrlQuery(useRoute(), useRouter())` returns a
`WritableComputedRef<string>` that owns the entire `route.query`.
Bind it to `<AsTableRoot v-model:url-query>`:

```vue
<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { AsTableRoot, useTableUrlQuery } from "@atscript/vue-table";

const urlQuery = useTableUrlQuery(useRoute(), useRouter());
</script>

<template>
  <AsTableRoot url="/api/db/tables/orders" v-model:url-query="urlQuery" />
</template>
```

The composable does **type-only** imports of `Router` and
`RouteLocationNormalizedLoaded`, so `@atscript/vue-table` has no
runtime dependency on `vue-router`. Pass in already-resolved
instances from the consumer app.

## What syncs

Four aspects round-trip:

| Aspect     | URL form (uniqu syntax)     |
| ---------- | --------------------------- |
| Filters    | `name=acme&status='active'` |
| Sorters    | `$sort=-createdAt,+name`    |
| Pagination | `$skip=50` (page-derived)   |
| Search     | `$search='laptop'`          |

Default view (page 1, no filters, no sorters, no search) emits an
empty string — no `?` in the URL.

The encoder lives in `@atscript/ui-table` as
`stateToUrlQueryString()`; the decoder is
`urlQueryStringToState()`. The Vue composable is just a thin
vue-router bridge — apps that need a custom routing integration can
call those directly.

## Per-aspect gating

Some pages don't want every aspect in the URL. Orders, for example,
might share filters but always land recipients on page 1 — pinning
the linker's page would be wrong. Use `urlQuerySync`:

```vue
<AsTableRoot
  v-model:url-query="urlQuery"
  :url-query-sync="{ pagination: false }"
  url="/api/db/tables/orders"
/>
```

The shape:

```ts
interface UrlQuerySync {
  filters?: boolean | string[]; // allowlist of field paths
  sorters?: boolean | string[]; // allowlist of field paths
  search?: boolean; // $search
  pagination?: boolean; // $skip + $limit
}
```

`true` (or omitted) syncs the whole aspect. `false` opts out
entirely. A `string[]` allowlist syncs only the listed field paths
— useful for "share the public filters, hide the internal ones".

The gate is honoured **symmetrically**: the encoder leaves the
aspect out, the decoder ignores it on hydration. Asymmetric gating
would produce self-echoing URLs.

## Hydration

On first mount, `applyUrlQuery(urlString)` replays the URL onto
state:

- Replaces `state.filters`, `state.sorters`, `state.searchTerm`,
  `state.pagination.page`.
- Unions decoded filter field paths into `state.filterFields` so
  hidden inputs become visible (you arrived at this URL because
  someone filtered by them).
- Sets `state.hydratingFromUrl` for the current tick — the root
  watcher suppresses its query call so a second fetch doesn't
  follow the URL replay.

The bridge is echo-guarded: writes that originated from
`applyUrlQuery` don't fire a follow-up URL write back, and writes
that originated from state mutations don't trigger a re-hydration
of the state they came from.

## End-to-end wiring

A canonical table-page consumer:

```vue
<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { AsTable, AsTableRoot, useTableUrlQuery } from "@atscript/vue-table";

const urlQuery = useTableUrlQuery(useRoute(), useRouter());

// Per-table aspect gates from the route's metadata
const props = defineProps<{ path: string }>();
const urlQuerySync = computed(() => {
  if (props.path === "orders") return { pagination: false };
  return undefined;
});
</script>

<template>
  <AsTableRoot
    :key="path"
    v-model:url-query="urlQuery"
    :url-query-sync="urlQuerySync"
    :url="`/api/db/tables/${path}`"
  >
    <AsTable />
  </AsTableRoot>
</template>
```

A few things to note:

- `:key="path"` remounts the root when the table changes. The URL
  parser only fires on initial mount; remounting on path is how
  cross-table navigation hydrates from the new URL.
- `urlQuerySync` is a `ComputedRef` so each table page picks its
  own gating without affecting siblings.
- The default mode is `replace`, so typing in the search box does
  not pollute history with 30 entries. Use
  `useTableUrlQuery(route, router, { mode: 'push' })` if every
  state change should be a discrete back-button step.

## Caveats

`useTableUrlQuery` owns the **entire** `route.query`. Apps that mix
table state with unrelated query params (e.g. an analytics tag,
`?utm_source=...`) should write a small `WritableComputedRef`
themselves that merges in the table aspect rather than wholesale-
replacing the query. The pattern is small enough that we don't
want to grow the public API surface to cover it.

## Next steps

- [Presets](/tables/presets) — durable named views (server-side).
- [Server-Side Presets](/tables/server-presets) — wire up Moost.
