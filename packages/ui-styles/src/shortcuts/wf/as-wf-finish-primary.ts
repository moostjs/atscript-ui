import { defineShortcuts } from "vunor/theme";

// Primary CTA on the manual finish screen. `scope-primary` lets the c8/btn
// pair pick brand color; height comes from fingertip.
export const asWfFinishPrimaryShortcuts = defineShortcuts({
  "as-wf-finish-primary": "scope-primary c8-filled btn h-fingertip-m px-$m cursor-pointer",
});
