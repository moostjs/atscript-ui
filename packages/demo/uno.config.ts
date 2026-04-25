import { fileURLToPath } from "node:url";
import {
  allShortcuts,
  asPresetVunor,
  defineShortcuts,
  mergeVunorShortcuts,
} from "@atscript/ui-styles";
import { defineConfig } from "unocss";
import { vunorShortcuts } from "vunor/theme";

const hereDir = fileURLToPath(new URL(".", import.meta.url));

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
});

export default defineConfig({
  content: {
    filesystem: [`${hereDir}src/**/*.{vue,ts,tsx}`],
  },
  presets: asPresetVunor(),
  shortcuts: [vunorShortcuts(mergeVunorShortcuts([allShortcuts, demoShortcuts]))],
});
