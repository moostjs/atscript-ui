import { computed, ref, type ComputedRef, type Ref } from "vue";
import type { MainActionRequest, TVueTableActionInfo } from "../../types";

type Row = Record<string, unknown>;

export interface MainActionRegistry {
  hasMainActionListener: Ref<boolean>;
  /**
   * True when `requestMainAction` will do something — either a listener is
   * registered or `actions.default.row` is defined for the fallback path.
   * Read by the Enter-key handler in the nav controller so keyboard
   * activation routes through the same fallback as click.
   */
  hasMainActionAvailable: ComputedRef<boolean>;
  registerMainActionListener: (cb: (req: MainActionRequest) => void) => () => void;
  requestMainAction: (event: KeyboardEvent | MouseEvent) => void;
}

export interface CreateMainActionRegistryOpts {
  getActiveIndex: () => number;
  getActiveRow: () => Row | undefined;
  /** The table's default row action — decides whether a fallback exists at all. */
  getDefaultRowAction?: () => TVueTableActionInfo | undefined;
  /**
   * Run the fallback for `row`. The orchestrator resolves the row's own
   * default (it may be gated or policy-excluded for that row) — see
   * `use-table-state.ts`.
   */
  invokeFallback?: (row: Row, event: KeyboardEvent | MouseEvent) => void;
}

/**
 * Listener registry for the `main-action` event. When listeners are present,
 * `requestMainAction` builds a `MainActionRequest` and dispatches it. When no
 * listener is registered and the table declares a default row action, it
 * hands the active row to `invokeFallback`. The fallback path SHALL NOT
 * construct a `MainActionRequest` payload — there is nothing to receive it.
 */
export function createMainActionRegistry(opts: CreateMainActionRegistryOpts): MainActionRegistry {
  const listeners = new Set<(req: MainActionRequest) => void>();
  const hasMainActionListener = ref(false);
  const hasMainActionAvailable = computed(
    () => hasMainActionListener.value || opts.getDefaultRowAction?.() !== undefined,
  );

  function registerMainActionListener(cb: (req: MainActionRequest) => void): () => void {
    listeners.add(cb);
    hasMainActionListener.value = listeners.size > 0;
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      listeners.delete(cb);
      hasMainActionListener.value = listeners.size > 0;
    };
  }

  function requestMainAction(event: KeyboardEvent | MouseEvent): void {
    const abs = opts.getActiveIndex();
    if (abs < 0) return;
    const row = opts.getActiveRow();
    if (row === undefined) return;

    if (listeners.size > 0) {
      const req: MainActionRequest = { row, absIndex: abs, event };
      for (const cb of listeners) cb(req);
      return;
    }

    if (opts.invokeFallback && opts.getDefaultRowAction?.()) {
      opts.invokeFallback(row, event);
    }
  }

  return {
    hasMainActionListener,
    hasMainActionAvailable,
    registerMainActionListener,
    requestMainAction,
  };
}
