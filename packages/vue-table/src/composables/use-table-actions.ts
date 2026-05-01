import type { TableActionsState } from "../types";
import { useTableContext } from "./use-table-state";

/**
 * Inject the table-actions namespace from the closest `<AsTableRoot>` ancestor.
 * Returns `state.actions` directly — no wrapping. Throws when called outside
 * the provider tree (delegated to `useTableContext`).
 *
 * Useful for consumers that want the model without the chrome (custom
 * toolbars, headless action buttons, programmatic invoke).
 */
export function useTableActions(): TableActionsState {
  const ctx = useTableContext();
  return ctx.state.actions;
}
