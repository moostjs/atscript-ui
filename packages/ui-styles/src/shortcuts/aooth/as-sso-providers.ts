import { defineShortcuts } from "vunor/theme";

// `as-sso-providers` is the FieldShell `field-class`, applied to the shell
// ROOT (`.as-default-field`). The vertical column layout now lives on the
// `as-sso-providers-stack` child (the single flex-column owner inside the
// shell's flex-ROW input-row); the root just needs to span the form column.
export const asSsoProvidersShortcuts = defineShortcuts({
  // `scope-neutral` is declared HERE, on the picker root, and cascades down to
  // every descendant — so the `c8-chrome` buttons/chips below read as calm
  // neutral card-chrome regardless of the form's surrounding scope.
  "as-sso-providers": "scope-neutral w-full",

  // The single flex-column child of the shell's `as-field-input-row` (a flex
  // ROW). Owns the vertical layout: primary stack → "or" divider → secondary
  // chip group, with consistent gaps. Wrapping all three in one stack keeps
  // them from laying out side-by-side in the input-row.
  "as-sso-providers-stack": "flex flex-col gap-$m w-full",

  // Primary providers — stacked full-width buttons (the prominent path,
  // e.g. "Continue with Google").
  "as-sso-providers-primary": "flex flex-col gap-$s w-full",

  // Full-width primary button. `c8-chrome` is a card-like neutral surface that
  // follows the (neutral) scope set on the picker root — matching the design's
  // surfaced buttons instead of a thin outline. It also sidesteps the
  // `c8-outlined` state-variant expansion that emitted the
  // `aria-[pressed=true]:c8-flat-hover` "unmatched utility" build warnings.
  // `btn` supplies the layout glue (flex/items-center) that c8 deliberately
  // omits. `h-fingertip-l` matches the tall, finger-friendly buttons in the
  // screenshot. Icon sits left of the centered icon+text group.
  "as-sso-provider-btn":
    "c8-chrome btn w-full h-fingertip-l justify-center gap-$s px-$m text-body-l cursor-pointer disabled-soft",

  // "or" divider: a centered word flanked by two hairline rules. The lines
  // are `flex-1` spacers with `border-t-1` — `border-1` reads the active
  // surface's border var, so no pixel literal or hardcoded color. The word
  // reads as muted secondary text between the two groups.
  "as-sso-providers-divider": {
    "": "flex items-center gap-$s text-current-muted text-callout select-none",
    "[&::before]:": 'content-[""] flex-1 border-t-1',
    "[&::after]:": 'content-[""] flex-1 border-t-1',
  },

  // Secondary providers — a row of equal-width chips. `grid-cols-3` matches
  // the screenshot's three equal columns; assumes a small secondary count
  // (a 4th provider wraps to a second row, still equal-width). Switch to
  // `flex flex-wrap` here if uneven counts ever look unbalanced.
  "as-sso-providers-secondary": "grid grid-cols-3 gap-$s w-full",

  // Compact secondary chip. Shares the `c8-chrome` card-surface family with the
  // primary buttons so the chips read as the same surfaced controls (the design
  // shows surfaced chips, not flat text). Lighter prominence comes purely from
  // size — `h-fingertip-m` for a smaller (but still tappable) target and
  // `text-callout` for the denser label — not from a flatter surface. `btn` for
  // layout glue.
  "as-sso-provider-chip":
    "c8-chrome btn h-fingertip-m justify-center gap-$xs px-$s text-callout cursor-pointer disabled-soft",

  // Brand glyph — em-based sizing (per CLAUDE.md icon-glyph rule) so the
  // icon scales with its button's font size; never shrinks in the flex row.
  "as-sso-provider-icon": "text-[1.25em] flex-shrink-0",
});
