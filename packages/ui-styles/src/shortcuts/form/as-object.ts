import { defineShortcuts } from "vunor/theme";

export const asObjectShortcuts = defineShortcuts({
  "as-object": "my-$m",
  "as-object--root": "",
  "as-object--nested":
    "relative pl-$m pt-$m pb-$xs mt-$s mb-$l border-0 border-l-2 border-l-current/20 hover:border-l-current/40",
  "as-object-error": "scope-error text-callout text-current-hl mb-$xs",
});
