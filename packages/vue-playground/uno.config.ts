import { fileURLToPath } from "node:url";
import { asPresetVunor } from "@atscript/unocss-preset";
import { defineConfig } from "unocss";
import { mergeVunorShortcuts, vunorShortcuts } from "vunor/theme";
import { asFormShortcuts } from "../vue-form/src/unocss";
import { asTableShortcuts } from "../vue-table/src/unocss";

const hereDir = fileURLToPath(new URL(".", import.meta.url));

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
  presets: asPresetVunor({ iconsDir: ".icons" }),
  shortcuts: [
    vunorShortcuts(mergeVunorShortcuts([asTableShortcuts, asFormShortcuts])),
  ],
});
