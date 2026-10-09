import { computed, inject, isProxy, isRef, ref, toRaw, watch, type ComputedRef } from "vue";
import {
  buildFormDiff,
  buildFormRebase,
  collectDirtyPaths,
  deepClone,
  getByPath,
  setByPath,
  unionVariantChanged,
  type FormDef,
  type FormDiffOptions,
  type FormFieldChange,
  type FormRebaseOptions,
} from "@atscript/ui";
import { FORM_PATCH_KEY } from "./internal-keys";

/**
 * Result of {@link AsFormPatchHandle.rebaseOnto}. Aliases the `@atscript/ui`
 * rebase shape (minus `next`, which is written into the live container rather
 * than returned): the surviving local diff on top of the NEW baseline plus the
 * conflict paths.
 */
export interface RebaseOntoResult {
  /** Paths changed on both sides to different values, plus ancestor-clear paths. */
  conflicts: string[];
  /** Local edits that survive on top of the new (upstream) baseline. */
  reapplied: FormFieldChange[];
}

/**
 * Change-tracking handle for a single `<AsForm>`. Exposed three ways:
 *
 * 1. injected via {@link useAsFormPatch} inside any descendant component,
 * 2. spread into every `<AsForm>` slot (`isDirty` / `changes` / `getPatch` /
 *    `getChanges` — so a footer slot can gate a Save button), and
 * 3. `defineExpose`d on `<AsForm>` (so a parent template ref can call
 *    `asForm.value.getPatch()`).
 *
 * Built on `@atscript/ui`'s `buildFormDiff`, which diffs the form's CURRENT
 * data against a BASELINE snapshot and produces both a per-field change list
 * and an `@atscript/db` patch object (keyed-array `$update`/`$insert`/`$remove`,
 * `$cas` optimistic-concurrency sibling, revert-aware).
 */
export interface AsFormPatchHandle {
  /**
   * Reactive dirtiness — `true` when current data differs from the baseline.
   * Revert-aware: a value edited back to its baseline flips this back to
   * `false`. Memoised by Vue; recomputes only when the form data changes.
   */
  isDirty: ComputedRef<boolean>;
  /**
   * Reactive per-field change list (revert-aware — reverted fields drop out).
   * `before` / `after` hold live references into the baseline / current data.
   */
  changes: ComputedRef<FormFieldChange[]>;
  /**
   * Builds the `@atscript/db` patch object on demand against the baseline
   * snapshot. Safe to call at submit time (a fresh re-snapshot point). Returns
   * `{}` when nothing changed. Carries a top-level `$cas` sibling when the form
   * has a `@db.column.version` column and `opts.cas` is on (default).
   */
  getPatch: (opts?: FormDiffOptions) => Record<string, unknown>;
  /** Builds the per-field change list on demand (same data as `changes`). */
  getChanges: () => FormFieldChange[];
  /**
   * Reactive per-field dirty predicate. `true` when the field at the dot-path
   * `path` differs from the baseline. Reads the reactive {@link changes} list,
   * so a per-field `isDirty` derived from this recomputes whenever the change
   * list does.
   *
   * Granularity matches the change list (leaf-grained for scalars/objects,
   * WHOLE-ARRAY for arrays): a field is dirty iff some change path equals
   * `path` OR starts with `path + "."`. Object/section containers light up via
   * the prefix branch; whole-array fields via exact match; an array-ITEM leaf
   * (e.g. `items.0.qty`) returns `false` (the array container lights up
   * instead — a known, documented limitation of the array diff). The empty
   * root path `''` is dirty iff there are ANY changes. Backed by an O(1)
   * `Set.has` against `@atscript/ui`'s `collectDirtyPaths` precompute, whose
   * membership matches `isPathDirty` exactly (locked by an invariant test).
   */
  isDirtyPath: (path: string) => boolean;
  /**
   * Re-baseline to the current data. Call after a successful save so the form
   * becomes clean again WITHOUT a remount. No-op when tracking is inactive.
   */
  rebase: () => void;
  /**
   * 3-way rebase onto a fresh upstream snapshot. Sets the baseline to
   * `upstream` and rewrites the live form to `upstream` + the local diff
   * (current vs. old baseline) reapplied on top:
   *
   * - fields the user never touched adopt `upstream`'s value,
   * - local edits survive,
   * - fields changed on both sides to a different value are conflicts, resolved
   *   by `opts.conflict` (`'ours'` default keeps local, `'theirs'` takes
   *   upstream).
   *
   * `upstream` is the WRAPPED form-data container (`{ value }`). The live form
   * data is rewritten in a SINGLE mutation (the bound `:form-data` container
   * identity is preserved, so the consumer's ref stays the same object). After
   * the write the baseline becomes a deep clone of `upstream`, so a subsequent
   * `getPatch()` carries exactly the surviving local diff (`reapplied`).
   *
   * Returns the conflict paths and the surviving local diff. No-op returning
   * empty when tracking is inactive.
   */
  rebaseOnto: (upstream: Record<string, unknown>, opts?: FormRebaseOptions) => RebaseOntoResult;
}

