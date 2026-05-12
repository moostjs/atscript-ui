import { defineShortcuts } from "vunor/theme";
import { inputBase } from "./_shared";

/**
 * Decimal + number default renderers — the "bank UX" shell. Both share
 * the same merged-chrome family: ONE bordered container that paints the
 * border, focus ring, hover, and error state. The inputs inside are
 * seamless leaves with no chrome of their own.
 *
 * Inner inputs must override the descendant rules in `as-default-field`
 * (which paint `inputBase` chrome on every nested `<input>` via a
 * `.as-default-field :is(input:not(...))` selector, specificity 0,1,2).
 * A bare per-input class shortcut (`as-decimal-integer`, specificity
 * 0,1,0) cannot beat that on its own — so the reset properties below
 * ship with UnoCSS `!` qualifiers (= !important) on border/outline/
 * ring/bg/h/px to win the cascade regardless of selector weight.
 *
 * AsDecimal layout: `[ prefix? | integer | . | decimal | suffix? ]` —
 *   two inputs joined by a separator pill, plus optional leading and
 *   trailing adornment pills.
 *
 * AsNumber layout: `[ prefix? | value | suffix? ]` — single input with
 *   optional leading and trailing adornment pills.
 *
 * `AsInput` shares the same adornment pill classes (`as-prefix`,
 *   `as-suffix`) and the `as-input-shell` merged chrome when at least
 *   one adornment is present.
 */
// The descendant rules in `as-default-field` paint `inputBase` (border-1,
// outline, w-full, h-fingertip-m, layer chrome) onto every `<input>` they
// match — at higher CSS specificity than this per-input class. We MUST
// neutralize each of those properties with `!important`; missing any one
// leaves the inner input misshapen. In particular `!w-auto` is required
// because `w-full` from `inputBase` would otherwise stretch a `flex-none`
// decimal input to 100% of the shell, collapsing the `flex-1` integer half.
//
// `!px-0` — bank UX: the inputs should butt directly against the separator
// pill, with the shell's own `px-$xs` carrying the outer padding. Any inner
// horizontal padding leaks visible whitespace between digits and the dot.
const innerInputReset =
  "!w-auto !bg-transparent !border-0 !outline-0 !ring-0 !shadow-none !h-full !px-0 !layer-0 font-mono text-scope-dark-0 dark:text-scope-light-0";

// `flex w-full` — fill the available width of the form's input row so the
// inner integer input has room to flex-grow. `inline-flex` made the shell
// size to content and collapsed the integer half to ~30px.
// `gap-0` — chrome reads as ONE merged input; inner padding is suppressed
// (see `innerInputReset !px-0`) and the separator pill carries its own
// zero-padding via its shortcut entry.
const shellBase = `flex w-full min-w-0 items-center gap-0 ${inputBase} px-$xs py-0`;

// Shared adornment chrome — used by both `as-prefix` and `as-suffix`. The
// inter-element gap (pill ↔ value) lives on the value inputs, not on the
// pills themselves — see the `:has`-based padding rules on `as-input-shell`
// / `as-number` / `as-decimal` below. Putting the gap on the input keeps
// it at body font-size (1em), so text adornments (1em) and icon adornments
// (1.25em) produce an identical visual gap. Pills carry no padding.
const adornmentBase = "text-current/60 select-none whitespace-nowrap";

