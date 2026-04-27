import { ref, type Ref } from "vue";
import type { MainActionRequest } from "../../types";

type Row = Record<string, unknown>;

export interface MainActionRegistry {
  hasMainActionListener: Ref<boolean>;
  registerMainActionListener: (cb: (req: MainActionRequest) => void) => () => void;
  requestMainAction: (event: KeyboardEvent | MouseEvent) => void;
}

export function createMainActionRegistry(
  getActiveIndex: () => number,
  getActiveRow: () => Row | undefined,
): MainActionRegistry {
  const listeners = new Set<(req: MainActionRequest) => void>();
  const hasMainActionListener = ref(false);

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
    if (listeners.size === 0) return;
    const abs = getActiveIndex();
    if (abs < 0) return;
    const row = getActiveRow();
    if (row === undefined) return;
    const req: MainActionRequest = { row, absIndex: abs, event };
    for (const cb of listeners) cb(req);
  }

  return { hasMainActionListener, registerMainActionListener, requestMainAction };
}
