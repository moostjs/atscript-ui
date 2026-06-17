import { defineShortcuts } from "vunor/theme";
import { inputBase } from "./_shared";

const clearBtnChrome =
  "border-1 layer-0 text-current/60 rounded-base cursor-pointer transition-all duration-120 disabled-soft";
const clearBtnHover = "scope-error bg-current-hl/10 text-current-hl";

export const asFieldShortcuts = defineShortcuts({
  "as-default-field": {
    "": "as-grid-item flex flex-col gap-$xs relative",
    "[&.required_.as-field-label]:after:":
      'content-["_*"] scope-error text-current-hl font-700 ml-[0.1em]',
    "[&.error_.as-error-slot]:": "scope-error text-current-hl",

    // Changed-since-baseline hook. AsFieldShell paints `data-dirty=""` on the
    // root when `<AsForm track-changes>` reports this field dirty (see
    // as-field-shell.vue + useAsField().isDirty). A SUBTLE, restrained accent —
    // a thin left bar in the primary scope highlight — so a glance shows what
    // the user touched without a loud full-field treatment. Consumers restyle
    // the whole look by re-defining just this one variant key via
    // `vunorShortcuts(overrides)`.
    //
    // The self-attribute selector is wrapped in `:is(...)` so the nested `[]`
    // inside the arbitrary-variant bracket compiles (UnoCSS silently drops a
    // bare `[&[data-dirty]]:`). The bar is a positioned `::before` (the root is
    // already `relative`); `bg-current-hl` paints the scope-500 highlight set by
    // the sibling `scope-primary`, sized in em so it tracks the field's type
    // scale, and spans the field's full vertical extent.
    "[&:is([data-dirty])]:": "scope-primary",
    "[&:is([data-dirty])]:before:":
      'content-[""] absolute left-[-0.4em] top-0 bottom-0 w-[0.15em] rounded-full bg-current-hl',

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

    // Plain `<input type="number">` (AsNumber's fallback path via
    // AsInputControl, plus any consumer-side numeric input) is right-aligned
    // for bank UX. The merged-chrome AsNumber path uses `as-number-input`
    // which also sets `text-right`; AsDecimal keeps the integer half right
    // and the decimal half left, so it deliberately renders `type="text"`
    // and isn't affected by this rule.
    "[&_input[type=number]]:": "text-right",

    // `<select>` element-specific overrides:
    // - `!bg-current` — Chromium ships native form widgets with an internal
    //   "appearance: auto" fallback that paints the closed-select chrome with
    //   browser-default colors even after `appearance:none` AND an explicit
    //   non-`!important` background. The `!` qualifier wins the cascade.
    //   Text color is inherited from `layer-0` (applied via `inputBase` on the
    //   shared input/select/textarea selector above) — under vunor 0.2.1 each
    //   layer paints `--current-text` to its primary text color, so no
    //   explicit `!text-*` override is needed here.
    // - `[color-scheme:light_dark]` declares the element supports both
    //   schemes so the browser doesn't auto-adapt native widgets behind our
    //   back. With this plus `!bg-current`, the closed select matches the
    //   surrounding `<input>`s on every browser/OS combination.
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

  "as-field-footer-row": "flex flex-row items-baseline justify-between gap-$xs",
  "as-field-action-link": {
    "": "border-0 bg-transparent p-0 text-callout scope-primary text-current-hl cursor-pointer disabled-soft",
    "hover:not-disabled:": "underline",
    "focus-visible:": "underline",
  },

  "as-field-description": "as-description -mt-[0.2em]",
  "as-field-label-index": "text-current/60 font-400 font-mono normal-case",

  // Clear/Remove buttons share chrome so they read as one family in
  // headers; only layout (text-pill vs square-icon) differs.
  "as-optional-clear": {
    "": `inline-flex items-center h-[1.5em] px-$s text-callout leading-none ${clearBtnChrome}`,
    "hover:not-disabled:": clearBtnHover,
  },
  "as-field-remove-btn": {
    "": `inline-grid place-items-center h-[1.5em] w-[1.5em] text-callout ${clearBtnChrome}`,
    "hover:not-disabled:": clearBtnHover,
  },
  "as-field-remove-btn-icon": "i-as-close text-[1em]",

  // Fallback rendered by `as-field.vue` when no component is registered for
  // a field's type (custom type without a `:components` entry). Mirrors
  // `as-collapsible-error`: `as-grid-item` claims a full grid row (matching
  // the regular `as-default-field` footprint this replaces) and the error
  // text recipe (`scope-error text-callout text-current-hl`) matches both
  // `as-array-error` and `as-collapsible-error`.
  "as-field-missing": "as-grid-item scope-error text-callout text-current-hl",
});
