import { fileURLToPath } from "node:url";
import { asPresetVunor, defineShortcuts } from "@atscript/unocss-preset";
import { defineConfig } from "unocss";
import { mergeVunorShortcuts, vunorShortcuts } from "vunor/theme";
import { asFormShortcuts } from "../vue-form/src/unocss";
import { asTableShortcuts } from "../vue-table/src/unocss";

const hereDir = fileURLToPath(new URL(".", import.meta.url));

const playgroundShortcuts = defineShortcuts({
  "nav-section":
    "scope-grey px-$s pt-$m pb-$xs font-mono text-callout font-600 uppercase tracking-[0.1em] text-current/70",
  "nav-link": "c8-flat flex items-center gap-$s px-$s py-$xs rounded-base no-underline select-none",
  "nav-link-active": "scope-primary c8-flat-selected font-500",
  "view-eyebrow":
    "scope-grey font-mono text-callout font-600 tracking-[0.14em] uppercase text-current/60 mb-$xs",
  "view-intro": "text-current/70 m-0 mb-$l max-w-[60ch] leading-[1.5]",
  "form-debug": "border-l-1",
  "table-page": "flex flex-col flex-1 min-h-0 min-w-0",
  "table-page-filters": "px-$l pb-$s empty:hidden",
  "table-page-body": "flex-1 mx-$l mb-$l min-w-0 min-h-0 border-1 rounded-r2 layer-0 overflow-auto",
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
    filesystem: [
      `${hereDir}src/**/*.{vue,ts,tsx}`,
      `${hereDir}../vue-form/src/**/*.{vue,ts}`,
      `${hereDir}../vue-table/src/**/*.{vue,ts}`,
      `${hereDir}../vue-form/src/unocss/shortcuts.ts`,
      `${hereDir}../vue-table/src/unocss/shortcuts.ts`,
    ],
  },
  presets: asPresetVunor({
    iconsDir: ".icons",
    iconAliases: {
      "value-help": "local:none",
      "sort-asc": "local:none",
    },
  }),
  shortcuts: [
    vunorShortcuts(mergeVunorShortcuts([asTableShortcuts, asFormShortcuts, playgroundShortcuts])),
  ],
});
