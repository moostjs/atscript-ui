import { onBeforeUnmount } from "vue";

/**
 * Coalesce a high-frequency stream of values into one rAF-tick callback.
 * Pointermove / wheel can fire at >120Hz; without batching, each native event
 * fans out reactive updates and re-runs downstream computeds + watchers.
 *
 * `schedule(value)` overwrites the pending value and arms a rAF if none is in
 * flight. `flushNow()` runs the callback synchronously with whatever is pending
 * (used at gesture-end so the final value isn't dropped). Auto-cancels on
 * scope dispose.
 */
export function useRafBatch<T>(onFlush: (value: T) => void) {
  let pending: T | null = null;
  let hasPending = false;
  let rafId = 0;

  function flush() {
    rafId = 0;
    if (!hasPending) return;
    const value = pending as T;
    pending = null;
    hasPending = false;
    onFlush(value);
  }

  function schedule(value: T) {
    pending = value;
    hasPending = true;
    if (rafId !== 0) return;
    rafId = requestAnimationFrame(flush);
  }

  function flushNow() {
    if (rafId !== 0) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    flush();
  }

  function cancel() {
    if (rafId !== 0) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    pending = null;
    hasPending = false;
  }

  onBeforeUnmount(cancel);

  return { schedule, flushNow, cancel };
}
