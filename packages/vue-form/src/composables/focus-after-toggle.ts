import { nextTick, ref, type Ref } from "vue";

// Excludes checkbox/radio/buttons/<summary>: those should be reached via Tab, not auto-focused.
const FOCUSABLE_SELECTOR = [
  "input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([disabled])",
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

/**
 * Run an action, then focus the first focusable input that wasn't present
 * before the action. Used by array Add buttons so the user lands on the
 * just-added row's first input regardless of how many items already exist.
 * Falls back to first focusable when nothing existed before (the typical
 * "enable optional + add first item" flow).
 */
export async function focusNewFocusableAfter(
  action: () => void,
  scope: () => HTMLElement | null | undefined,
  ticks = 1,
): Promise<void> {
  const before = scope();
  const known = before ? new Set(before.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : null;
  action();
  for (let i = 0; i < ticks; i++) await nextTick();
  const after = scope();
  if (!after) return;
  const all = after.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  for (const el of all) {
    if (!known || !known.has(el)) {
      el.focus();
      return;
    }
  }
}

/** Sugar over `focusFirstAfter` scoped to a template ref. */
export function useAsFocusFirstAfter(onToggleOptional?: (enabled: boolean) => void): {
  rootRef: Ref<HTMLElement | null>;
  runAndFocus: (action: () => void, ticks?: number) => void;
  runAndFocusNew: (action: () => void, ticks?: number) => void;
  enableOptional: () => void;
} {
  const rootRef = ref<HTMLElement | null>(null);
  const runAndFocus = (action: () => void, ticks = 1): void => {
    void focusFirstAfter(action, () => rootRef.value, ticks);
  };
  const runAndFocusNew = (action: () => void, ticks = 1): void => {
    void focusNewFocusableAfter(action, () => rootRef.value, ticks);
  };
  return {
    rootRef,
    runAndFocus,
    runAndFocusNew,
    enableOptional: () => runAndFocus(() => onToggleOptional?.(true)),
  };
}
