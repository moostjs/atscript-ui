# Bug: filter-pill input commit drops the value AND double-fires `/pages` on tables with `forceFilters`

**Reporter context:** found while building `tests/e2e/b-filtering/section-4-pill-interactions.spec.ts` for Scenario 4.5 ("user filter ANDs with the forced filter") on the `/orders-cancelled` route.

**Status:** open. Reproduces deterministically. Worked around in the e2e batch by switching the test to a value-help-backed pill (Customer FK) instead of a free-text/numeric pill (Total).

## Repro

The `vue-demo` `/orders-cancelled` route declares `forceFilters: { status: 'cancelled' }`. Steps in the browser, signed in as `admin`:

1. Visit `/orders-cancelled`. Wait for the initial `/pages?...&status='cancelled'` to settle.
2. Open the toolbar Filters dialog → tick `Total` → Apply. (No query yet — adding a pill without a value must not fire one. Confirmed.)
3. Click the new Total pill's input. Type `>100`. Press Enter.

**Expected**

- Exactly ONE `/pages?...&status='cancelled'&total>100` after the 500 ms debounce (the Conventions baseline).
- `state.filters.value` contains both predicates.
- The chip strip on the pill renders the typed value.

**Observed**

- TWO identical `/pages?...&status='cancelled'` requests fire (NO `total>100` predicate in either URL).
- `state.filters.value` does not gain the `total` predicate.
- The pill's input clears but no chip renders.

The repro is consistent across runs. Switching to a Customer pill (which goes through the value-help dropdown / FK path instead of free-text commit) works correctly: one query, the predicate AND-merges with the forced filter, the chip renders.

## What's known

- Both observed `/pages` requests carry only `status='cancelled'` — exactly the forced filter, exactly what the initial fetch carried. The user's input never reaches `state.filters`.
- Two requests, not one. Whatever path commits the input is also tripping the query-watcher twice, OR the second request is the natural debounced re-issue of the first.
- The bug does NOT reproduce on the same Total pill via:
  - The per-column filter dialog (F4 → enter value → Apply).
  - The value-help dropdown on a different column (Customer ref pill works fine on the same route).
- It DOES reproduce with `<=200` and `10...50` inputs on Total, suggesting the issue is the operator-prefix parser + commit path, not specifically `>` syntax.

## Suspected surface area

The interaction is between three things that only collide on this combination:

1. `forceFilters` is non-empty on the route, so the initial query always carries a base predicate that the model didn't put there.
2. The pill's input commit path for free-text/numeric values (the `*foo` / `>X` / `bw` operator-inferring parser, somewhere under `packages/vue-table/src/composables/` — likely in the same path that powers `coerceValue` / the inline operator detection).
3. The root watcher that triggers `state.query()` on `state.filters` mutations (`use-table-query.ts`).

Hypothesis: the input commit pushes a transient state where `state.filters` is briefly modified (triggering one query) and then reverted (triggering a second query) — possibly because the operator-prefix parse rejects the typed value mid-flight, or because `forceFilters` and the user filter aren't merged at the right point and the user's predicate gets clobbered during merge.

But that's a guess. Bisection should start by:

- Logging every assignment to `state.filters` during the commit and observing whether one or two writes happen.
- Comparing the same commit path on `/orders` (no `forceFilters`) vs `/orders-cancelled` (with `forceFilters`). The bug only triggers on the latter.
- Checking whether `mergeFilters(forceFilters, userFilter)` in `packages/ui-table/src/query/build-table-query.ts:42` ever sees the user predicate at all in the failing flow (likely no — the predicate seems to never make it into `state.filters` in the first place).

## Why batch B worked around instead of fixing

The bug has a non-trivial blast radius (filter commit + query watcher + force-merge interaction) and the e2e batch was scoped to writing tests, not fixing impl bugs. The relevant test (Scenario 4.5 — user filter ANDs with forced filter) routes around it via the FK Customer pill, which exercises the same AND-merge contract through a different commit path. The contract is therefore covered; the bug is just one path to that contract that's broken.

When this is fixed, two changes are appropriate in the e2e suite:

- Add a regression covering the Total/free-text path on `/orders-cancelled`.
- Re-read the doc-vs-impl drift flagged in batch B's hand-off — Scenario 4.5's wording assumes any filter type works on a `forceFilters` route; the e2e currently asserts only the FK path.

## Suggested smallest first step

Stand up a focused unit test against `useTableState` (or the smallest layer that owns the input commit) with a fixture that:

- Mounts with `forceFilters: { status: 'cancelled' }`.
- Calls the same setter the pill input uses to commit `>100` on a `total` field.
- Asserts `state.filters.value` reflects the user predicate AND-merged.

That should bisect quickly to whether the issue is in:

- The input parser (returns no value),
- The state writer (drops the value), or
- The query builder / merge step (drops the value at merge time).

`packages/vue-table/src/__tests__/state-options.spec.ts` (which already covers the AND-merge contract via direct `state.filters` writes) is a good neighbour — the new unit test would exercise the COMMIT path that the existing one bypasses.
