import { nextTick, ref, type Ref } from "vue";

// Excludes checkbox/radio/buttons/<summary>: those should be reached via Tab, not auto-focused.
const FOCUSABLE_SELECTOR = [
  'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([disabled])',
  "select:not([disabled])",
  "textarea:not([disabled])",
].join(",");

/** Run an action, then focus the first focusable input descendant of `scope`. */
export async function focusFirstAfter(
  action: () => void,
  scope: () => HTMLElement | null | undefined,
  ticks = 1,
): Promise<void> {
  action();
  for (let i = 0; i < ticks; i++) await nextTick();
  const root = scope();
  if (!root) return;
  const target = root.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
  target?.focus();
}

/** Sugar over `focusFirstAfter` scoped to a template ref. */
export function useFocusFirstAfter(onToggleOptional?: (enabled: boolean) => void): {
  rootRef: Ref<HTMLElement | null>;
  runAndFocus: (action: () => void, ticks?: number) => void;
  enableOptional: () => void;
} {
  const rootRef = ref<HTMLElement | null>(null);
  const runAndFocus = (action: () => void, ticks = 1): void => {
    void focusFirstAfter(action, () => rootRef.value, ticks);
  };
  return {
    rootRef,
    runAndFocus,
    enableOptional: () => runAndFocus(() => onToggleOptional?.(true)),
  };
}
