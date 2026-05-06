import { defineShortcuts } from "vunor/theme";
import { dialogBase, dialogOverlay } from "./_shared";

/**
 * `<AsPresetDialog>` Tier-2 default. Centred-card management dialog
 * (mirroring `<AsConfirmDialog>` chrome) with a single scrollable list of
 * preset rows. Composed exclusively through vunor primitives so consumer
 * themes re-skin without touching this file.
 */
export const asPresetDialogShortcuts = defineShortcuts({
  "as-preset-dialog-overlay": dialogOverlay,
  // Compact card variant — same trick as `as-confirm-dialog-content`: cancel
  // the mobile full-screen path with `!`-prefixed positioning so the dialog
  // is a centred card at every breakpoint.
  // Mobile: inherit `dialogBase`'s `inset-0 size-full` so the dialog
  // fills the viewport edge-to-edge as a sheet — no rounded corners,
  // no border, no shadow. `sm:` and above: re-establish the centred
  // card with its `min-w` / `max-w` clamps.
  "as-preset-dialog-content": `${dialogBase} sm:!inset-auto sm:!top-1/2 sm:!left-1/2 sm:!-translate-x-1/2 sm:!-translate-y-1/2 sm:!size-auto sm:!rounded-r3 sm:!shadow-popup sm:!border-1 sm:min-w-[560px] sm:max-w-[min(820px,92vw)] sm:max-h-[min(80vh,720px)]`,
  "as-preset-dialog-header": "flex items-center gap-$m px-$l py-$m border-b-1",
  // Title sits inline with the counter pill (no `flex-1` — that would push
  // the pill to the far right). The close button gets `ml-auto` instead
  // so it stays anchored to the right edge regardless of title length.
  "as-preset-dialog-title": "!m-0 !p-0 text-body-l font-600 min-w-0",
  // Counter pill — small rounded chip showing `<owned>/<limit>`. Soft
  // layer-2 fill so it reads as a subtle status pill, not a button.
  "as-preset-dialog-counter":
    "inline-flex items-center px-$s py-$xxs rounded-r2 layer-2 text-callout text-current/60 font-mono whitespace-nowrap",
  "as-preset-dialog-close": {
    "": "ml-auto scope-neutral c8-flat btn btn-square h-fingertip-s rounded-base",
    "hover:": "layer-2",
  },

  "as-preset-dialog-body": "flex flex-col flex-1 min-h-0 overflow-y-auto py-$xs",

  "as-preset-dialog-section": "flex flex-col",
  // Section header label between row groups. Visual divider above the
  // header is provided by the previous row's `border-b-1` — the header
  // itself just sits as a label.
  "as-preset-dialog-section-header":
    "px-$l pt-$m pb-$xs text-callout uppercase tracking-wider text-current/50 select-none font-500",

  // Toolbar row: search input on the left, legend on the right. Sits
  // immediately under the header, above the body list. `layer-1` lifts
  // it off the body's layer-0 surface so the search-and-hints zone reads
  // as a distinct toolbar band.
  "as-preset-dialog-toolbar": "flex items-center gap-$m px-$l py-$s border-b-1 layer-1",
  "as-preset-dialog-search": "relative flex-1 min-w-0",
  // Sits inside the input's left padding column. Width matches the input
  // padding so the placeholder text starts cleanly to its right with no
  // overlap regardless of font metrics.
  "as-preset-dialog-search-icon":
    "absolute left-$s top-1/2 -translate-y-1/2 text-current/50 text-[1em] pointer-events-none w-[1em] h-[1em]",
  // `scope-primary` so the focus ring + outline read in the brand accent —
  // the search box is the primary entry point of this dialog so it should
  // visually dominate while typing.
  "as-preset-dialog-search-input":
    "scope-primary layer-0 i8-bare w-full h-fingertip-s pl-$xl pr-$s rounded-r1",
  // Hidden on mobile so the search input gets the full toolbar width;
  // hints reappear at sm+ where there's room for them.
  "as-preset-dialog-legend":
    "hidden sm:flex items-center gap-$m text-callout text-current/60 shrink-0",
  "as-preset-dialog-legend-item": "inline-flex items-center gap-$xs",
  "as-preset-dialog-legend-icon": "text-[1.05em]",
  "as-preset-dialog-empty": "px-$l py-$m text-body text-current/60 text-center !m-0",

  // Hover tint for "this row is interactive". `border-b-1` paints the
  // divider between rows AND between the last row of one section and
  // the next section header — section headers themselves draw no border
  // so the row's bottom edge handles both. Rows queued for delete get a
  // strike-through + dim so the user can spot them at a glance —
  // re-clicking trash undoes the mark.
  "as-preset-dialog-row": {
    "": "flex items-center gap-$xs px-$l py-$xs border-0 border-b-1 outline-none",
    "hover:": "layer-3",
    "[&[data-deleted]]:": "opacity-40",
    // Flat selector — nested `[&[data-deleted]]:[&_.X]:line-through`
    // compiles wrong (the inner `&` doesn't see the parent row), so write
    // the descendant chain in a single arbitrary variant.
    "[&[data-deleted]_.as-preset-dialog-row-label-text]:": "line-through",
  },
  // Radio in column 0 — picks which preset Save will apply.
  "as-preset-dialog-row-active": "shrink-0 cursor-pointer accent-primary-500",
  // Single shape across pin / fav / public — outlined off-state, soft
  // primary-tinted "filled" on-state with a primary-icon. Direct primary
  // palette (`bg-primary-500/12 …`) so the chip ALWAYS reads as the brand
  // accent regardless of the row's active scope; the alternative would
  // be `current-hl/*` tokens which depend on the surrounding scope and
  // wouldn't stand out the same way against `scope-neutral` row chrome.
  "as-preset-dialog-row-default": {
    "": "scope-neutral c8-flat inline-flex items-center justify-center size-fingertip-s rounded-base cursor-pointer text-current/40 shrink-0",
    "hover:": "scope-primary layer-2 text-current-hl",
    "[&[data-on]]:": "scope-primary layer-2 border-1 current-border-hl text-primary-500",
  },
  "as-preset-dialog-row-fav": {
    "": "scope-neutral c8-flat inline-flex items-center justify-center size-fingertip-s rounded-base cursor-pointer text-current/40 shrink-0",
    "hover:": "scope-primary layer-2 text-current-hl",
    "[&[data-on]]:": "scope-primary layer-2 border-1 current-border-hl text-primary-500",
  },
  // Holds the column-grid slot when the fav button isn't rendered (own +
  // system rows) so labels still align with the public-preset rows below.
  "as-preset-dialog-row-fav-spacer": "inline-block size-fingertip-s shrink-0",
  "as-preset-dialog-row-label": "flex-1 min-w-0 flex items-center gap-$s",
  // `[data-pending]` modifier signals a staged rename. Asterisk lives on
  // `::after` so the `truncate` ellipsis on long labels doesn't eat it.
  "as-preset-dialog-row-label-text": {
    "": "truncate text-body",
    "[&[data-pending]]:": "italic text-primary-500",
    "[&[data-pending]]:after:": "content-['*'] ml-$xxs not-italic",
  },
  // `scope-primary` so the inline rename's focus ring + outline match
  // the search input — same accent for "actively editing this control".
  "as-preset-dialog-row-rename":
    "scope-primary layer-0 i8-bare flex-1 min-w-0 h-fingertip-s px-$s rounded-r1",
  "as-preset-dialog-row-meta": "text-callout text-current/60 whitespace-nowrap",
  // Owner column — fixed width so the row's column grid stays consistent
  // across all rows regardless of name length. Hidden on narrow screens
  // (< sm = 640px) so mobile rows aren't crowded — the label still
  // identifies the row, owner reappears at tablet widths and above.
  "as-preset-dialog-row-owner":
    "hidden sm:block shrink-0 w-[7em] text-callout text-current/60 truncate whitespace-nowrap",
  // Italic "you" for the current user's own rows — quick visual cue that
  // doesn't compete with real usernames in the same column.
  "as-preset-dialog-row-owner-self": "italic",
  "as-preset-dialog-row-public-spacer": "inline-block size-fingertip-s shrink-0",
  "as-preset-dialog-row-delete-spacer": "inline-block size-fingertip-s shrink-0",
  // Single bordered "frame" holding all aspect icons inline — transparent
  // bg so the row's surface color shows through. Border-1 reads the
  // active scope's border var; rounded-base ties the corner radius to the
  // theme's `--v-base-radius` (override globally via the preset's
  // `baseRadius` option, never per-component). `items-stretch` so each
  // chip fills the strip's full height — chip's `::before` ruler then
  // paints the vertical separators (inset top/bottom by `$xs` so it
  // never reaches the rounded corners).
  "as-preset-dialog-aspect-strip":
    "hidden sm:inline-flex items-stretch shrink-0 h-[1.6em] border-1 rounded-base bg-transparent",
  // Active = primary color (theme accent — `text-primary-500` follows
  // whatever the consumer set as the primary palette). Inactive = body
  // color at 25% so the off-state reads as decisively muted, leaving
  // active vs inactive unambiguous at a glance. `::before` rule paints
  // the vertical separators between chips.
  "as-preset-dialog-aspect-chip": {
    "": "relative inline-flex items-center justify-center text-[1em] text-current/25 px-$xs",
    "[&[data-on]]:": "text-primary-500",
    // `border-l-1` reads `--current-border` (same var the capsule uses) so
    // the separator matches the outline in any scope/light-mode combo —
    // `bg-current/*` resolves to the background var (invisible).
    "[&:not(:first-child)]:before:":
      "content-[''] absolute left-0 top-$xxs bottom-$xxs w-0 border-l-1",
  },
  "as-preset-dialog-row-public-toggle": {
    "": "scope-neutral c8-flat inline-flex items-center justify-center size-fingertip-s rounded-base cursor-pointer text-current/40 shrink-0",
    "hover:": "scope-primary layer-2 text-current-hl",
    "[&[data-on]]:": "scope-primary layer-2 border-1 current-border-hl text-primary-500",
  },
  // Display-only public marker on others' rows — same color as the toggle's
  // on-state so the visual language stays consistent.
  "as-preset-dialog-row-public-indicator":
    "inline-flex items-center justify-center size-fingertip-s rounded-base text-primary-500 shrink-0",
  // Delete is now a toggle (mark for deletion / undo) so it follows the
  // same pin/fav/public language. Scope-error on hover is a holdout —
  // destructive action still reads red on hover, but the on-state uses
  // scope-primary for visual consistency with the other toggles.
  "as-preset-dialog-row-delete": {
    "": "scope-neutral c8-flat inline-flex items-center justify-center size-fingertip-s rounded-base cursor-pointer text-current/40 shrink-0",
    "hover:": "scope-error layer-2 text-current-hl",
    "[&[data-on]]:": "scope-error text-current-hl",
  },

  // Footer flex-justify-between — `status` sits left, `actions` right.
  // The last row's `border-b-1` already separates the body from the
  // footer; no additional `border-t-1` here.
  "as-preset-dialog-footer": "flex items-center justify-between gap-$s px-$l py-$m",
  "as-preset-dialog-footer-status": "flex items-center gap-$xs min-w-0",
  // "● unsaved changes" pill on the left — primary dot so it reads as
  // "draft state" without being alarming.
  "as-preset-dialog-footer-unsaved":
    "inline-flex items-center gap-$xs text-callout text-current/60",
  "as-preset-dialog-footer-unsaved-dot":
    "inline-block w-[0.55em] h-[0.55em] rounded-full bg-primary-500 shrink-0",
  "as-preset-dialog-footer-actions": "flex items-center gap-$s",
  "as-preset-dialog-footer-close": "scope-neutral c8-chrome btn",
  "as-preset-dialog-footer-save": {
    "": "scope-primary c8-filled btn",
    "[&:disabled]:": "pointer-events-none",
  },
});