export const asDecimalNumberShortcuts = defineShortcuts({
  // ── Shared adornment pills (prefix + suffix) ──────────────
  // Adornments stay on the body font; only inputs use `font-mono` for
  // tabular digit alignment.
  "as-prefix": adornmentBase,
  "as-suffix": adornmentBase,

  // ── Icon adornments (`@ui.form.prefix.icon` / `@ui.form.suffix.icon`) ──
  // The annotation argument is dropped onto the span as a CSS class
  // (typically a UnoCSS preset-icons utility like `i-mdi-mail`); the
  // consumer is responsible for safelist / preset coverage. Sizing uses
  // `text-[1.25em]` so the glyph scales slightly larger than the body
  // font. No side padding here — the gap to the value lives on the input
  // (see the `:has`-based rules on each shell) so text + icon adornments
  // produce identical visual gaps regardless of their own font-size.
  "as-prefix-icon": "text-current/60 select-none shrink-0 text-[1.25em] inline-flex items-center",
  "as-suffix-icon": "text-current/60 select-none shrink-0 text-[1.25em] inline-flex items-center",

  // ── AsDecimal shell ───────────────────────────────────────
  "as-decimal": {
    "": shellBase,
    "hover:": "border-current/30",
    "focus-within:": "current-border-hl outline i8-apply-outline",
    "[&.error]:": "scope-error current-border-hl border-current",
    "[&.error]:focus-within:":
      "scope-error current-border-hl border-current outline i8-apply-outline",
    "[&.as-decimal-negative_.as-prefix]:": "text-current-hl",
    // Prefix → integer pl: integer is right-aligned, so pl shifts its
    // digit content away from the prefix, creating the visual gap.
    "[&:has(:is(.as-prefix,.as-prefix-icon))_.as-decimal-integer]:": "!pl-$xs",
    // Suffix → decimal pr when the decimal half exists (scale > 0).
    "[&:has(:is(.as-suffix,.as-suffix-icon))_.as-decimal-decimal]:": "!pr-$xs",
    // Suffix → integer pr when no decimal half (scale === 0, e.g. JPY):
    // integer is the rightmost value; pr shifts its digits left,
    // creating the gap before the suffix.
    "[&:has(:is(.as-suffix,.as-suffix-icon)):not(:has(.as-decimal-decimal))_.as-decimal-integer]:":
      "!pr-$xs",
  },
  "as-decimal-integer": `${innerInputReset} flex-1 min-w-0 text-right disabled:!text-current/40 disabled:!cursor-not-allowed`,
  "as-decimal-sep": "text-current/60 select-none px-0",
  "as-decimal-decimal": `${innerInputReset} flex-none min-w-0 text-left disabled:!text-current/40 disabled:!cursor-not-allowed`,

  // ── AsNumber shell ────────────────────────────────────────
  "as-number": {
    "": shellBase,
    "hover:": "border-current/30",
    "focus-within:": "current-border-hl outline i8-apply-outline",
    "[&.error]:": "scope-error current-border-hl border-current",
    "[&.error]:focus-within:":
      "scope-error current-border-hl border-current outline i8-apply-outline",
    // Gap-to-value lives on the input — see comment on `adornmentBase`.
    "[&:has(:is(.as-prefix,.as-prefix-icon))_.as-number-input]:": "!pl-$xs",
    "[&:has(:is(.as-suffix,.as-suffix-icon))_.as-number-input]:": "!pr-$xs",
  },
  "as-number-input": `${innerInputReset} flex-1 min-w-0 text-right disabled:!text-current/40 disabled:!cursor-not-allowed`,

  // ── AsAdornmentShell merged chrome (any adornment is present) ──
  // Same merged-chrome family as AsDecimal / AsNumber so adornment pills
  // line up visually across the input family. The inner control is
  // either AsInputControl (plain — no adornment) or AsAdornmentShell-
  // wrapped AsInputControl (any adornment — text or icon, prefix or
  // suffix).
  "as-input-shell": {
    "": shellBase,
    "hover:": "border-current/30",
    "focus-within:": "current-border-hl outline i8-apply-outline",
    "[&.error]:": "scope-error current-border-hl border-current",
    "[&.error]:focus-within:":
      "scope-error current-border-hl border-current outline i8-apply-outline",
    // The inner control loses its own chrome — same reset as the
    // decimal/number inputs use, applied to every nested input/textarea.
    "[&_input,&_textarea]:":
      "!w-auto !bg-transparent !border-0 !outline-0 !ring-0 !shadow-none !h-full !px-0 !layer-0 flex-1 min-w-0",
    // Gap-to-value lives on the input — see comment on `adornmentBase`.
    "[&:has(:is(.as-prefix,.as-prefix-icon))_input,&:has(:is(.as-prefix,.as-prefix-icon))_textarea]:":
      "!pl-$xs",
    "[&:has(:is(.as-suffix,.as-suffix-icon))_input,&:has(:is(.as-suffix,.as-suffix-icon))_textarea]:":
      "!pr-$xs",
  },
});
