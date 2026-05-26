import { defineShortcuts } from "vunor/theme";

// Visual variant for the AsPasswordRules display component. The row's
// `data-passed` attribute drives both the colour swap (`scope-good` when
// met) and the icon glyph swap (empty bullet vs `i-as-check`).
export const asPasswordRulesShortcuts = defineShortcuts({
  // Outer card. Matches `as-consent-array-empty` chrome so sibling aooth
  // helpers read as one visual family.
  "as-password-rules": "p-$s rounded-base text-callout",
  "as-password-rules-list": "flex flex-col gap-$xs w-full",
  "as-password-rules-row": {
    "": "flex items-center gap-$s text-current/60 transition-colors duration-140",
    "[&[data-passed='true']]:": "scope-good text-current-hl",
  },
  "as-password-rules-icon": {
    "": "inline-flex items-center justify-center size-[1em] flex-shrink-0",
    // Unmet ⇒ empty bullet drawn from primitives (no Iconify glyph for
    // "outlined circle" is baked into `@atscript/ui-styles`).
    "[[data-passed='false']>&]:": "border-1 rounded-full",
    // Met ⇒ swap to the baked check glyph.
    "[[data-passed='true']>&]:": "i-as-check",
  },
  "as-password-rules-text": "flex-1 min-w-0",
  // Same dashed-placeholder shape as `as-consent-array-empty` for visual
  // consistency between the two aooth empty states.
  "as-password-rules-empty":
    "flex items-center justify-center gap-$s h-fingertip-m px-$m w-full border-1 border-dashed rounded-base bg-transparent text-current/60 text-callout",
});
