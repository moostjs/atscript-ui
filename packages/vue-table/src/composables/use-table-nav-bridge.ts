import type { NavKeyOptions, ReactiveTableState, TableNavBridge } from "../types";
import { useTableContextOptional } from "./use-table-state";

// Bridge-specific consumption rules. Space, Home, End (unmodified), and
// printable keys MUST never be consumed so the user can keep typing in the
// input. Modifier-arrow combinations ARE consumed (delegated to handleNavKey).
function isPassthroughKey(event: KeyboardEvent): boolean {
  const key = event.key;
  const meta = event.metaKey;
  const ctrl = event.ctrlKey;
  const alt = event.altKey;
  if (key === " ") return true;
  if (key.length === 1 && !meta && !ctrl && !alt) return true;
  if ((key === "Home" || key === "End") && !meta && !ctrl && !alt) return true;
  return false;
}

/**
 * Construct a keyboard-bridge for an external `<input>` to drive table nav
 * without losing focus. Without args, injects the nearest `<as-table-root>`
 * context's state. With an explicit `state`, binds to that state. With
 * `opts.enterAction`, the returned bridge's `onKeydown` defaults to that
 * enter-action (per-call options still win).
 *
 * Each call returns a fresh bridge object — callers that need stable
 * identity should bind once at setup and reuse the binding.
 */
export function useTableNavBridge(
  state?: ReactiveTableState,
  opts?: NavKeyOptions,
): TableNavBridge {
  let target: ReactiveTableState | undefined = state;
  if (!target) {
    const ctx = useTableContextOptional();
    if (!ctx) {
      throw new Error("[vue-table] useTableNavBridge() called outside of <as-table-root>.");
    }
    target = ctx.state;
  }
  const bound = target;
  const defaultEnterAction = opts?.enterAction;

  function onKeydown(event: KeyboardEvent, callOpts?: NavKeyOptions): void {
    if (isPassthroughKey(event)) return;
    bound.handleNavKey(event, {
      enterAction: callOpts?.enterAction ?? defaultEnterAction,
    });
  }

  return {
    onKeydown,
    activeIndex: bound.activeIndex,
    setActive: bound.setActive,
    clearActive: bound.clearActive,
  };
}
