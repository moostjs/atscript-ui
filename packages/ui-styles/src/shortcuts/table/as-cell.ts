import { defineShortcuts } from "vunor/theme";

export const asCellShortcuts = defineShortcuts({
  "as-cell-decimal": "text-right tabular-nums font-mono",

  "as-cell-chips": {
    // Firefox honours `scrollbar-width: none`; WebKit/Chromium needs the
    // `::-webkit-scrollbar` zero-size to drop the gutter — both required.
    "":
      "flex flex-nowrap gap-$xs items-center max-w-full overflow-x-auto overflow-y-hidden " +
      "[scrollbar-width:none] " +
      "[&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0",
  },
  // `flex-shrink-0`: chips don't compress on overflow — `flex-nowrap` would
  // otherwise squeeze them rather than enabling horizontal scroll.
  "as-cell-chip": "as-tag-chip flex-shrink-0",

  "as-cell-json-trigger": {
    "": "inline-flex items-center gap-$xs cursor-pointer text-current/70 font-mono text-callout border-0 bg-transparent p-0 outline-none",
    "hover:": "text-current-hl",
    "focus-visible:": "current-outline-hl outline i8-apply-outline",
  },
  "as-cell-json-trigger-glyph": "font-700",
  "as-cell-json-trigger-count": "text-current/50",

  "as-cell-json-popup":
    "scope-primary popup-card max-w-[40em] max-h-[24em] overflow-auto p-$m z-[100]",
  "as-cell-json-pre": "font-mono text-callout whitespace-pre m-0",
});
