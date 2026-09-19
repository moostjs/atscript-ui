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
`WritableComputedRef<string>` you bind to `<AsTableRoot v-model:url-query>`:

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

Tables that opt into
[search-relevance suppression](/tables/sorting#search-relevance-sort-suppression)
add one more token: `$relevance=1` / `$relevance=0`, emitted only while
a search is active and only when the runtime flag differs from the
table's configured default. It rides under the `search` gate below —
turning `search` off drops `$relevance` too — so a link captured
mid-search reproduces the exact ranking the sharer saw.

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

## Host-owned query keys

Since 0.1.133 the bridge owns **only what the table reads back**: a
key is the table's iff the URL parser would consume it, or the bridge
has written it before. Read and write therefore agree in both
directions. Every write merges into the current `route.query`: the
table's keys are replaced (or removed once they drop out), and
anything else the page owns (`?utm_source=…`, a tab flag, an
analytics tag) is left untouched, in place.

Consumed, and therefore the table's to remove: the `$`-controls the
parser actually reads (`$sort`, `$search`, `$relevance`, `$skip`) and
operator-bearing filter keys (`total>100`) — so a deep link's sort or
range filter still clears when the user clears it. A `$`-key the
parser ignores (`$limit`, or anything of your own) stays with the
page. A plain `field=value` key is indistinguishable from a
page-owned flag of the same name, so one that was already in the URL
at mount counts as foreign until the bridge writes it itself. Pass a
`prefix` when that matters.

## Two tables on one route

Give each table a namespace. Every key the bridge writes is then
`prefix.key`, and only keys under that prefix are read back or
removed — everything else is foreign and preserved:

```vue
<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { AsTableRoot, useTableUrlQuery } from "@atscript/vue-table";

const route = useRoute();
const router = useRouter();
const ordersQuery = useTableUrlQuery(route, router, { prefix: "orders" });
const customersQuery = useTableUrlQuery(route, router, { prefix: "customers" });
</script>

<template>
  <AsTableRoot url="/api/db/tables/orders" v-model:url-query="ordersQuery" />
  <AsTableRoot url="/api/db/tables/customers" v-model:url-query="customersQuery" />
</template>
```

The resulting URL reads
`?orders.status='open'&orders.$skip=50&customers.name=acme&tab=split` —
each table only ever touches its own keys, and the page keeps `tab`.

## Next steps

- [Presets](/tables/presets) — durable named views (server-side).
- [Server-Side Presets](/tables/server-presets) — wire up Moost.
