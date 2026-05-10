import { focusNewFocusableAfter } from "./focus-after-toggle";
import { useAsNestedSectionsStore } from "./use-as-nested-sections-store";

/**
 * Options for `useAsOptionalAddFlow`.
 *
 * The composable consolidates the "toggle optional → register with the
 * nested-sections store → focus first new field" choreography that
 * structured-field defaults (AsObject, AsArray, AsTuple, AsUnion) repeat
 * every time the user clicks an empty-state Add affordance, an Add Item
 * button, or a variant picker.
 */
export interface UseAsOptionalAddFlowOptions {
  /**
   * Absolute dotted path to the field — used as the nested-sections-store
   * key. Read via a getter so the composable always reads the latest value
   * (the path can change when the field is rendered inside a union and the
   * variant switches).
   */
  path: () => string | undefined;
}

export interface UseAsOptionalAddFlowReturn {
  /**
   * Wrap a user-supplied action so that running it also expands the
   * containing section in the nested-sections store. Pass the wrapped
   * action to `AsCollapsible#runAndFocusNew` (which owns its own focus
   * scope) so the focus query lands on the freshly mounted subtree.
   *
   * The wrapper is a no-op for the store-register step when no store is
   * provided in scope (e.g. a custom default mounted standalone) — focus
   * still happens via the host's `runAndFocusNew`.
   */
  composeAction: (action: () => void) => () => void;
  /**
   * Sugar for the case where the call site does not have an
   * `AsCollapsible` to delegate focus to (e.g. AsUnion's empty-state
   * picker, which mounts its own `<div>`). Wraps the action with
   * store-open registration, then runs it inside `focusNewFocusableAfter`.
   *
   * Returns the same Promise `focusNewFocusableAfter` returns so callers
   * can `await` if they need to.
   */
  runAndFocusNew: (
    scope: () => HTMLElement | null | undefined,
    action: () => void,
    ticks?: number,
  ) => Promise<void>;
}

/**
 * Choreography composable for "enable-optional + add + focus-first-new"
 * flows. The four built-in structured-field defaults consume it; custom
 * implementations of object/array/tuple/union components can use it too
 * to get the same UX (smooth focus handoff after an empty-state click)
 * without re-implementing the choreography.
 *
 * Pairs with:
 *   - {@link useAsFocusFirstAfter} — focus mechanics (used by AsCollapsible)
 *   - {@link useAsNestedSectionsStore} — open/closed state registry
 *
 * Typical use, inside an `as-object.vue` swap component:
 * ```ts
 * const { composeAction } = useAsOptionalAddFlow({ path: () => props.path });
 * function handleAddData() {
 *   collapsibleRef.value?.runAndFocusNew(
 *     composeAction(() => props.onToggleOptional?.(true)),
 *     2,
 *   );
 * }
 * ```
 */
export function useAsOptionalAddFlow(
  options: UseAsOptionalAddFlowOptions,
): UseAsOptionalAddFlowReturn {
  const store = useAsNestedSectionsStore();

  const wrap = (action: () => void): (() => void) => {
    return () => {
      action();
      const path = options.path();
      if (path) store?.setOpen(path, true);
    };
  };

  return {
    composeAction: wrap,
    runAndFocusNew(scope, action, ticks = 2) {
      return focusNewFocusableAfter(wrap(action), scope, ticks);
    },
  };
}