/**
 * Internal factory invoked by `useAsForm` when `trackChanges` is enabled. Owns
 * the deep-clone baseline lifecycle:
 *
 * - captures a DEEP CLONE of the wrapped form-data the moment tracking becomes
 *   active (and, if data is not yet available, when it first arrives),
 * - re-captures automatically when the container's `value` is replaced by
 *   identity while the form is still CLEAN (since 0.1.134) — the fetch-then-fill
 *   `formData.value = row` on a form seeded with `createAsFormDef` defaults; a
 *   DIRTY swap keeps the old baseline and still needs an explicit rebase,
 * - re-baselines on `reset()` (the form's own reset path calls `rebase()`),
 * - exposes `rebase()` so a consumer can re-baseline after a successful save.
 *
 * The clone is mandatory: `buildFormDiff` keeps LIVE references into the
 * supplied baseline, so a shared reference would be mutated by subsequent
 * edits and the diff would always come back empty.
 *
 * Reactivity: a single revert-aware `diff` computed drives `isDirty` /
 * `changes`. It subscribes to EVERY leaf of the live data (one tracking walk,
 * like a deep watch, but synchronous and only when read) — so any leaf
 * mutation re-evaluates it, including the leaves of a freshly-inserted keyed
 * row that `buildFormDiff` pushes by reference without reading — and then
 * diffs the RAW data, so the diff walk itself pays no proxy overhead. The
 * change list still carries the live reactive `after` references. OFF stays
 * zero-cost: `createAsFormPatch` is never called when tracking is disabled.
 * It recomputes only when the live data or the baseline (`baselineRev`)
 * changes, and Vue caches the result between reads. The dirty-path closure
 * keeps its identity while its membership is unchanged, so per-field
 * `isDirty` computeds re-run only when a field actually flips.
 *
 * @param def       getter for the form's `FormDef`
 * @param getData   getter for the WRAPPED form-data container `{ value }`. Before
 *                  real domain data arrives `useAsForm` yields the empty internal
 *                  fallback `{}` (no `value` key); the tracker treats that as
 *                  "no data yet" and defers the baseline until a `{ value: … }`
 *                  container appears (the fetch-then-fill flow). The SAME
 *                  container reference is also the write target for
 *                  `rebaseOnto` — mutating its `.value` preserves the bound
 *                  `:form-data` identity so the deep watch fires once.
 * @param onRebased optional callback fired AFTER `rebaseOnto` rewrites the live
 *                  data, so the host can force-remount the field subtree (e.g.
 *                  bump a key) when a union variant changed — the variant picker
 *                  detects its index once at setup and won't re-detect on a
 *                  data swap. No-op for `rebase()` (which doesn't move data).
 */
