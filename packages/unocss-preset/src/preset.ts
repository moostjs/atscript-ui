import presetIcons from "@unocss/preset-icons";
import { createIconsLoader, type IconsLoaderOptions } from "./icon-loader";

export interface AsIconsPresetOptions extends IconsLoaderOptions {
  /**
   * Iconify collection key. Classes will resolve as `i-<collection>-<name>`.
   * Defaults to `"as"` → classes like `i-as-close`.
   */
  collection?: string;
}

/**
 * UnoCSS preset that wires the atscript-ui icons loader under collection `as`.
 *
 * Usage:
 *   import { asIconsPreset } from '@atscript/unocss-preset'
 *   defineConfig({ presets: [asIconsPreset({ iconsDir: '.icons' })] })
 */
export function asIconsPreset(options: AsIconsPresetOptions = {}) {
  const { collection = "as", ...loaderOpts } = options;
  const loader = createIconsLoader(loaderOpts);
  return presetIcons({
    collections: {
      [collection]: loader,
    },
  });
}
