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

/**
 * Elements that own Enter / Space (and a pointer drag) themselves.
 * `[contenteditable]` is matched separately because `contenteditable="false"`
 * must NOT count.
 */
export const INTERACTIVE_SELECTOR =
  "button, a[href], input, select, textarea, summary," +
  " [role=button], [role=link], [role=checkbox], [role=menuitem]," +
  " [role=switch], [role=tab], [role=option]";

/**
 * True when the key event started on an interactive element inside a cell,
 * so table nav must not consume Enter / Space. The walk runs from
 * `event.target` up to `event.currentTarget` — the element the handler is
 * bound on — and stops at the cell / row boundary, so a wrapper outside the
 * table can never make a whole table inert. A handler bound ON the
 * interactive element itself (the search-input bridge) is therefore never
 * guarded: the walk has nothing to cross. An interactive element opts BACK
 * IN to table nav — e.g. a cell whose button should not swallow Enter —
 * with `data-as-nav-keys`.
 */
export function isInteractiveKeyTarget(event: KeyboardEvent): boolean {
  let el = event.target as Element | null;
  const stop = event.currentTarget as Element | null;
  while (el && el !== stop && typeof el.matches === "function") {
    const tag = el.tagName;
    if (tag === "TD" || tag === "TH" || tag === "TR" || tag === "TBODY" || tag === "TABLE") {
      return false;
    }
    if (el.matches(INTERACTIVE_SELECTOR) || isEditable(el)) {
      return !el.hasAttribute("data-as-nav-keys");
    }
    el = el.parentElement;
  }
  return false;
}

function isEditable(el: Element): boolean {
  const attr = el.getAttribute("contenteditable");
  return attr !== null && attr !== "false";
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
    // Computed once, and only for the two keys that can be claimed by a cell
    // control — arrows / paging keys stay with the table either way.
    const guarded = (key === "Enter" || key === " ") && isInteractiveKeyTarget(event);
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
        if (guarded) return;
        event.preventDefault();
        toggleActiveSelection(mode);
        return;
      }
      case "Enter": {
        if (enterAction === "passthrough") return;
        // A control inside a cell owns Enter: don't preventDefault and don't
        // activate the row, or the button can never be pressed by keyboard.
        if (guarded) return;
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

/**
 * `@keydown` handler for a row's SELECTION CONTROL (the leading checkbox),
 * shared by `<AsTableBase>` and `<AsWindowTableBase>`. The control carries
 * `role="checkbox"`, so the tbody-level nav handler deliberately leaves
 * Space to it (see {@link isInteractiveKeyTarget}) — this is where it lands.
 *
 * Keys other than Space, and `select="none"`, fall through untouched; only
 * once the press is ours do we consume it, so the Reka-wrapped rendering
 * modes (which never bind this handler) keep Space for their own item.
 * Selectability is NOT re-checked here: `toggleActiveSelection` gates on
 * `rowSelectable` itself, which is the single place that rule lives.
 */
export function onSelectControlKeydown(
  event: KeyboardEvent,
  index: number,
  mode: SelectionMode,
  state: {
    setActive: (index: number) => void;
    toggleActiveSelection: (mode: SelectionMode) => void;
  },
): void {
  if (event.key !== " ") return;
  if (mode === "none") return;
  event.preventDefault();
  event.stopPropagation();
  state.setActive(index);
  state.toggleActiveSelection(mode);
}
