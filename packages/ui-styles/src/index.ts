export { createAsExtractor } from "./extractor";
export type { AsExtractorOptions } from "./extractor";
export { asPresetVunor, createAsBaseUnoConfig } from "./preset";
export type { AsBaseUnoConfigOptions, AsPresetVunorOptions } from "./preset";

export * from "./shortcuts";

export {
  componentClasses,
  componentPackages,
  getComponentClasses,
  getHelperClasses,
  helperAliases,
} from "./generated/component-classes";

export { bakedIcons } from "./generated/baked-icons";

export { defineShortcuts, mergeVunorShortcuts, toUnoShortcut } from "vunor/theme";
export type { TVunorShortcut } from "vunor/theme";
