import { ref, shallowRef, watch, type Ref, type ShallowRef } from "vue";
import {
  blockStartFor,
  debounce,
  pageAlignedBlocksFor,
  planFetch,
  walkBackwardAbsorb,
  walkForwardAbsorb,
  type FetchPlan,
} from "@atscript/ui-table";
import type { PageResult } from "@atscript/db-client";
import type { TableDef } from "@atscript/ui";
import type { Uniquery } from "@uniqu/core";
import type { QueryErrorKind } from "../../types";

type Row = Record<string, unknown>;

type Settlement =
  | { kind: "ok"; gen: number; firstIndex: number; rows: Row[]; count: number }
  | { kind: "err"; gen: number; firstIndex: number; error: Error; sourceKind: QueryErrorKind };

export interface WindowFetcherInputs {
  blockSize: number;
  dragReleaseDebounceMs: number;
  tableDef: ShallowRef<TableDef | null>;
  totalCount: Ref<number>;
  results: ShallowRef<Row[]>;
  resultsStart: Ref<number>;
  queryingNext: Ref<boolean>;
  getGeneration: () => number;
  isQueryBlocked: () => boolean;
  buildCurrentQuery: () => Uniquery;
  dispatchPages: (query: Uniquery, page: number, size: number) => Promise<PageResult<Row>>;
  reportError: (error: Error, kind: QueryErrorKind) => void;
}

export interface WindowFetcher {
  windowCache: ShallowRef<Map<number, Row>>;
  windowLoading: ShallowRef<Set<number>>;
  errors: ShallowRef<Map<number, Error>>;
  topIndex: Ref<number>;
  viewportRowCount: Ref<number>;
  dataAt: (absIdx: number) => Row | undefined;
  loadingAt: (absIdx: number) => boolean;
  errorAt: (absIdx: number) => Error | null;
  loadRange: (skip: number, limit: number) => Promise<void>;
  queryNext: () => void;
  /** Drop any settlements still in the queue. Called by `runQuery` before
   * dispatching so any in-flight blocks for the prior generation can't
   * leak into the new cache when their settlements arrive late. The
   * generation bump in `runQuery` already prevents that, but draining the
   * queue keeps memory tidy. Does NOT touch `windowCache`/`windowLoading`/
   * `errors` — those stay visible mid-flight so users see the prior data
   * until the new response lands. */
  clearSettlements: () => void;
  /** Wipe the windowed cache + per-block loading/error state + settlements.
   * Called by `invalidate`. */
  resetWindow: () => void;
  /** Cancel pending debounced viewport dispatches. Called by orchestrator's
   * `onScopeDispose`. */
  disposeDebounces: () => void;
}

