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

Every URL the table writes ends in the `$snapshot` marker, so the
default view (page 1, no filters, no sorters, no search) is `?$snapshot`
— see [Snapshot URLs and deep links](#snapshot-urls-and-deep-links).
Up to 0.1.138 there was no marker and the default view emitted an empty
string.

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
  snapshot?: boolean; // the $snapshot marker (since 0.1.139)
  residual?: boolean; // custom filter conditions (since 0.1.140)
}
```

`true` (or omitted) syncs the whole aspect. `false` opts out
entirely. A `string[]` allowlist syncs only the listed field paths
— useful for "share the public filters, hide the internal ones".

The gate is honoured **symmetrically**: the encoder leaves the
aspect out, the decoder ignores it on hydration. Asymmetric gating
would produce self-echoing URLs.

## Hydration and restoration

`applyUrlQuery(urlString, opts?)` replays a URL onto state.
`<AsTableRoot>` calls it on every pass — the deep link on mount, then
every client-side navigation and Back / Forward — and the URL itself
decides what happens to filters and sorters it does **not** mention:

| URL                     | Filters/sorters the URL omits                           |
| ----------------------- | ------------------------------------------------------- |
| carries `$snapshot`     | **cleared** — the URL is the whole view                 |
| no marker (an app link) | **reset to the boot baseline**, then the URL is laid on |

The **boot baseline** is what the table's URL-owned filters and sorters
were just before the first URL was applied: the preset, a persisted
draft, the `v-model` values you passed. It is captured once, so every
marker-less URL overlays the same starting point — Back to the deep
link you opened restores that link as it was first opened, not the
link plus whatever changed since. A preset the user switches to after
mount does **not** move the baseline; the boot baseline wins.

Both behaviours:

- Write `state.searchTerm` and `state.pagination.page` from the URL
  (those always take the URL's value — absent means empty / page 1).
- Union decoded filter field paths into `state.filterFields` so
  hidden inputs become visible (you arrived at this URL because
  someone filtered by them). This never narrows: a revealed filter
  input is a per-user display preference.
- Set `state.hydratingFromUrl` for the current tick — the root
  watcher suppresses its query call so a second fetch doesn't
  follow the URL replay.
- Touch only what the sync gates serialize. Under an allowlist,
  filters outside it are private — the URL never carried them, so it
  neither clears nor resets them; under `filters: false` nothing is
  touched at all. A custom filter condition is the URL's only when the
  allowlist covers every field it references.

A marker-less URL owns every field path it mentions — in a field filter
or inside a [custom filter condition](/tables/filtering#custom-filter-conditions):
the baseline's filters and custom conditions on those paths give way,
the rest of the baseline stays (since 0.1.140; field filters always
worked this way).

`opts.mode` overrides the marker for a programmatic caller: `"replace"`
clears like a snapshot URL, `"merge"` resets to the baseline like a
marker-less one.

The bridge is echo-guarded: writes that originated from
`applyUrlQuery` don't fire a follow-up URL write back, and writes
that originated from state mutations don't trigger a re-hydration
of the state they came from. `useTableUrlQuery` writes the table's
keys as one block in the table's order, so its own URL reads back the
way it was written.

History of this behaviour: up to 0.1.136 every pass merged onto the
current state and an empty query was skipped, so Back could not undo
a filter. 0.1.137–0.1.138 merged on the first pass and replaced on
every later one, so Back to a marker-less deep link lost the preset's
criteria. Since 0.1.139 the marker decides, on every pass.

## Snapshot URLs and deep links

Since 0.1.139 a URL says which of two things it is:

| URL                      | Written by                     | Filters/sorters the URL omits            |
| ------------------------ | ------------------------------ | ---------------------------------------- |
| `?status=open&$snapshot` | the table (every URL it emits) | **cleared** — the URL is the whole view  |
| `?status=open`           | your app (a hand-built link)   | **kept** from the boot baseline (preset) |

**Reload and share reproduce the table.** Because the table stamps
`$snapshot` on everything it writes, reloading or opening a copied URL
restores exactly the filters and sorters it lists — a preset's or saved
default's other criteria are not added back, and a URL without `$sort`
means _no_ sorters, not "keep the default ones". Columns, widths and
other presentation preferences are never touched. This holds on the
first mount, on client-side navigation and on Back / Forward.

The marker counts by presence alone: `$snapshot`, `$snapshot=1` and
`$snapshot=0` all mark a snapshot.

**Link into a view.** Pick the form by what the destination should do
with its own default view:

```ts
import { stateToUrlQueryString } from "@atscript/ui-table";

