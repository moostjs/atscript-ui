import { defineShortcuts } from "vunor/theme";
import { inputBase } from "../form/_shared";

// Read-only field with a trailing copy button — bordered shell hugs both,
// the input is borderless inside (like the AsNumber/AsDecimal shell family).
export const asCopyShortcuts = defineShortcuts({
  "as-copy-row": `flex w-full items-stretch gap-0 ${inputBase} px-0 py-0`,
  // Drop layer/height so the input is fully transparent and lets the button's
  // `h-fingertip-m` set the row height — `items-stretch` then centers the
  // text vertically inside the shell instead of pinning it to the top.
  "as-copy-input":
    "flex-1 min-w-0 !bg-transparent !border-0 !outline-0 !ring-0 !shadow-none px-$s text-body text-scope-dark-0 dark:text-scope-light-0 font-mono",
  "as-copy-btn":
    "c8-flat scope-primary btn h-fingertip-m px-$s gap-$xxs cursor-pointer disabled-soft",
  "as-copy-icon": "text-[1.15em]",
  "as-copy-label": "text-callout",
});