export function createWindowFetcher(inputs: WindowFetcherInputs): WindowFetcher {
  const {
    blockSize,
    dragReleaseDebounceMs,
    tableDef,
    totalCount,
    results,
    resultsStart,
    queryingNext,
    getGeneration,
    isQueryBlocked,
    buildCurrentQuery,
    dispatchPages,
    reportError,
  } = inputs;

  const windowCache = shallowRef<Map<number, Row>>(new Map());
  /** Per-block firstIndex values currently in flight. `loadingAt(absIdx)`
   * derives membership via `blockStartFor(absIdx, blockSize)`. */
  const windowLoading = shallowRef<Set<number>>(new Set());
  // Per-block errors keyed by `block.firstIndex`. shallowRef so reactive readers
  // (`errorAt` inside computeds) re-run on retry success / new failure.
  const errors = shallowRef<Map<number, Error>>(new Map());
  const topIndex = ref(0);
  const viewportRowCount = ref(0);

  // Coalesce per-block settlements: with M parallel blocks landing in the
  // same microtask, one Map/Set clone replaces M independent clones.
  const settlements: Settlement[] = [];
  let flushScheduled = false;

  function flushSettlements() {
    flushScheduled = false;
    if (settlements.length === 0) return;
    const currentGen = getGeneration();
    let applied = false;
    let nextCache = windowCache.value;
    let nextLoading = windowLoading.value;
    let nextErrors = errors.value;
    let totalCountChanged = false;
    let nextTotal = totalCount.value;

    for (const s of settlements) {
      if (s.gen !== currentGen) continue;
      if (!applied) {
        applied = true;
        nextCache = new Map(windowCache.value);
        nextLoading = new Set(windowLoading.value);
        nextErrors = new Map(errors.value);
      }
      nextLoading.delete(s.firstIndex);
      if (s.kind === "ok") {
        for (let i = 0; i < s.rows.length; i++) nextCache.set(s.firstIndex + i, s.rows[i]);
        nextErrors.delete(s.firstIndex);
        nextTotal = s.count;
        totalCountChanged = true;
      } else {
        nextErrors.set(s.firstIndex, s.error);
        reportError(s.error, s.sourceKind);
      }
    }
    settlements.length = 0;

    if (!applied) return;

    windowCache.value = nextCache;
    windowLoading.value = nextLoading;
    errors.value = nextErrors;
    if (totalCountChanged && nextTotal !== totalCount.value) totalCount.value = nextTotal;

    const fwd = walkForwardAbsorb(results.value, resultsStart.value, nextCache);
    const bwd = walkBackwardAbsorb(fwd.newResults, fwd.newResultsStart, nextCache);
    if (bwd.newResults !== results.value) {
      results.value = bwd.newResults;
      resultsStart.value = bwd.newResultsStart;
    }
  }

  function scheduleFlush() {
    if (flushScheduled) return;
    flushScheduled = true;
    queueMicrotask(flushSettlements);
  }

  function loadRangeInternal(skip: number, limit: number, kind: QueryErrorKind): Promise<void> {
    if (isQueryBlocked()) return Promise.resolve();

    const blocks = pageAlignedBlocksFor(skip, limit, blockSize);
    if (blocks.length === 0) return Promise.resolve();

    const cache = windowCache.value;
    const loading = windowLoading.value;
    const missing: typeof blocks = [];
    for (const b of blocks) {
      if (loading.has(b.firstIndex)) continue;
      const end = b.firstIndex + blockSize;
      for (let idx = b.firstIndex; idx < end; idx++) {
        if (!cache.has(idx)) {
          missing.push(b);
          break;
        }
      }
    }
    if (missing.length === 0) return Promise.resolve();

    const thisGen = getGeneration();
    const baseQuery = buildCurrentQuery();

    // Mark blocks as in-flight and clear any prior error so the cell renders
    // as a fresh skeleton instead of a permanent "errored" tile on retry.
    const nextLoading = new Set(windowLoading.value);
    const prevErrors = errors.value;
    let nextErrors = prevErrors;
    let errorsChanged = false;
    for (const b of missing) {
      nextLoading.add(b.firstIndex);
      if (prevErrors.has(b.firstIndex)) {
        if (!errorsChanged) {
          nextErrors = new Map(prevErrors);
          errorsChanged = true;
        }
        nextErrors.delete(b.firstIndex);
      }
    }
    windowLoading.value = nextLoading;
    if (errorsChanged) errors.value = nextErrors;

    const promises = missing.map(async (b) => {
      try {
        const { data, count } = await dispatchPages(baseQuery, b.page, blockSize);
        if (thisGen !== getGeneration()) return;
        settlements.push({
          kind: "ok",
          gen: thisGen,
          firstIndex: b.firstIndex,
          rows: data as Row[],
          count,
        });
        scheduleFlush();
      } catch (err) {
        if (thisGen !== getGeneration()) return;
        const error = err instanceof Error ? err : new Error(String(err));
        settlements.push({
          kind: "err",
          gen: thisGen,
          firstIndex: b.firstIndex,
          error,
          sourceKind: kind,
        });
        scheduleFlush();
      }
    });

    return Promise.allSettled(promises).then(() => undefined);
  }

  function loadRange(skip: number, limit: number): Promise<void> {
    return loadRangeInternal(skip, limit, "loadRange");
  }

  function queryNext(): void {
    if (queryingNext.value) return;
    if (isQueryBlocked()) return;
    queryingNext.value = true;
    const skip = resultsStart.value + results.value.length;
    void loadRangeInternal(skip, blockSize, "queryNext").finally(() => {
      queryingNext.value = false;
    });
  }

  function dataAt(absIdx: number): Row | undefined {
    return windowCache.value.get(absIdx);
  }
  function loadingAt(absIdx: number): boolean {
    if (blockSize <= 0) return false;
    return windowLoading.value.has(blockStartFor(absIdx, blockSize));
  }
  function errorAt(absIdx: number): Error | null {
    if (blockSize <= 0) return null;
    return errors.value.get(blockStartFor(absIdx, blockSize)) ?? null;
  }

  function clearSettlements(): void {
    settlements.length = 0;
  }
  function resetWindow(): void {
    settlements.length = 0;
    windowCache.value = new Map();
    windowLoading.value = new Set();
    errors.value = new Map();
  }

  // Viewport watcher — gates on tableDef (not queryDetected) because a window-mode
  // renderer's mount-time ResizeObserver may write `viewportRowCount` before
  // auto-bootstrap fires. `jump` plans debounce on the user's drag-release settle
  // position; `steady` plans dispatch immediately and rely on cache+in-flight dedupe.
  let pendingJumpPlan: FetchPlan | null = null;
  const debouncedJumpDispatch = debounce(() => {
    const plan = pendingJumpPlan;
    pendingJumpPlan = null;
    if (plan) void loadRange(plan.skip, plan.limit);
  }, dragReleaseDebounceMs);
  const prefetchBuffer = Math.max(1, Math.floor(blockSize / 4));

  watch([() => topIndex.value, () => viewportRowCount.value], () => {
    if (tableDef.value === null) return;
    if (viewportRowCount.value <= 0) return;
    const plan = planFetch({
      top: topIndex.value,
      viewport: viewportRowCount.value,
      totalCount: totalCount.value,
      cache: windowCache.value,
      blockSize,
      buffer: prefetchBuffer,
    });
    if (plan === null) return;
    if (plan.mode === "jump") {
      pendingJumpPlan = plan;
      debouncedJumpDispatch();
    } else {
      // The block-keyed loading set already dedupes in `loadRangeInternal`,
      // but bailing here also avoids rebuilding `baseQuery` on every tick.
      if (windowLoading.value.has(blockStartFor(plan.skip, blockSize))) return;
      void loadRange(plan.skip, plan.limit);
    }
  });

  function disposeDebounces(): void {
    debouncedJumpDispatch.cancel();
  }

  return {
    windowCache,
    windowLoading,
    errors,
    topIndex,
    viewportRowCount,
    dataAt,
    loadingAt,
    errorAt,
    loadRange,
    queryNext,
    clearSettlements,
    resetWindow,
    disposeDebounces,
  };
}