// Exactly this population, nothing from the destination's preset.
const exact = stateToUrlQueryString(
  { filters: { team: [{ type: "eq", value: ["core"] }] }, sorters: [] },
  { defaultItemsPerPage: 25 },
); // → "team=core&$snapshot"

// The destination's preset, narrowed by one more criterion.
router.push({ path: "/tickets", query: { team: "core" } });
```

A snapshot link built by hand just adds the bare key:
`router.push({ path: "/tickets", query: { team: "core", $snapshot: null } })`.
The key is exported as `URL_SNAPSHOT_KEY` from `@atscript/ui-table`.

- **Do** build cross-view links as snapshots when the linked population
  must be exact (a dashboard tile, an alert) — an overlay link inherits
  whatever the destination's default preset filters on.
- **Do** keep marker-less links for "open this view, focused on X".
- **Don't** strip `$snapshot` from table URLs you store or share — without
  it a reload overlays the preset again.
- **Don't** rely on a marker-less URL to remove a baseline filter: it
  can only add to the baseline. Use a snapshot URL for that.
- `:url-query-sync="{ snapshot: false }"` turns the marker off: it is
  neither written nor honoured, so every URL — including the ones the
  table writes — overlays the boot baseline.

## Links the filter model cannot hold

A URL can carry filters the table's per-field model cannot express — a
cross-field OR, a second range AND-ed onto the same field, a negated
range. Since 0.1.140 the table keeps them as
[custom filter conditions](/tables/filtering#custom-filter-conditions):
the rows are exactly the ones the link describes, a "Custom filter" chip
in `<AsFilters>` shows the condition in words, and the user can remove
it. The condition is written back into every URL the table emits, in the
same uniqu grammar, so reload, share and Back / Forward keep it:

```
?(lane=fast&openedAt<=100)^(lane=slow&openedAt<=50)&$snapshot
?customerId=2&((status=shipped&total>500)^(status=pending&total<=50))&$snapshot
?!(status=shipped&total>500)&$snapshot
```

A link written by hand works the same way — the `&` inside a group can
be left raw. The table does not rewrite the URL on load; the next change
writes it in the table's own spelling.

What is still **left out and reported** as `@unsupported-filter` (the view
is then _broader_ than the link):

- a piece that correlates a server-backed column with a client-owned
  (`local`) one — unreachable server-side;
- everything, when `:url-query-sync="{ residual: false }"` — the 0.1.139
  behaviour: nothing is carried, nothing extra is written.

A piece that names a field the caller cannot read (hidden from their role,
or gone from the schema) is dropped too, but reported as
`@fields-dropped`. See [Fields Hidden by Role](/tables/hidden-fields#urls).
Up to 0.1.140 a piece mixing such a field with known ones went to
`@unsupported-filter`.

Listen for the lossy pieces to tell the user:

```vue
<AsTableRoot
  v-model:url-query="urlQuery"
  url="/api/db/tables/tickets"
  @unsupported-filter="(issue) => notify(`Link criterion ignored: ${issue.fields.join(', ')}`)"
/>
```

Without a listener each piece is reported with a `console.warn` in
development builds. Renderless tables pass `onUnsupportedFilter` to
`useTable`. Custom renderers calling `urlQueryStringToState` get the
carried conditions as `residual`, the lost pieces as `unsupported`, and
the pieces and sorters on unknown fields as `unknown` / `unknownSorters`. `$in` /
`$nin` lists and same-field ORs are not lossy — they become field
conditions. The decoding rules are on
[Filtering](/tables/filtering#converting-a-uniquery-filter-back).

In 0.1.139 every such piece was left out and reported; `@unsupported-filter`
now fires only for pieces that are actually dropped.

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
table's keys are rewritten as one block in the table's order (and
removed once they drop out), and anything else the page owns
(`?utm_source=…`, a tab flag, an analytics tag) is left untouched, in
place.

Consumed, and therefore the table's to remove: the `$`-controls the
parser actually reads (`$sort`, `$search`, `$relevance`, `$skip`,
`$snapshot`) and
operator-bearing filter keys (`total>100`, and since 0.1.140 groups and
lists: `(a=1^b=2)`, `status{a,b}`) — so a deep link's sort, range filter
or custom condition still clears when the user clears it. A group with an
`&` inside stays one key. A `$`-key the
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
