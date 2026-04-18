import { fileURLToPath } from "node:url";
import { asPresetVunor, defineShortcuts } from "@atscript/unocss-preset";
import { defineConfig } from "unocss";
import { mergeVunorShortcuts, vunorShortcuts } from "vunor/theme";
import { asFormShortcuts } from "../vue-form/src/unocss";
import { asTableShortcuts } from "../vue-table/src/unocss";

const hereDir = fileURLToPath(new URL(".", import.meta.url));

const playgroundShortcuts = defineShortcuts({
  "nav-section":
    "scope-grey px-[10px] pt-[14px] pb-[4px] font-mono text-[10px] font-600 uppercase tracking-[0.1em] text-current/70",
  "nav-link":
    "c8-flat flex items-center gap-[8px] px-[10px] py-[6px] rounded-[var(--as-radius-sm)] text-[length:var(--as-fs-base)] no-underline select-none",
  "nav-link-active": "scope-primary c8-flat-selected font-500",
  "view-eyebrow":
    "scope-grey font-mono text-[10px] font-600 tracking-[0.14em] uppercase text-current/60 mb-[6px]",
  "view-intro":
    "text-current/70 text-[14px] m-0 mb-[20px] max-w-[60ch] leading-[1.5]",
  "form-debug": "border-l-1",
  "table-page": "flex flex-col flex-1 min-h-0 min-w-0",
  "table-page-filters": "px-[24px] pb-[10px] empty:hidden",
  "table-page-body":
    "flex-1 mx-[24px] mb-[24px] min-w-0 min-h-0 border-1 rounded-[var(--as-radius-lg)] layer-0 overflow-auto",
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
      "check-square": "ph:check-square",
      refresh: "ph:arrows-clockwise",
      columns: "ph:columns",
      inbox: "ph:tray",
      "list-checks": "ph:list-checks",
      "sliders-horizontal": "ph:sliders-horizontal",
      "arrows-down-up": "ph:arrows-down-up",
    },
  }),
  shortcuts: [
    vunorShortcuts(
      mergeVunorShortcuts([asTableShortcuts, asFormShortcuts, playgroundShortcuts]),
    ),
  ],
});