export function createAsFormPatch(
  def: () => FormDef,
  getData: () => Record<string, unknown>,
  onRebased?: () => void,
): AsFormPatchHandle {
  // Deep-clone baseline snapshot. `undefined` until real (wrapped) data first
  // becomes available (async form data). A revision counter bumps the dependent
  // computeds whenever the baseline is (re)captured.
  let baseline: Record<string, unknown> | undefined;
  const baselineRev = ref(0);

  /**
   * Deep-clones the current wrapped container, or returns `undefined` when no
   * real domain data exists yet. "No data yet" = the container has no `value`
   * key or its `value` is `undefined` (the `{}` internal fallback, or a
   * `:form-data` ref that has not resolved). Capturing the empty fallback as the
   * baseline would make every field read as dirty once real data replaces it,
   * so we wait for a genuine `{ value: … }` container.
   */
  function snapshot(): Record<string, unknown> | undefined {
    const cur = getData();
    if (cur.value === undefined) return undefined;
    return deepClone(cur, toRaw) as Record<string, unknown>;
  }

  function capture(): void {
    baseline = snapshot();
    baselineRev.value++;
  }

  // Capture immediately if real data is already present; otherwise wait for the
  // first `{ value: … }` container (fetch-then-fill `:form-data`). Watch the
  // wrapped `value` so we react when an external ref resolves from
  // `undefined`/`{}` to a real container.
  //
  // Since 0.1.134 the same watcher also re-captures when the container's
  // `value` is REPLACED BY IDENTITY while the form is still CLEAN — the
  // `formData.value = row` that follows a fetch on a form seeded by
  // `createAsFormDef` (whose defaults object is a perfectly real `{ value: … }`
  // container, so the deferred branch above never applies). A clean swap is
  // unambiguously a new baseline: there is nothing the user typed that adopting
  // it could lose, and keeping the defaults baseline would mark every field
  // dirty and turn the first `getPatch()` into a whole-row write. A DIRTY swap
  // stays ambiguous (local edits must be preserved or dropped deliberately) and
  // still requires an explicit `rebase()` / `rebaseOnto()`.
  //
  // Dirtiness is measured against the PREVIOUS container contents, not the live
  // ones: by the time the callback runs the new value is already in place, and
  // diffing that against the old baseline would report "dirty" for exactly the
  // swap we are trying to absorb. `flush: 'sync'` keeps the new baseline
  // observable to a `getPatch()` issued in the same tick as the assignment.
  capture();
  watch(
    () => getData().value,
    (next, prev) => {
      if (next === prev) return;
      if (baseline === undefined) {
        capture();
        return;
      }
      // Clean swap → adopt. Dirty swap → keep the baseline (and the edits).
      if (prev !== undefined && buildFormDiff(def(), baseline, { value: prev }).isDirty) return;
      capture();
    },
    { flush: "sync" },
  );

  // Revert-aware reactive diff. It depends on every leaf of the live data
  // (`trackDeep` — the same walk a deep watch does, but synchronous, so a read
  // right after a mutation is never stale), on `baselineRev` (so a `rebase()`
  // re-evaluates) and on `def()`. The diff itself runs on the RAW data: the
  // subscription is already complete, so walking proxies again would only add
  // overhead.
  const diff = computed(() => {
    void baselineRev.value; // re-run after a (re)capture
    // `baseline === undefined` is the single "no real data yet" sentinel — set
    // by `snapshot()` when the wrapped container has no `value`.
    if (baseline === undefined) {
      return { isDirty: false, changes: [] as FormFieldChange[] };
    }
    const data = getData();
    trackDeep(data);
    const result = buildFormDiff(def(), baseline, rawContainer(data));
    // `after` is a live reference into the current data — hand out the
    // reactive one, exactly as a diff over the live proxies would.
    const changes =
      result.changes.length === 0
        ? result.changes
        : result.changes.map((change) => ({ ...change, after: getByPath(data, change.path) }));
    return { isDirty: result.isDirty, changes };
  });

  const isDirty = computed(() => diff.value.isDirty);
  const changes = computed(() => diff.value.changes);

  // Precomputed prefix-closure of the change list (paths + ancestors + root).
  // Backs `isDirtyPath` with an O(1) `Set.has` instead of a per-call linear
  // prefix scan, so a form rendering one field per leaf no longer pays
  // O(fields × changes) per keystroke. Internal to the composable; not exposed
  // on the public handle. Memoised by Vue — rebuilt only when the change list
  // invalidates (`collectDirtyPaths` returns the same membership as
  // `isPathDirty`, locked by an `@atscript/ui` invariant test).
  //
  // Kept by identity while the membership is unchanged (the common keystroke
  // in an already-dirty field), so per-field `isDirty` computeds built on
  // `isDirtyPath` re-run only when some path actually flips.
  const dirtyPaths = computed<Set<string>>((prev) => {
    const next = collectDirtyPaths(changes.value);
    return prev !== undefined && sameMembers(prev, next) ? prev : next;
  });

  // On-demand builders — diff against a frozen RAW clone of the current data so
  // the returned patch/changes are de-aliased and proxy-free. `buildFormDiff`
  // returns LIVE references into its `current` argument ($insert items, $replace
  // arrays, whole-object SET sub-objects); building from the live reactive
  // container would let later edits mutate an already-returned patch and would
  // carry Vue reactive proxies onto the wire. Cloning `current` (the baseline is
  // already a clone) isolates the after-side. Safe to call at submit time. Empty
  // results when tracking has no baseline yet.
  function getPatch(opts?: FormDiffOptions): Record<string, unknown> {
    if (baseline === undefined) return {};
    const frozen = deepClone(getData(), toRaw);
    return buildFormDiff(def(), baseline, frozen, opts).patch;
  }

  function getChanges(): FormFieldChange[] {
    if (baseline === undefined) return [];
    const frozen = deepClone(getData(), toRaw);
    return buildFormDiff(def(), baseline, frozen).changes;
  }

  // O(1) membership against the precomputed dirty-path closure. Reads the
  // REACTIVE `dirtyPaths` computed so a per-field `isDirty` built on this
  // re-evaluates whenever the change list invalidates. The closure is built by
  // `@atscript/ui`'s `collectDirtyPaths` — the prefix logic is never
  // reimplemented here, and `dirtyPaths.has(p) === isPathDirty(changes, p)` for
  // every `p` (locked by an `@atscript/ui` invariant test).
  function isDirtyPath(path: string): boolean {
    return dirtyPaths.value.has(path);
  }

  function rebase(): void {
    capture();
  }

  /**
   * 3-way rebase onto a fresh upstream snapshot (see
   * {@link AsFormPatchHandle.rebaseOnto}). One reactive write, then an explicit
   * re-baseline to the upstream snapshot.
   */
  function rebaseOnto(
    upstream: Record<string, unknown>,
    opts?: FormRebaseOptions,
  ): RebaseOntoResult {
    // De-proxy the upstream container so the merge + baseline are proxy-free.
    const u = deepClone(upstream, toRaw) as Record<string, unknown>;

    // Fetch-then-fill defer: no baseline yet → adopt upstream wholesale and let
    // the deferred-capture watcher (or an explicit capture) baseline it. No
    // local diff exists to reapply, so there are no conflicts and nothing
    // reapplied.
    if (baseline === undefined) {
      const before = deepClone(getData(), toRaw) as Record<string, unknown>;
      setByPath(getData(), "", u.value);
      // The data swap may have landed a different union variant — force-remount.
      if (unionVariantChanged(def(), before, u)) onRebased?.();
      // If real data is now present, baseline it immediately (the deferred
      // watcher also covers the async case where `getData()` is still empty).
      capture();
      return { conflicts: [], reapplied: [] };
    }

    // Normal 3-way merge. Diff the LIVE current against the OLD baseline,
    // reapply onto a clone of upstream. Same diffOptions the tracker uses for
    // its own change list (default `buildFormDiff` opts — version-column / $cas
    // exclusion already baked into the engine).
    const current = deepClone(getData(), toRaw) as Record<string, unknown>;
    const { next, conflicts, reapplied } = buildFormRebase(def(), baseline, current, u, opts);

    // Did any union path land a different variant? Compare `next` against the
    // live `current` — the picker's setup-time index reflects the last-committed
    // (current) data, so a difference there is exactly when it would show a stale
    // variant after the write. Detect BEFORE the write.
    const variantMoved = unionVariantChanged(def(), current, next);

    // SINGLE reactive write — preserve the bound container identity so the
    // consumer's `:form-data` ref stays the same object and the deep watch fires
    // once. `next.value` is already a fresh, proxy-free deep clone.
    setByPath(getData(), "", next.value);

    // Re-baseline EXPLICITLY to the upstream snapshot — NOT `capture()`, which
    // would snapshot the live container (now holding `next`) and make the
    // reapplied edits read clean. Assigning `u` directly (no extra clone) is safe:
    // live edits mutate `next.value` — a SEPARATE deep clone — never `u`; and the
    // only references shared into `u` are `reapplied[].before`, which alias the
    // baseline exactly like `changes[].before` do (the same read-only contract),
    // so an extra clone buys nothing.
    baseline = u;
    baselineRev.value++;

    // A landed union variant won't re-detect on a data swap — force-remount the
    // field subtree only when one actually moved (avoid disrupting focus/scroll
    // on the common no-variant-change rebase).
    if (variantMoved) onRebased?.();

    return { conflicts, reapplied };
  }

  return { isDirty, changes, getPatch, getChanges, isDirtyPath, rebase, rebaseOnto };
}

