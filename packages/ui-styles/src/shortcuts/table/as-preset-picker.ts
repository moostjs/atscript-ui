import { defineShortcuts } from "vunor/theme";

/**
 * `<AsPresetPicker>` Tier-1 dropdown shortcuts. Built on `DropdownMenuRoot`
 * so all keyboard / focus management comes from reka-ui. Composed only
 * through vunor primitives (`scope-*`, `layer-*`, `c8-*`, `i8-*`,
 * `fingertip-*`, spacing tokens) so consumer themes re-skin the picker
 * without touching this file.
 *
 * Class families:
 *   `as-preset-picker`           — outermost wrapper (inline-block)
 *   `as-preset-picker-trigger`   — main button (label + ★ + `*` + chevron)
 *   `as-preset-picker-menu`      — dropdown content panel
 *   `as-preset-picker-section-*` — section header / list
 *   `as-preset-picker-item`      — preset row (system / favorite / mine / public)
 *   `as-preset-picker-separator` — group separator
 *   `as-preset-picker-action`    — Save / Save as / Reset / Manage actions
 *   `as-preset-picker-popover-*` — inline Save-as popover
 */
export const asPresetPickerShortcuts = defineShortcuts({
  "as-preset-picker": "inline-block",
  // Trigger mirrors as-table-actions-btn but `c8-flat` so it sits calmly in
  // a toolbar next to the primary CTA. Bold the active label and append
  // a "*" indicator when dirty (rendered as a small bullet in the template).
  "as-preset-picker-trigger": {
    "": "scope-neutral c8-flat btn",
    "[&[data-state=open]]:": "scope-primary c8-light",
  },
  "as-preset-picker-trigger-label": "text-body whitespace-nowrap",
  "as-preset-picker-trigger-dirty": "text-current/70 ml-[-0.25em]",
  "as-preset-picker-trigger-chevron": "text-[1em] text-current/60 shrink-0 -mr-$xs",

  "as-preset-picker-menu":
    "scope-primary popup-card whitespace-nowrap py-$xs min-w-[16em] max-w-[28em]",

  "as-preset-picker-section": "flex flex-col",
  "as-preset-picker-section-header":
    "px-$m pt-$s pb-$xs text-callout uppercase tracking-wider text-current/60 select-none",

  // Menu item base — mirrors as-row-actions-menu-item exactly, with
  // optional [data-active] state for the currently-applied preset.
  "as-preset-picker-item": {
    "": "flex items-center gap-$s w-full px-$m py-$xs border-0 bg-transparent text-current text-left cursor-pointer outline-none",
    "hover:": "layer-3",
    "data-[highlighted]:": "layer-3",
    "[&[data-active]]:": "font-700",
  },
  // Leading column 0 — shows a primary checkmark on the active row.
  // Reserved width on inactive rows via `visibility: hidden` so labels
  // align across active and inactive items.
  "as-preset-picker-item-active": {
    "": "shrink-0 w-[1em] h-[1em] text-[1em] text-primary-500 invisible",
    "[[data-active]_&]:": "visible",
  },
  "as-preset-picker-item-fav": "text-[1em] text-warn-500 shrink-0",
  "as-preset-picker-item-icon": "inline-flex text-[1.1em] text-current/60 shrink-0 w-[1em] h-[1em]",
  "as-preset-picker-item-label": "flex-1 min-w-0 overflow-hidden text-ellipsis",
  "as-preset-picker-item-meta": "text-callout text-current/60 ml-$s shrink-0 whitespace-nowrap",

  // Aspect strip on each menu row — bordered transparent capsule, same
  // visual language as the dialog. Primary = will-be-applied, body/25 =
  // unclaimed; border reads the active surface var via vunor. Chips use
  // `items-stretch` so each one fills the strip's full height, then a
  // 1px `::before` ruler on every non-first chip paints a vertical grey
  // separator inset top/bottom by `$xs` so it never reaches the
  // capsule's rounded corners.
  "as-preset-picker-item-aspects":
    "inline-flex items-stretch shrink-0 ml-$s h-[1.6em] border-1 rounded-base bg-transparent",
  "as-preset-picker-item-aspect-chip": {
    "": "relative inline-flex items-center justify-center text-[1em] text-current/25 px-$xs",
    "[&[data-on]]:": "text-primary-500",
    // `border-l-1` reads `--current-border` (same var the capsule uses) so
    // the separator visually matches the capsule's outline in any
    // scope/light-mode combination — `bg-current/*` would resolve to the
    // background var (white in light mode → invisible). Inset by `$xxs`
    // top/bottom so the line stays within the rounded corners.
    "[&:not(:first-child)]:before:":
      "content-[''] absolute left-0 top-$xxs bottom-$xxs w-0 border-l-1",
  },

  // Section divider — `border-t-1` reads `--current-border` so it
  // matches the menu's own outer border AND the manager dialog's row
  // separators (same mechanism, same source variable). The previous
  // `bg-scope-light-2/dark:bg-scope-dark-2` baked in a different tone
  // that didn't track scope.
  "as-preset-picker-separator": "h-0 my-$xs border-t-1",

  "as-preset-picker-action": {
    "": "flex items-center gap-$s w-full px-$m py-$xs border-0 bg-transparent text-current text-left cursor-pointer outline-none disabled-soft",
    "hover:": "layer-3",
    "data-[highlighted]:": "layer-3",
    "[&.as-preset-picker-action-primary]:": "font-700 scope-primary text-current-hl",
  },
  // Leading icon on each action row — sits in the same column slot as the
  // item-active checkmark above so the visual rhythm is consistent.
  "as-preset-picker-action-icon": "shrink-0 w-[1em] h-[1em] text-[1em] text-current/60",
  "as-preset-picker-action-label": "flex-1 min-w-0",

  // Inline Save-as popover — same surface chrome as the menu but a small
  // chrome only — surface, padding, sizing, z-index. Vertical-stack layout
  // lives on `-popover-inner` so its keydown wrapper IS the flex container
  // (Tab keydown must bubble through a real DOM element BEFORE reaching
  // Reka's RovingFocusGroup on MenuContent root). `pt-$m` only on the
  // wrapper — the footer owns its own `py-$m` so the space above and below
  // the button row is symmetric (the wrapper's bottom padding would
  // otherwise stack on the footer's bottom and break it).
  "as-preset-picker-popover": "scope-primary popup-card z-[201] pt-$m px-$l min-w-[20em]",
  "as-preset-picker-popover-inner": "flex flex-col gap-$m",
  "as-preset-picker-popover-title": "text-body-l font-600 m-0",
  "as-preset-picker-popover-field": "flex flex-col gap-$xs",
  // Bold body-color labels ("Name", "Save:", etc.) — match reference: not muted.
  "as-preset-picker-popover-label": "text-body font-600 text-current",
  "as-preset-picker-popover-input": "layer-0 i8-bare h-fingertip-m px-$s rounded-r1",
  "as-preset-picker-popover-aspects": "flex flex-col gap-$s",
  // Aspect / public-toggle row. Icon color tracks the checkbox state —
  // primary when the input next to it is checked, body/40 when not — so
  // the row's "this aspect ships" status reads at a glance.
  "as-preset-picker-popover-aspect": {
    "": "flex items-center gap-$s text-body cursor-pointer select-none",
    "[&:has(>input:checked)_.as-preset-picker-popover-aspect-icon]:": "text-primary-500",
  },
  "as-preset-picker-popover-aspect-icon": "text-[1.1em] text-current/40 shrink-0 w-[1em] h-[1em]",
  // Hairline separator above the "Make public" row, matching the dialog's
  // section dividers — `border-1` reads the active surface's border var.
  "as-preset-picker-popover-separator": "h-0 border-t-1 my-$xs",
  "as-preset-picker-popover-public": {
    "": "flex items-center gap-$s text-body cursor-pointer select-none",
    "[&:has(>input:checked)_.as-preset-picker-popover-aspect-icon]:": "text-primary-500",
  },
  // `-mx-$l px-$l` pulls the border-top to the popover's outer edges so
  // the divider spans the full width (popover itself has `px-$l`); `py-$m`
  // gives equal breathing room above + below the button row, owning the
  // popover's bottom margin entirely (wrapper has only `pt-$m`).
  "as-preset-picker-popover-footer":
    "flex items-center justify-end gap-$s py-$m -mx-$l px-$l border-t-1",
  "as-preset-picker-popover-cancel": "scope-neutral c8-chrome btn h-fingertip-s",
  "as-preset-picker-popover-save": "scope-primary c8-filled btn h-fingertip-s",
});
