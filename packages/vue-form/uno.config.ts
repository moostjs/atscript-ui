import { asIconsPreset } from "@atscript/unocss-preset";
import { defineConfig } from "unocss";
import { presetVunor, vunorShortcuts } from "vunor/theme";
import { asFormShortcuts } from "./src/unocss";

export default defineConfig({
  content: {
    filesystem: ["src/**/*.{vue,ts}"],
  },
  presets: [asIconsPreset({ iconsDir: ".icons" }), presetVunor()],
  shortcuts: [vunorShortcuts(asFormShortcuts)],
});