/**
 * Subscribes the running effect to every leaf reachable from `value` — the
 * walk Vue's deep watch performs (refs, arrays, Map/Set, plain objects;
 * `markRaw` values skipped).
 */
function trackDeep(value: unknown, seen: Set<unknown> = new Set()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  if ((value as Record<string, unknown>).__v_skip) return;
  seen.add(value);
  if (isRef(value)) {
    trackDeep(value.value, seen);
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) trackDeep(value[i], seen);
  } else if (value instanceof Set || value instanceof Map) {
    value.forEach((v: unknown) => trackDeep(v, seen));
  } else if (isPlainObjectLike(value)) {
    for (const key in value) trackDeep((value as Record<string, unknown>)[key], seen);
    for (const key of Object.getOwnPropertySymbols(value)) {
      if (Object.prototype.propertyIsEnumerable.call(value, key)) {
        trackDeep((value as Record<symbol, unknown>)[key], seen);
      }
    }
  }
}

function isPlainObjectLike(value: object): boolean {
  return Object.prototype.toString.call(value) === "[object Object]";
}

/** The wrapped container with its domain value de-proxied. */
function rawContainer(data: Record<string, unknown>): Record<string, unknown> {
  const raw = toRaw(data);
  return isProxy(raw.value) ? { ...raw, value: toRaw(raw.value) } : raw;
}

function sameMembers(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
}

// ── Public reader ────────────────────────────────────────────

const NOT_TRACKING_MSG =
  "useAsFormPatch(): change tracking is not enabled on this form. Pass `track-changes` " +
  "to <AsForm> (or `trackChanges: true` to useAsForm).";

/**
 * Reactive read-only access to the form's change-tracking handle from any
 * descendant of an `<AsForm track-changes>`. Mirrors the `useAsData` /
 * `useAsPath` injector pattern.
 *
 * THROWS when called outside a form, or inside a form that did not enable
 * `track-changes` — fail loud rather than silently report "not dirty".
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useAsFormPatch } from "@atscript/vue-form";
 * const { isDirty, getPatch } = useAsFormPatch();
 * </script>
 * <template>
 *   <button :disabled="!isDirty" @click="save(getPatch())">Save</button>
 * </template>
 * ```
 */
export function useAsFormPatch(): AsFormPatchHandle {
  const handle = inject(FORM_PATCH_KEY, undefined);
  if (!handle) throw new Error(NOT_TRACKING_MSG);
  return handle;
}
