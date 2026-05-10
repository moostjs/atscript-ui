import { defineShortcuts } from "vunor/theme";
import {
  buildDialogConfirmVariants,
  dialogBase,
  dialogCancelBtn,
  dialogConfirmBtn,
  dialogOverlay,
} from "./_shared";

export const asActionFormShortcuts = defineShortcuts({
  "as-action-form-overlay": dialogOverlay,
  // `sm:!h-auto` overrides `dialogBase`'s mobile `size-full`; mobile keeps
  // `size-full` so the dialog fills the viewport and the flex-column layout
  // pins the footer to the device bottom.
  "as-action-form-content": `${dialogBase} sm:!h-auto sm:w-[min(560px,92vw)] sm:max-h-[90vh]`,

  "as-action-form-header": "relative flex items-center gap-$m px-$l py-$m border-b-1 flex-shrink-0",
  "as-action-form-title":
    "m-0 text-body-l font-600 whitespace-nowrap tracking-[-0.01em] flex-shrink-0",
  "as-action-form-ids": "flex items-center gap-$xs flex-1 min-w-0 overflow-hidden",
  "as-action-form-ids-measure":
    "absolute top-0 left-0 invisible pointer-events-none flex items-center gap-$xs whitespace-nowrap",
  "as-action-form-id":
    "inline-flex items-center px-$xs h-[1.5em] rounded-base layer-2 text-callout font-500 whitespace-nowrap",
  "as-action-form-id-more":
    "inline-flex items-center px-$xs h-[1.5em] rounded-base layer-2 text-callout text-current/70 italic whitespace-nowrap",
  "as-action-form-close": "as-dialog-close",

  "as-action-form-body": "flex-1 min-h-0 overflow-y-auto px-$l py-$m flex flex-col gap-$m",
  "as-action-form-description": "m-0 text-body text-current/80 whitespace-pre-line",
  "as-action-form-status": "m-0 text-body text-current/70",
  "as-action-form-error": "m-0 text-body scope-error text-current-hl",

  "as-action-form-footer":
    "flex items-center justify-end gap-$s px-$l py-$m border-t-1 flex-shrink-0",
  "as-action-form-cancel": dialogCancelBtn,
  "as-action-form-submit": dialogConfirmBtn,
  ...buildDialogConfirmVariants("as-action-form-submit"),
});
