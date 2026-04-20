import { fileURLToPath } from "node:url";
import { asPresetVunor, defineShortcuts } from "@atscript/unocss-preset";
import { defineConfig } from "unocss";
import { mergeVunorShortcuts, vunorShortcuts } from "vunor/theme";

const hereDir = fileURLToPath(new URL(".", import.meta.url));

const demoShortcuts = defineShortcuts({});

export default defineConfig({
  content: {
    filesystem: [`${hereDir}src/**/*.{vue,ts,tsx}`],
  },
  presets: asPresetVunor({
    iconsDir: ".icons",
  }),
  shortcuts: [vunorShortcuts(mergeVunorShortcuts([demoShortcuts]))],
});
