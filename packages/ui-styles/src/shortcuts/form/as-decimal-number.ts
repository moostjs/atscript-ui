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

export const asDecimalNumberShortcuts = defineShortcuts({
  // ── Shared adornment pills (prefix + suffix) ──────────────
  // Font size and family match the inner inputs (body size from
  // `inputBase` inheritance, `font-mono` here for tabular numeric
  // alignment) — only the color is muted to read as chrome, not value.
  "as-prefix": "text-current/60 select-none whitespace-nowrap font-mono",
  "as-suffix": "text-current/60 select-none whitespace-nowrap font-mono",

  // ── AsDecimal shell ───────────────────────────────────────
  "as-decimal": {
    "": shellBase,
    "hover:": "border-current/30",
    "focus-within:": "current-border-hl outline i8-apply-outline",
    "[&.error]:": "scope-error current-border-hl border-current",
    "[&.error]:focus-within:":
      "scope-error current-border-hl border-current outline i8-apply-outline",
    "[&.as-decimal-negative_.as-prefix]:": "text-current-hl",
  },
  "as-decimal-integer": `${innerInputReset} flex-1 min-w-0 text-right disabled:!text-current/40 disabled:!cursor-not-allowed`,
  "as-decimal-sep": "text-current/60 select-none font-mono px-0",
  "as-decimal-decimal": `${innerInputReset} flex-none min-w-0 text-left disabled:!text-current/40 disabled:!cursor-not-allowed`,

  // ── AsNumber shell ────────────────────────────────────────
  "as-number": {
    "": shellBase,
    "hover:": "border-current/30",
    "focus-within:": "current-border-hl outline i8-apply-outline",
    "[&.error]:": "scope-error current-border-hl border-current",
    "[&.error]:focus-within:":
      "scope-error current-border-hl border-current outline i8-apply-outline",
  },
  "as-number-input": `${innerInputReset} flex-1 min-w-0 disabled:!text-current/40 disabled:!cursor-not-allowed`,

  // ── AsInput merged shell (when prefix/suffix is present) ──
  // Same merged-chrome family as AsDecimal/AsNumber so adornment pills
  // line up visually across the input family. The inner control is
  // either AsInputControl (plain) or the `as-input-with-icon` wrapper.
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
  },
  // When AsInput's icon overlay is active inside the merged shell the
  // wrapper must NOT add its own padding (the shell already owns layout).
  "as-input-shell-icon-wrap": "flex-1 min-w-0",
});
