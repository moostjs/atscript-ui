import { ref, watch, type Ref, type ShallowRef } from "vue";
import type { SelectionMode } from "@atscript/ui-table";
import type { EnterAction } from "../../types";

type Row = Record<string, unknown>;

export interface NavControllerInputs {
  /** Shared with selection + main-action: orchestrator owns the ref so all
   * four factories read/write the same `activeIndex`. */
  activeIndex: Ref<number>;
  totalCount: Ref<number>;
  results: ShallowRef<Row[]>;
  viewportRowCount: Ref<number>;
  topIndex: Ref<number>;
  selectionMode: SelectionMode;
  hasMainActionListener: Ref<boolean>;
  requestMainAction: (event: KeyboardEvent | MouseEvent) => void;
  toggleActiveSelection: () => void;
}

export interface NavController {
  navMode: Ref<"pagination" | "window">;
  navViewportRowCount: Ref<number>;
  setActive: (absIndex: number) => void;
  clearActive: () => void;
  handleNavKey: (event: KeyboardEvent, opts?: { enterAction?: EnterAction }) => void;
}

export function createNavController(inputs: NavControllerInputs): NavController {
  const {
    activeIndex,
    totalCount,
    results,
    viewportRowCount,
    topIndex,
    selectionMode,
    hasMainActionListener,
    requestMainAction,
    toggleActiveSelection,
  } = inputs;

  // Pagination caps nav by `min(results.length, totalCount)`; window caps by
  // `totalCount` alone since rows load on demand. Renderers flip this and
  // restore on unmount — assumes a single windowed renderer per state.
  const navMode = ref<"pagination" | "window">("pagination");

  // Nav-only viewport row count. Pagination renderers write this so PageUp/Down
  // step by visible-row count without going through `viewportRowCount` — that
  // ref is the fetch path's "this is window-mode" signal. `pageStep()`
  // consults whichever is larger.
  const navViewportRowCount = ref(0);

  function clampActive(idx: number): number {
    let upper: number;
    if (navMode.value === "window") {
      upper = totalCount.value;
    } else {
      // Pagination mode: only loaded rows are navigable. `min(results,total)`
      // makes `totalCount=0` force-reset (server says "no data") even when
      // a stale `results` entry lingers; falling back to `totalCount` when
      // nothing's loaded yet keeps tests / pre-render flows working.
      const r = results.value.length;
      const t = totalCount.value;
      if (r === 0) upper = t;
      else if (t === 0) upper = 0;
      else upper = Math.min(r, t);
    }
    if (upper === 0) return -1;
    // -1 is the "no active row" sentinel — let it pass through unchanged so
    // `clearActive()` and watcher re-clamps don't accidentally activate row 0.
    // Any other negative (e.g. PageUp from row 1 with pageStep=9 → setActive(-8))
    // clamps to row 0, the first valid row, NOT to the sentinel.
    if (idx === -1) return -1;
    if (idx < 0) return 0;
    if (idx > upper - 1) return upper - 1;
    return idx;
  }
  function setActive(absIndex: number): void {
    const next = clampActive(absIndex);
    if (next !== activeIndex.value) activeIndex.value = next;
  }
  function clearActive(): void {
    if (activeIndex.value !== -1) activeIndex.value = -1;
  }

  watch([() => totalCount.value, () => results.value.length, () => navMode.value], () =>
    setActive(activeIndex.value),
  );

  function pageStep(): number {
    return Math.max(viewportRowCount.value, navViewportRowCount.value, 10) - 1;
  }
  function activeBase(): number {
    return activeIndex.value < 0 ? topIndex.value : activeIndex.value;
  }
  function navStep(delta: number): void {
    if (activeIndex.value < 0) setActive(topIndex.value);
    else setActive(activeIndex.value + delta);
  }
  function navPage(delta: number): void {
    setActive(activeBase() + delta);
  }

  function handleNavKey(event: KeyboardEvent, opts?: { enterAction?: EnterAction }): void {
    if (totalCount.value === 0) return;

    const enterAction: EnterAction = opts?.enterAction ?? "main-action";
    const key = event.key;
    const meta = event.metaKey;
    const ctrl = event.ctrlKey;
    const alt = event.altKey;

    if (key === "ArrowDown" && (meta || ctrl)) {
      event.preventDefault();
      setActive(totalCount.value - 1);
      return;
    }
    if (key === "ArrowUp" && (meta || ctrl)) {
      event.preventDefault();
      setActive(0);
      return;
    }
    if (key === "ArrowDown" && alt) {
      event.preventDefault();
      navPage(pageStep());
      return;
    }
    if (key === "ArrowUp" && alt) {
      event.preventDefault();
      navPage(-pageStep());
      return;
    }

    switch (key) {
      case "ArrowDown": {
        event.preventDefault();
        navStep(1);
        return;
      }
      case "ArrowUp": {
        event.preventDefault();
        navStep(-1);
        return;
      }
      case "PageDown": {
        event.preventDefault();
        navPage(pageStep());
        return;
      }
      case "PageUp": {
        event.preventDefault();
        navPage(-pageStep());
        return;
      }
      case "Home": {
        event.preventDefault();
        setActive(0);
        return;
      }
      case "End": {
        event.preventDefault();
        setActive(totalCount.value - 1);
        return;
      }
      case " ": {
        if (selectionMode === "none") return;
        event.preventDefault();
        toggleActiveSelection();
        return;
      }
      case "Enter": {
        if (enterAction === "passthrough") return;
        event.preventDefault();
        if (enterAction === "toggle-select") {
          toggleActiveSelection();
          return;
        }
        if (hasMainActionListener.value) {
          requestMainAction(event);
          return;
        }
        if (selectionMode !== "none") {
          toggleActiveSelection();
        }
        return;
      }
      case "Escape":
      case "Esc": {
        // Don't preventDefault — Esc bubbling lets parent dialogs/menus close.
        clearActive();
        return;
      }
    }
  }

  return {
    navMode,
    navViewportRowCount,
    setActive,
    clearActive,
    handleNavKey,
  };
}
