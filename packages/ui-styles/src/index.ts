export { createAsExtractor } from "./extractor";
export type { AsExtractorOptions } from "./extractor";
export {
  asPresetVunor,
  createAsBaseUnoConfig,
  defaultAsIconAliases,
  defaultAsVunorOptions,
} from "./preset";
export type { AsBaseUnoConfigOptions, AsPresetVunorOptions } from "./preset";

// Node-only (reads/writes the on-disk icon cache) — import it from a build-time
// config (`uno.config.ts`), never from browser code.
export { createIconsLoader } from "./icon-loader";
export type { IconsLoaderOptions } from "./icon-loader";

export * from "./shortcuts";

export {
  componentClasses,
  componentCompanions,
  componentPackages,
  getComponentClasses,
  getHelperClasses,
  helperAliases,
} from "./generated/component-classes";
export type { AsComponentName } from "./generated/component-classes";

export { bakedIcons } from "./generated/baked-icons";

export { defineShortcuts, mergeVunorShortcuts, toUnoShortcut } from "vunor/theme";
export type { TVunorShortcut } from "vunor/theme";
