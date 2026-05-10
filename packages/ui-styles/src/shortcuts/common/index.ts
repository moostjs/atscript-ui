import { defineShortcuts, mergeVunorShortcuts } from "vunor/theme";

const baseCommon = defineShortcuts({
  // Keyboard shortcut badge — small button-shaped hint shown next to text
  // that reveals which key triggers the action (e.g. "See All  F4 ").
  // Matches the column-menu's per-item hint badge so all keystroke
  // indicators across the UI share a single visual language.
  "as-kbd":
    "inline-flex items-center justify-center min-w-[1.5em] h-[1.5em] px-$xs rounded-r0 layer-2 text-callout font-mono font-600 text-current/70 leading-none shrink-0",
  // Single source of truth for descriptive helper text (size + color +
  // margin reset). Case-specific descriptions extend this so consumers
  // restyle every description across the UI by overriding one shortcut.
  "as-description": "text-callout text-current/60 m-0",
  // Shared in-flight loading overlay base. Case-specific overlays
  // (`as-form-overlay`, `as-table-query-overlay`, …) extend this so
  // consumers can restyle every overlay surface — or a single variant —
  // through one shortcut. `pointer-events-none` because pointer
  // suppression is owned by the host's `inert` attribute.
  "as-overlay": "inner-loading rounded-r2 text-current-hl pointer-events-none",
  "as-overlay-icon": "i-as-loading text-[3em]",
  // Shared close-button base for compact icon-only dismiss controls
  // (dialog headers, dismissable banners). Single source of truth for
  // size + chrome + hover, so consumers restyle every close button across
  // the UI through one shortcut. Composers add positioning utilities
  // (e.g. `ml-auto`) at the call site rather than forking the body.
  "as-close-btn": {
    "":
      "inline-grid place-items-center size-fingertip-s p-0 border-0 " +
      "bg-transparent text-current/80 cursor-pointer leading-none rounded-base " +
      "flex-shrink-0 transition-colors duration-120 text-[1.25em]",
    "hover:": "layer-2 text-current",
  },
  // Dialog header close button — extends `as-close-btn` with `ml-auto`
  // so it pins to the right edge of a flex header regardless of title
  // length. Banner-style dismiss controls that don't need right-pinning
  // consume `as-close-btn` directly.
  "as-dialog-close": "as-close-btn ml-auto",
});

export const commonShortcuts = mergeVunorShortcuts([baseCommon]);
