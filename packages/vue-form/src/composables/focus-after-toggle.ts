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

// A reset hands focus back to the first field control of any kind — unlike the
// toggle helpers above, a checkbox or radio counts. Buttons and <summary> do not.
// Disabled controls match too: `resetKeepingFocus` skips whatever refuses focus.
const FIELD_CONTROL_SELECTOR = [
  "input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=reset]):not([type=image])",
  "select",
  "textarea",
].join(",");

/**
 * Run a form reset that remounts the field tree inside `root`. When the reset
 * removed or disabled the focused element of `root` and nothing else took
 * focus, focus the first field control it created that takes focus
 * (`tabindex="-1"` skipped). Focus anywhere else is left alone. Backs
 * `<AsForm>`'s reset; not exported from the package.
 */
export async function resetKeepingFocus(
  reset: () => Promise<void>,
  root: HTMLElement | null | undefined,
): Promise<void> {
  if (!root) return reset();
  // The shadow root when the form renders inside one (no `activeElement` when detached).
  const scope = root.getRootNode() as Document | ShadowRoot;
  const focused = scope.activeElement;
  if (!focused || !root.contains(focused)) return reset();
  const known = new Set(root.querySelectorAll(FIELD_CONTROL_SELECTOR));
  await reset();
  await nextTick(); // the render the reset caused, e.g. a Reset button disabled once clean
  if (focused.isConnected && !focused.matches(":disabled")) return;
  // A just-disabled element stays active until the next frame (Chromium).
  const doc = root.ownerDocument;
  const focusTaken = () => doc.activeElement !== doc.body && scope.activeElement !== focused;
  if (focusTaken()) return;
  for (const el of root.querySelectorAll<HTMLElement>(FIELD_CONTROL_SELECTOR)) {
    if (known.has(el) || el.tabIndex < 0) continue;
    el.focus(); // a disabled or hidden control refuses it: try the next one
    if (focusTaken()) return;
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
