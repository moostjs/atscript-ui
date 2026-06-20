import { ref, watch, type Ref, type ShallowRef } from "vue";
import type { SelectionMode } from "@atscript/ui-table";
import type { EnterAction } from "../../types";

type Row = Record<string, unknown>;

export interface NavControllerInputs {
  /** Shared with selection + main-action: orchestrator owns the ref so all
   * four factories read/write the same `activeIndex`. */
  activeIndex: Ref<number>;
  /** Orchestrator-owned (like `activeIndex`) so `getActiveRow` can read the nav
   * mode too — it decides whether `activeIndex` is an absolute (window) or a
   * page-relative (pagination) index. Renderers flip it on mount / restore on
   * unmount — assumes a single windowed renderer per state. */
  navMode: Ref<"pagination" | "window">;
  totalCount: Ref<number>;
  results: ShallowRef<Row[]>;
  viewportRowCount: Ref<number>;
  topIndex: Ref<number>;
  /**
   * True when `requestMainAction` would fire (listener registered OR a
   * default row action is available). Enter routes through `requestMainAction`
   * only when this is true; otherwise it falls through to selection-toggle
   * semantics in single/multi modes.
   */
  hasMainActionAvailable: Ref<boolean>;
  requestMainAction: (event: KeyboardEvent | MouseEvent) => void;
  toggleActiveSelection: (mode: SelectionMode) => void;
}

/**
 * Per-call options for `handleNavKey`. `mode` is passed by the caller
 * because selection mode lives on the renderer's `:select` prop, not on
 * state — the renderer's keydown handler closes over `props.select`, the
 * search-input bridge passes its consumer-supplied mode reader.
 */
export interface NavKeyCallOptions {
  enterAction?: EnterAction;
  mode?: SelectionMode;
}

export interface NavController {
  navViewportRowCount: Ref<number>;
  setActive: (absIndex: number) => void;
  clearActive: () => void;
  handleNavKey: (event: KeyboardEvent, opts?: NavKeyCallOptions) => void;
}

export function createNavController(inputs: NavControllerInputs): NavController {
  const {
    activeIndex,
    navMode,
    totalCount,
    results,
    viewportRowCount,
    topIndex,
    hasMainActionAvailable,
    requestMainAction,
    toggleActiveSelection,
  } = inputs;

  // Clamp rule: pagination caps nav by `min(results.length, totalCount)`;
  // window caps by `totalCount` alone since rows load on demand.

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

  function handleNavKey(event: KeyboardEvent, opts?: NavKeyCallOptions): void {
    if (totalCount.value === 0) return;

    const enterAction: EnterAction = opts?.enterAction ?? "main-action";
    const mode: SelectionMode = opts?.mode ?? "none";
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
        if (mode === "none") return;
        event.preventDefault();
        toggleActiveSelection(mode);
        return;
      }
      case "Enter": {
        if (enterAction === "passthrough") return;
        event.preventDefault();
        if (enterAction === "toggle-select") {
          toggleActiveSelection(mode);
          return;
        }
        // In any select mode (`single` or `multi`), Enter mirrors Space —
        // selectable rows have a visible toggle affordance, so keyboard
        // Enter pairs with the spacebar/click toggle. Main-action is
        // reserved for `select="none"` where the row has no toggle
        // semantics — Enter then fires the default row action (and dblclick
        // does the same via `<AsTableBase>` / `<AsWindowTableBase>`).
        if (mode !== "none") {
          toggleActiveSelection(mode);
          return;
        }
        if (hasMainActionAvailable.value) {
          requestMainAction(event);
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
    navViewportRowCount,
    setActive,
    clearActive,
    handleNavKey,
  };
}
