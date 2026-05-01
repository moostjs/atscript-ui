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
  /** Fallback target when no `@main-action` listener is registered. */
  getDefaultRowAction?: () => TVueTableActionInfo | undefined;
  /** Invoke the fallback action — orchestrator routes to `state.actions.invoke`. */
  invokeFallback?: (
    action: TVueTableActionInfo,
    row: Row,
    event: KeyboardEvent | MouseEvent,
  ) => void;
}

/**
 * Listener registry for the `main-action` event. When listeners are present,
 * `requestMainAction` builds a `MainActionRequest` and dispatches it. When no
 * listener is registered, falls back to invoking `actions.default.row` against
 * the active row's PK (if both are defined). The fallback path SHALL NOT
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

    const fallback = opts.getDefaultRowAction?.();
    if (fallback && opts.invokeFallback) {
      opts.invokeFallback(fallback, row, event);
    }
  }

  return {
    hasMainActionListener,
    hasMainActionAvailable,
    registerMainActionListener,
    requestMainAction,
  };
}
