import { nextTick, type Ref, type WritableComputedRef } from "vue";

export interface UseDialogTabKeyboardOptions<T extends string> {
  /** Writable handle on the active tab. */
  activeTab: Ref<T> | WritableComputedRef<T>;
  /** Tab values in 1-based digit order — index 0 maps to Cmd/Ctrl+1, etc. */
  tabOrder: readonly T[];
  /** Skip switching when this returns false. Default: always available. */
  isAvailable?: (tab: T) => boolean;
  /** Synchronous focus call; the composable wraps it in `nextTick` + `rAF`
   * so Reka's `<Presence>` has time to mount the new TabsContent. */
  focusActiveTab: () => void;
}

/**
 * Cmd/Ctrl+digit tab switching for dialogs. Owns the keyboard-handler logic
 * AND the `nextTick` + `requestAnimationFrame` wrap of the focus call (so
 * consumers pass a synchronous focus body).
 */
export function useDialogTabKeyboard<T extends string>(opts: UseDialogTabKeyboardOptions<T>) {
  const { activeTab, tabOrder, isAvailable, focusActiveTab } = opts;

  function focusActiveTabAfterMount(): void {
    void nextTick(() => requestAnimationFrame(() => focusActiveTab()));
  }

  function onDialogKeydown(event: KeyboardEvent): void {
    if (!(event.metaKey || event.ctrlKey)) return;
    const idx = Number.parseInt(event.key, 10) - 1;
    if (Number.isNaN(idx) || idx < 0 || idx >= tabOrder.length) return;
    const target = tabOrder[idx];
    if (isAvailable && !isAvailable(target)) return;
    event.preventDefault();
    activeTab.value = target;
    focusActiveTabAfterMount();
  }

  return { onDialogKeydown, focusActiveTabAfterMount };
}
