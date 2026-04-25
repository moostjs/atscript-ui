export { createIconsLoader } from "./icon-loader";
export type { IconsLoaderOptions } from "./icon-loader";
export {
  asIconsPreset,
  asPresetVunor,
  createAsBaseUnoConfig,
  defaultAsIconAliases,
} from "./preset";
export type { AsBaseUnoConfigOptions, AsIconsPresetOptions, AsPresetVunorOptions } from "./preset";

export * from "./shortcuts";

export {
  componentClasses,
  componentPackages,
  getComponentClasses,
  getHelperClasses,
  helperAliases,
} from "./generated/component-classes";

export { defineShortcuts, mergeVunorShortcuts, toUnoShortcut } from "vunor/theme";
export type { TVunorShortcut } from "vunor/theme";
