import { defineShortcuts } from "vunor/theme";

// `as-consent-array` itself is the FieldShell `field-class` — no rules
// declared here; FieldShell owns the surrounding chrome. The sub-classes
// below own the layout + per-item visuals.
export const asConsentArrayShortcuts = defineShortcuts({
  "as-consent-array-group": "flex flex-col gap-$s w-full",
  // Each item wraps a label row + its optional below-row error message.
  "as-consent-array-item": "flex flex-col gap-$xxs",
  // Visual variant for the consent row. Mirrors the rules in
  // `as-checkbox-radio.ts` but lives under its own class so designers
  // can tune consent rows (e.g. denser spacing, accent borders) without
  // affecting the standalone `as-checkbox-field` boolean component.
  "as-consent-array-row": {
    "": "flex items-center gap-$s text-current cursor-pointer font-normal w-full min-w-0",
    "[&_input[type=checkbox]]:":
      "scope-primary size-[1em] m-0 p-0 border-0 shadow-none bg-transparent [accent-color:rgb(var(--current-hl))] cursor-pointer",
    "[&_.as-consent-array-text]:": "flex-1 min-w-0",
  },
  // Required marker — mirrors the framework asterisk pattern from
  // `as-default-field` (see `form/as-field.ts`) so consent rows visually
  // match required fields elsewhere in the form. The marker is gated by
  // `.required` on the text span so the `*` only renders for required
  // consents.
  "as-consent-array-text": {
    "[&.required]:after:": 'content-["_*"] scope-error text-current-hl font-700 ml-[0.1em]',
  },
  // Anchor styling for markdown-parsed links inside the consent label.
  // Routed through a dedicated shortcut so consumers can theme link
  // color/decoration without touching the .vue source.
  "as-consent-array-link": {
    "": "scope-primary text-current-hl underline underline-offset-2",
    "hover:": "text-current-hl/80",
    "focus-visible:": "outline i8-apply-outline",
  },
});
