import { defineShortcuts } from "vunor/theme";
import {
  buildDialogConfirmVariants,
  dialogBase,
  dialogCancelBtn,
  dialogConfirmBtn,
  dialogOverlay,
} from "./_shared";

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
  "as-confirm-dialog-cancel": dialogCancelBtn,
  "as-confirm-dialog-confirm": dialogConfirmBtn,
  ...buildDialogConfirmVariants("as-confirm-dialog-confirm"),
});
