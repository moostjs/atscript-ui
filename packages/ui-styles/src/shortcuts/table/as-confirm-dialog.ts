import { defineShortcuts } from "vunor/theme";
import { dialogBase, dialogOverlay } from "./_shared";

/**
 * `<AsConfirmDialog>` Tier-2 default. Replaces `window.confirm()` for action
 * prompts. Compact dialog (no full-screen mobile takeover — confirm prompts
 * are short and read better as a centered card on every viewport).
 *
 * Confirm button intent variants mirror `as-table-actions-intent-*`: the
 * caller passes `intent` from the action; this shortcut surface flips the
 * scope so `negative → scope-error`, `positive → scope-good`, etc. without
 * the consumer touching colors directly.
 */
export const asConfirmDialogShortcuts = defineShortcuts({
  "as-confirm-dialog-overlay": dialogOverlay,
  // Centred compact card at every breakpoint — overrides the mobile
  // full-screen path from `dialogBase`. `min-w-0` lets it fit narrow
  // viewports (capped by 92vw); `sm:min-w-[320px]` restores comfortable
  // width above 640px so short prompts don't collapse.
  "as-confirm-dialog-content": `${dialogBase} !inset-auto !top-1/2 !left-1/2 !-translate-x-1/2 !-translate-y-1/2 !size-auto !rounded-r3 !shadow-popup !border-1 min-w-0 sm:min-w-[320px] max-w-[min(520px,92vw)]`,
  // Single padded wrapper hosts title + body — that way the `<h2>` (Title)
  // and `<p>` (Description) primitives can't drift apart from each other on
  // the left edge regardless of UA defaults / font metrics. Children get
  // `!m-0 !p-0` so any inherited h2/p margin or padding is stripped flat.
  "as-confirm-dialog-body-wrap": "flex flex-col gap-$m py-$m px-$l",
  "as-confirm-dialog-title": "!m-0 !p-0 text-body-l font-600",
  "as-confirm-dialog-body": "!m-0 !p-0 text-body text-current/80 whitespace-pre-line",
  "as-confirm-dialog-footer": "flex items-center justify-end gap-$s px-$l py-$m border-t-1",
  "as-confirm-dialog-cancel":
    "scope-neutral c8-chrome inline-flex items-center justify-center h-fingertip-m px-$m font-500 cursor-pointer",
  // Default confirm chrome — `c8-filled` paints bg + contrasting fg via
  // vunor (see `as-table-actions-btn`). Intent variants below override the
  // scope; do NOT override text-color here (the `c8-filled` foreground
  // disappears if we do — red text on red bg).
  "as-confirm-dialog-confirm": {
    "": "scope-primary c8-filled inline-flex items-center justify-center h-fingertip-m px-$m font-500 cursor-pointer",
    "disabled:": "opacity-40 cursor-not-allowed",
  },
  // Scope variants — name matches vunor scope directly (passed as `scope` to
  // `state.prompt()`). `negative → error`, `positive → good`, etc., is the
  // caller's mapping concern (`intentToScope` for action.intent → scope).
  "as-confirm-dialog-confirm-good": {
    "[&.as-confirm-dialog-confirm]:": "!scope-good",
  },
  "as-confirm-dialog-confirm-error": {
    "[&.as-confirm-dialog-confirm]:": "!scope-error",
  },
  "as-confirm-dialog-confirm-warn": {
    "[&.as-confirm-dialog-confirm]:": "!scope-warn",
  },
  "as-confirm-dialog-confirm-primary": "scope-primary",
  "as-confirm-dialog-confirm-secondary": "scope-secondary",
  "as-confirm-dialog-confirm-neutral": {
    "[&.as-confirm-dialog-confirm]:": "!scope-neutral",
  },
});
