import { computed, inject, ref, toRaw, watch, type ComputedRef } from "vue";
import {
  buildFormDiff,
  type FormDef,
  type FormDiffOptions,
  type FormFieldChange,
} from "@atscript/ui";
import { FORM_PATCH_KEY } from "./internal-keys";

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
   * Re-baseline to the current data. Call after a successful save so the form
   * becomes clean again WITHOUT a remount. No-op when tracking is inactive.
   */
  rebase: () => void;
}

/**
 * Internal factory invoked by `useAsForm` when `trackChanges` is enabled. Owns
 * the deep-clone baseline lifecycle:
 *
 * - captures a DEEP CLONE of the wrapped form-data the moment tracking becomes
 *   active (and, if data is not yet available, when it first arrives),
 * - re-baselines on `reset()` (the form's own reset path calls `rebase()`),
 * - exposes `rebase()` so a consumer can re-baseline after a successful save.
 *
 * The clone is mandatory: `buildFormDiff` keeps LIVE references into the
 * supplied baseline, so a shared reference would be mutated by subsequent
 * edits and the diff would always come back empty.
 *
 * Reactivity: a single revert-aware `diff` computed drives `isDirty` /
 * `changes`. `buildFormDiff` reads most reactive leaves of the live container
 * (via `getByPath` + the `deepEqual` walk), so the computed auto-tracks scalar
 * edits, nested-object edits, and `$update` edits to EXISTING keyed-array items.
 * But the `$insert` branch pushes a freshly-added (not-yet-saved) keyed-array
 * element BY REFERENCE without reading its leaves, so editing such a row's
 * non-key leaves (qty/description) would NOT invalidate the computed. To close
 * that blind spot we add a single deep `watch` on the live data — created ONLY
 * when tracking is active, owned by the component scope (it disposes on unmount)
 * — that bumps `dataRev`; the `diff` computed reads `dataRev` so every leaf
 * mutation, including an inserted row's, re-evaluates it. OFF stays zero-cost:
 * `createAsFormPatch` is never called when tracking is disabled, so neither the
 * baseline nor this watcher is ever created. It recomputes only when the live
 * data (`dataRev`) or the baseline (`baselineRev`) changes, and Vue caches the
 * result between reads.
 *
 * @param def      getter for the form's `FormDef`
 * @param getData  getter for the WRAPPED form-data container `{ value }`. Before
 *                 real domain data arrives `useAsForm` yields the empty internal
 *                 fallback `{}` (no `value` key); the tracker treats that as
 *                 "no data yet" and defers the baseline until a `{ value: … }`
 *                 container appears (the fetch-then-fill flow).
 */
export function createAsFormPatch(
  def: () => FormDef,
  getData: () => Record<string, unknown>,
): AsFormPatchHandle {
  // Deep-clone baseline snapshot. `undefined` until real (wrapped) data first
  // becomes available (async form data). A revision counter bumps the dependent
  // computeds whenever the baseline is (re)captured.
  let baseline: Record<string, unknown> | undefined;
  const baselineRev = ref(0);
  // Bumped by the deep watch below on every leaf mutation. The `diff` computed
  // reads it so even an inserted keyed-array row's leaves (which `buildFormDiff`
  // pushes by reference WITHOUT reading) re-trigger the reactive change list.
  const dataRev = ref(0);

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
    return deepClone(toRaw(cur)) as Record<string, unknown>;
  }

  function capture(): void {
    baseline = snapshot();
    baselineRev.value++;
  }

  // Capture immediately if real data is already present; otherwise wait for the
  // first `{ value: … }` container (fetch-then-fill `:form-data`). Watch the
  // wrapped `value` so we react when an external ref resolves from
  // `undefined`/`{}` to a real container.
  capture();
  if (baseline === undefined) {
    const stop = watch(
      () => getData().value,
      () => {
        if (baseline !== undefined) return;
        capture();
        if (baseline !== undefined) stop();
      },
    );
  }

  // Deep dependency on the live form data. `buildFormDiff`'s read-walk covers
  // most leaves, but its keyed-array `$insert` branch pushes a freshly-inserted
  // row by reference WITHOUT reading the row's leaves — so editing that row's
  // non-key leaves would otherwise never invalidate the `diff` computed. This
  // watcher bumps `dataRev` on every mutation (inserted-row leaves included).
  // It is created ONLY here (i.e. only when tracking is active), and because
  // `createAsFormPatch` runs inside the component's setup scope, the watcher is
  // owned by that scope and disposes on unmount — OFF remains zero-overhead.
  watch(
    () => getData(),
    () => dataRev.value++,
    { deep: true },
  );

  // Revert-aware reactive diff. It depends on `dataRev` (bumped by the deep
  // watch on every leaf edit, including inserted-row leaves), `baselineRev` (so
  // a `rebase()` re-evaluates), and the leaves `buildFormDiff` reads directly.
  // It is revert-aware, so a value edited back to baseline yields
  // `isDirty === false`.
  const diff = computed(() => {
    void dataRev.value; // re-run on any leaf mutation (incl. inserted rows)
    void baselineRev.value; // re-run after a (re)capture
    // `baseline === undefined` is the single "no real data yet" sentinel — set
    // by `snapshot()` when the wrapped container has no `value`.
    if (baseline === undefined) {
      return { isDirty: false, changes: [] as FormFieldChange[] };
    }
    const result = buildFormDiff(def(), baseline, getData());
    return { isDirty: result.isDirty, changes: result.changes };
  });

  const isDirty = computed(() => diff.value.isDirty);
  const changes = computed(() => diff.value.changes);

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
    const frozen = deepClone(toRaw(getData()));
    return buildFormDiff(def(), baseline, frozen, opts).patch;
  }

  function getChanges(): FormFieldChange[] {
    if (baseline === undefined) return [];
    const frozen = deepClone(toRaw(getData()));
    return buildFormDiff(def(), baseline, frozen).changes;
  }

  function rebase(): void {
    capture();
  }

  return { isDirty, changes, getPatch, getChanges, rebase };
}

/**
 * Structural deep clone of plain JSON-ish data (objects / arrays / primitives /
 * Date). Used to freeze the baseline so later edits to the live form data don't
 * mutate it. `structuredClone` would throw on Vue proxies / functions; this
 * walks own-enumerable keys and copies leaves by value.
 */
function deepClone<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return new Date(value.getTime()) as unknown as T;
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (let i = 0; i < value.length; i++) out.push(deepClone(toRaw(value[i])));
    return out as unknown as T;
  }
  // Own-enumerable keys only (matches the own-key discipline in
  // `@atscript/ui/src/form/diff.ts`); never walk an accidental prototype.
  const src = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(src)) {
    out[k] = deepClone(toRaw(src[k]));
  }
  return out as T;
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
