import { defineShortcuts } from "vunor/theme";

export const asInputShortcuts = defineShortcuts({
  "as-input-with-icon": {
    "": "relative flex-1 min-w-0",
    "[&>.as-input-icon]:":
      "absolute left-$s top-1/2 -translate-y-1/2 text-[1.1em] pointer-events-none text-current/60",
    "[&>input,&>textarea]:": "!pl-[2.25em]",
  },
});
