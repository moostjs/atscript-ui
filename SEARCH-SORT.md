# SEARCH-SORT: preset sorters ride along with `$search` and discard relevance ranking

Status: **implemented** (2026-07-03) as the consumer-owned flag `ignoreSortersWhenSearched` —
see "Implemented semantics" below. Originally filed the same day from a production consumer
app, after shipping a consumer-side workaround — see "Downstream workaround" below.

## The problem

`buildTableQuery` (`packages/ui-table/src/query/build-table-query.ts`) merges `sorters` and
`search` as fully independent aspects: whatever is in `state.sorters` is emitted as `$sort`
alongside `$search`, unconditionally. On the server, an explicit `$sort` **replaces** the search
engine's relevance ordering (Atlas `$search` + `$sort` = sort wins; same for any backend where a
requested sort overrides score ordering).

Since presets routinely seed a default browse order (newest-first `_id`, alphabetical
`make/model`, recency `lastSeenAt`), **every table that has both a search box and a default sort
has silently broken search ranking** — the user types a query and gets the match set in browse
order instead of relevance order.

Why this stays hidden, then bites:

- Tight single-token queries look fine (the match set is small; any order of 7 cougar rows reads
  as "working").
- Multi-token queries expose it dramatically. Real repro from a production consumer app
  (2,406-row inventory grid, Atlas Search over `matchInput`, preset `-_id`):
  - `$search=coachmen prism 24fs` **without** `$sort` → `2026 Coachmen Prism 24FS` first, then
    the other Prisms. Perfect.
  - Same `$search` **with** `$sort=-_id` → "2017 Winnebago Spyder 24FQ", "Prime Time Crusader
    330MKS", … The compound/fuzzy match set has a long tail of weak single-token matches, and
    recency ordering surfaces the tail while relevance is thrown away.
- The user-facing report was, verbatim: _"the search results does not seem to match the search
  query. why?"_ — i.e. it presents as a broken search, not as a sort problem. Nobody suspects
  their default sort.

## Why this is upstream's to fix (not the consumer's)

The consumer-side fix is to remove `defaultSorters` from every searchable table — which is what
the portal did, paying a real cost: meaningful browse orders (alphabetical catalog, recency
queues) were sacrificed on three grids to protect search ranking. That trade shouldn't exist.
Only the client knows _where a sorter came from_ (preset vs deliberate header click), so neither
the server nor per-app config can express the correct behavior. It belongs in the ui-table state
machine + query builder.

## Implemented semantics — consumer-owned flag `ignoreSortersWhenSearched`

Instead of sorter provenance tracking, the fix is a **flag-as-model**:

1. **Opt-in per table.** Consumers set `ignoreSortersWhenSearched` (default `false` — backends
   without relevance ranking see zero behavior change). On `<AsTableRoot>` it's a
   `defineModel` prop, usable as a plain prop (`:ignore-sorters-when-searched="true"` sets the
   configured default) or as `v-model:ignore-sorters-when-searched` to observe/drive the runtime
   flag. `useTable` accepts `ignoreSortersWhenSearched?: boolean | Ref<boolean>` (boolean =
   default; Ref = model, its initial value being the default).
2. **Query-time suppression only.** While the runtime flag is true AND `searchTerm` is
   non-empty, user `sorters` are NOT emitted in the query. `forceSorters` are ALWAYS emitted
   (embed-owner intent). `state.sorters` itself is never mutated, so preset-dirty comparisons
   and restore-on-clear stay untouched.
3. **The flag is a model.** Any write to `state.sorters` while a search is active flips the
   runtime flag to `false` for the current search session — user sorted mid-search = explicit
   intent. This uniformly covers header click, config dialog, preset apply mid-search, URL
   merge, and programmatic writes, with no provenance tracking.
4. **Session reset.** When a NEW search session starts (`searchTerm` empty → non-empty), the
   runtime flag resets to the configured default. Clearing the search ends the session; sorters
   in state simply resume being emitted.

### Where it lives

- `packages/ui-table/src/query/build-table-query.ts` — `BuildTableQueryOptions.ignoreSorters`:
  when true, user `sorters` are treated as empty; `forceSorters` still merge. Dumb by design —
  the caller computes the search-active condition.
- `packages/ui-table/src/query/url-query.ts` — the runtime flag serializes as `$relevance=1|0`,
  only when a search term is present AND the flag differs from the configured default
  (`UrlQueryDefaults.defaultIgnoreSorters`), so a link shared mid-search with an explicit sort
  reproduces what the sharer saw. Decoder returns `ignoreSorters?: boolean` (undefined when the
  URL is silent). Gated together with the `search` sync aspect.
- `packages/vue-table/src/composables/use-table-state.ts` — runtime `Ref<boolean>` exposed as
  `state.ignoreSortersWhenSearched`; rules 3/4 live in the root watcher area (the sorters
  watcher flips, a searchTerm watcher resets), NEVER in mutators or dialogs. Rule-driven flips
  are counter-suppressed in the flag's own re-query watcher because the triggering mutation
  already schedules the query (queries read state at run time, so the flip is visible to it).
  In `applyUrlQuery` the rules are applied explicitly (the rule watchers are
  `hydratingFromUrl`-guarded), and a URL-carried `$relevance` is applied AFTER the sorter merge
  so the URL's explicit value wins.

### Resolved former open questions

1. Relevance as an explicit sort option ("Relevance" pseudo-column / config-dialog entry):
   **deferred** — not needed for the fix; users switch back by sorting (flips the flag) or via
   the v-model.
2. Server tiebreaker (stable secondary sort after score for deterministic pagination): a
   **moost-db concern, out of scope here**.
3. A user sorter set during a search **persists** after the search clears; a new search
   re-suppresses it (flag resets to default at session start).
4. `forceSorters` are **always emitted**, search or not — embed-owner intent overrides
   relevance.

## Downstream workaround to revert once this ships

In the consumer app, `defaultSorters` were REMOVED from its three searchable grids, each with
a comment pointing at this trade-off.
Once preset-suppression lands, those grids should get their browse orders back
(`-_id` / `-lastSeenAt` / `make,model asc`).

Related but separate knob (already handled downstream, no upstream action): the `fuzzy` arg on
`@db.mongo.search.static` was dropped 1→0 on those indexes — fuzzy 1's weak single-token tail is
what made the mis-ordering look so broken, but the tail is harmless once relevance ranks it to
the bottom.
