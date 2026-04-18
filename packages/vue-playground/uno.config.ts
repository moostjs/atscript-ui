import { asIconsPreset } from "@atscript/unocss-preset";
import { defineConfig } from "unocss";
import { presetVunor, vunorShortcuts } from "vunor/theme";

// Phase 2: import shortcuts from sibling packages, e.g.
// import { asTableShortcuts } from '@atscript/vue-table/unocss'
// import { asFormShortcuts } from '@atscript/vue-form/unocss'

export default defineConfig({
  content: {
    filesystem: [
      "src/**/*.{vue,ts,tsx}",
      "../vue-table/src/**/*.{vue,ts}",
      "../vue-form/src/**/*.{vue,ts}",
    ],
  },
  presets: [
    asIconsPreset({
      iconsDir: ".icons",
      aliases: {
        // phase-1 smoke test: i-as-sparkle → iconify's ph:sparkle
        sparkle: "ph:sparkle",
      },
    }),
    presetVunor({
      baseRadius: ".5em",
    }),
  ],
  shortcuts: [
    vunorShortcuts(),
    // TODO(phase-2): asTableShortcuts, asFormShortcuts
  ],
});
