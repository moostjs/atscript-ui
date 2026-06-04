import { fileURLToPath } from "node:url";
import {
  allShortcuts,
  asPresetVunor,
  defineShortcuts,
  mergeVunorShortcuts,
} from "@atscript/ui-styles";
import { defineConfig, presetIcons } from "unocss";
import { vunorShortcuts } from "vunor/theme";

const hereDir = fileURLToPath(new URL(".", import.meta.url));

// Phosphor brand/UI glyphs (i-ph:*) used across the demo (e.g. the
// demo-card arrow, the SSO provider icons in Section C of the aooth page).
// `asPresetVunor()` already registers a presetIcons for the baked `as`
// collection under the default name `@unocss/preset-icons`; a second bare
// `presetIcons()` would be deduped away (same preset name), so we give this
// one a unique name and explicitly load the installed @iconify-json/ph
// collection. Without this, every `i-ph:*` class silently renders 0×0.
const phosphorIcons = {
  ...presetIcons({
    collections: {
      ph: () => import("@iconify-json/ph/icons.json").then((m) => m.default),
    },
  }),
  name: "preset-icons-ph",
};

const demoShortcuts = defineShortcuts({
  /* ────────── Page-level containers ────────── */
  /** Narrow reading column for single-record edit / form pages. */
  "as-page-narrow": "w-full max-w-[620px] mx-auto flex flex-col gap-$m px-$l py-$l",
  /** Eyebrow label above a page title (matches playground `.view-eyebrow`). */
  "as-page-eyebrow":
    "scope-grey font-mono text-callout font-600 tracking-[0.14em] uppercase text-current/60 mb-$xs",
  /** Page-header row with title + status/actions on the right. */
  "as-page-header": "flex items-center gap-$m mb-$s",
  "as-page-title": "text-[1.54em] font-700 tracking-[-0.02em] m-0",

  /* ────────── Sidebar nav (ported from playground) ────────── */
  "nav-section":
    "scope-grey px-$s pt-$m pb-$xs font-mono text-callout font-600 uppercase tracking-[0.1em] text-current/70",
  "nav-link": "c8-flat flex items-center gap-$s px-$s py-$xs rounded-base no-underline select-none",
  "nav-link-active": "scope-primary c8-flat-selected font-500",
  "nav-brand":
    "flex items-center gap-$s px-$s pt-$s pb-$m mb-$s border-b-1 no-underline text-current",

  /* ────────── Table pagination (ported from playground) ────────── */
  "table-pagination": "flex items-center justify-center gap-$m py-$s flex-shrink-0",
  "table-pagination-size": "w-[5.5em]",
  "table-pagination-list": "flex items-center gap-[0.15em]",
  "table-pagination-btn": {
    "": "scope-primary inline-grid place-items-center w-fingertip-s h-fingertip-s p-0 border-0 bg-transparent text-current/70 cursor-pointer rounded-base text-callout font-500 leading-none outline-none transition-colors",
    "hover:not-disabled:": "layer-2 text-current",
    "disabled:": "opacity-30 cursor-not-allowed",
  },
  "table-pagination-btn-active": "bg-current-hl/10 text-current-hl!",
  "table-pagination-ellipsis":
    "inline-grid place-items-center w-fingertip-s h-fingertip-s text-current/50",
  "table-pagination-loaded": "text-current/60 text-callout",

  /* ────────── Welcome / login demo discovery cards ────────── */
  /** Two-up grid that holds the public demo entry-points beneath the
   *  sign-in card. Single column on phones, side-by-side from `sm:` up. */
  "as-demo-grid": "grid grid-cols-1 sm:grid-cols-2 gap-$s w-full max-w-[480px] sm:max-w-[640px]",
  /** Eyebrow above the demo-grid pair — frames the section so the cards
   *  don't read as orphaned chrome floating below the sign-in card. */
  "as-demo-eyebrow":
    "scope-grey font-mono text-callout font-600 tracking-[0.14em] uppercase text-current/55 text-center m-0",
  /** Demo entry-point card. Outlined (transparent) so it reads as
   *  "explore further" against the elevated sign-in card without
   *  competing for primary-CTA attention. Hover lifts the surface and
   *  reveals the arrow. */
  "as-demo-card": {
    "":
      "group flex flex-col gap-$xs p-$m rounded-r2 border-1 layer-0 no-underline " +
      "text-current cursor-pointer transition-all duration-150 outline-none",
    "hover:": "layer-1 border-current-hl/40 -translate-y-[1px] shadow-popup",
    "focus-visible:": "border-current-hl/60 i8-apply-outline",
  },
  "as-demo-card-head": "flex items-center gap-$s",
  "as-demo-card-icon":
    "scope-primary inline-grid place-items-center size-fingertip-s rounded-base " +
    "bg-current-hl/10 text-current-hl text-[1.15em] shrink-0",
  "as-demo-card-title": "text-body font-600 tracking-[-0.01em] m-0",
  "as-demo-card-arrow": {
    "":
      "scope-primary ml-auto i-ph:arrow-right text-current-hl/70 text-[1.1em] " +
      "transition-transform duration-150",
    "group-hover:": "translate-x-[2px] text-current-hl",
  },
  "as-demo-card-desc": "text-callout text-current/65 leading-snug m-0",
});

export default defineConfig({
  content: {
    filesystem: [`${hereDir}src/**/*.{vue,ts,tsx}`],
  },
  presets: [...asPresetVunor(), phosphorIcons],
  shortcuts: [vunorShortcuts(mergeVunorShortcuts([allShortcuts, demoShortcuts]))],
  // `@ui.form.{prefix,suffix}.icon` paints its value verbatim as a class on
  // the icon span. UnoCSS' static extractor doesn't scan `.as` files, so any
  // icon referenced from a schema must be safelisted by the consumer.
  safelist: [
    "i-as-star-filled",
    "i-as-pin-filled",
    "i-as-check-square",
    "i-as-search",
    "i-as-check",
    // SsoLoginForm provider glyphs referenced from aooth-components.as.
    "i-ph:google-logo",
    "i-ph:apple-logo",
    "i-ph:phone",
    "i-ph:discord-logo",
    "i-ph:facebook-logo",
    "i-ph:windows-logo",
  ],
});
