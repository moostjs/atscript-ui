import { defineShortcuts } from "vunor/theme";
import { inputBase } from "./_shared";

export const asFieldShortcuts = defineShortcuts({
  "as-default-field": {
    "": "flex flex-col gap-$xs mb-$m relative",
    "[&_label]:": "font-600",
    "[&.required_label]:after:": 'content-["_*"] scope-error text-current-hl font-700 ml-[0.1em]',
    "[&.error_.as-error-slot]:": "scope-error text-current-hl",

    // Comma-separated arbitrary-variant selector lists silently break the
    // `dark:` qualifier — UnoCSS only prefixes `.dark ` onto the first
    // selector. Wrap the inner list in `:is(...)` so the variant resolves
    // to a single selector and theme-aware shortcuts (`layer-*`,
    // `dark:!text-*`) apply uniformly across input/select/textarea.
    "[&_:is(input:not([type=checkbox]):not([type=radio]),select,textarea)]:": inputBase,
    "[&_:is(input:not([type=checkbox]):not([type=radio]),select,textarea):hover]:":
      "border-current/30",
    "[&_:is(input:not([type=checkbox]):not([type=radio]),select,textarea):focus]:":
      "current-border-hl outline i8-apply-outline",
    "[&_:is(input:not([type=checkbox]):not([type=radio]),select,textarea):disabled]:":
      "layer-2 text-current/40 cursor-not-allowed",
    "[&_:is(input:not([type=checkbox]):not([type=radio]),textarea):read-only]:": "layer-2",

    "[&_textarea]:": "resize-y min-h-[80px] py-$s leading-[1.45]",

    // `<select>` element-specific overrides:
    // - `!bg-current` + `!text-scope-dark-0` (light) / `!text-scope-light-0`
    //   (dark) — Chromium ships native form widgets with an internal
    //   "appearance: auto" fallback that paints the closed-select chrome with
    //   browser-default colors even after `appearance:none` AND explicit
    //   `background-color` set non-importantly. The `!important` qualifiers
    //   make the cascade beat that internal styling.
    // - `[color-scheme:light_dark]` declares the element supports both
    //   schemes so the browser doesn't auto-adapt native widgets behind our
    //   back. With both this AND the bg/text overrides, the closed select
    //   matches the surrounding `<input>`s on every browser/OS combination.
    // - The dropdown caret is painted by `<span class="as-select-caret …">`
    //   inside the `as-select-wrap` container — see `as-select.vue`.
    "[&_select]:":
      "pr-[1.75em] cursor-pointer appearance-none [color-scheme:light_dark] whitespace-nowrap !bg-current",

    "[&.error_:is(input:not([type=checkbox]):not([type=radio]),select,textarea)]:":
      "scope-error current-border-hl border-current",
    "[&.error_:is(input:not([type=checkbox]):not([type=radio]),select,textarea):hover]:":
      "scope-error current-border-hl border-current",
    "[&.error_:is(input:not([type=checkbox]):not([type=radio]),select,textarea):focus]:":
      "scope-error current-border-hl border-current outline i8-apply-outline",
  },

  // `<select>` lives inside `<span class="as-select-wrap">` so the dropdown
  // caret can be painted as a positioned `<span class="as-select-caret">`
  // (a baked `i-as-chevron-down` icon) instead of the inline data-URL we used
  // to set as `background-image`. `pointer-events-none` lets clicks fall
  // through to the underlying `<select>`.
  "as-select-wrap": "relative block w-full",
  "as-select-caret":
    "absolute right-$s top-1/2 -translate-y-1/2 text-current/60 text-[1em] pointer-events-none",

  "as-field-label": "font-600",

  "as-field-header-row": "flex items-center gap-$xs min-h-[1.5em]",
  "as-field-header-content": "flex flex-wrap items-center gap-x-$xs gap-y-[0.15em] flex-1 min-w-0",
  "as-field-header-actions": "flex items-center gap-$xs flex-shrink-0",
  "as-field-input-row":
    "flex items-center gap-$xs [&>input]:flex-1 [&>select]:flex-1 [&>textarea]:flex-1",
  "as-error-slot": "leading-[1] text-callout text-current/60",

  "as-field-description": "text-callout text-current-muted -mt-[0.2em]",

  "as-optional-clear": {
    "": "inline-grid place-items-center size-[1.5em] p-0 border-1 layer-0 text-current/50 rounded-base cursor-pointer leading-none transition-all duration-120",
    "hover:": "scope-error bg-current-hl/10 text-current-hl",
  },
  "as-close-icon": "i-as-close w-[0.7em] h-[0.7em]",
  "as-field-remove-btn": {
    "": "inline-grid place-items-center h-[1.5em] px-$s border-0 bg-transparent text-current/50 rounded-base cursor-pointer text-callout leading-none transition-all duration-120 disabled-soft",
    "hover:not-disabled:": "scope-error bg-current-hl/10 text-current-hl",
  },
});
