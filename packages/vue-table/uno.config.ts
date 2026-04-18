import { asPresetVunor } from "@atscript/unocss-preset";
import { defineConfig } from "unocss";
import { vunorShortcuts } from "vunor/theme";
import { asTableShortcuts } from "./src/unocss";

export default defineConfig({
  content: {
    filesystem: ["src/**/*.{vue,ts}"],
  },
  presets: asPresetVunor({ iconsDir: ".icons" }),
  shortcuts: [vunorShortcuts(asTableShortcuts)],
});
