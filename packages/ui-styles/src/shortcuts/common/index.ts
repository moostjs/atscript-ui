import { defineShortcuts, mergeVunorShortcuts } from "vunor/theme";

const baseCommon = defineShortcuts({
  // Keyboard shortcut badge — small button-shaped hint shown next to text
  // that reveals which key triggers the action (e.g. "See All  F4 ").
  // Matches the column-menu's per-item hint badge so all keystroke
  // indicators across the UI share a single visual language.
  "as-kbd":
    "inline-flex items-center justify-center min-w-[1.5em] h-[1.5em] px-$xs rounded-r0 layer-2 text-callout font-mono font-600 text-current/70 leading-none shrink-0",
});

export const commonShortcuts = mergeVunorShortcuts([baseCommon]);
