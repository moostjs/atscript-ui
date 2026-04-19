import presetIcons from "@unocss/preset-icons";
import type { Preset } from "unocss";
import { presetVunor } from "vunor/theme";
import { createIconsLoader, type IconsLoaderOptions } from "./icon-loader";

export interface AsIconsPresetOptions extends IconsLoaderOptions {
  collection?: string;
}

export function asIconsPreset(options: AsIconsPresetOptions = {}) {
  const { collection = "as", ...loaderOpts } = options;
  const loader = createIconsLoader(loaderOpts);
  return presetIcons({
    collections: {
      [collection]: loader,
    },
  });
}

export const defaultAsIconAliases: Record<string, string> = {
  search: "ph:magnifying-glass",
  close: "ph:x",
  plus: "ph:plus",
  "chevron-up": "ph:caret-up",
  "chevron-down": "ph:caret-down",
  "chevron-left": "ph:caret-left",
  "chevron-right": "ph:caret-right",
  "chevron-double-up": "ph:caret-double-up",
  "chevron-double-down": "ph:caret-double-down",
  "chevron-double-left": "ph:caret-double-left",
  "chevron-double-right": "ph:caret-double-right",
  "arrow-up": "ph:arrow-up",
  "arrow-down": "ph:arrow-down",
  grip: "ph:dots-six-vertical",
  filter: "fluent:filter-16-regular",
  "sort-asc": "ph:sort-ascending-light",
  "value-help": "ph:stack",
  sun: "ph:sun",
  moon: "ph:moon",
  check: "ph:check-bold",
  "check-square": "ph:check-square",
  "arrows-down-up": "ph:arrows-down-up",
  refresh: "ph:arrows-clockwise",
  columns: "si:table-columns-line",
  "eye-slash": "iconamoon:eye-off-light",
  ellipsis: "ph:dots-three",
};

export interface AsPresetVunorOptions {
  iconsDir?: string;
  iconAliases?: Record<string, string>;
  iconCollection?: string;
  /** Forwarded to vunor's `baseRadius`; drives `rounded-base` and the `r0..r4` ladder. */
  baseRadius?: string;
}

export function asPresetVunor(options: AsPresetVunorOptions = {}): Preset[] {
  const {
    iconsDir = ".icons",
    iconAliases = {},
    iconCollection = "as",
    baseRadius = "8px",
  } = options;

  return [
    asIconsPreset({
      iconsDir,
      collection: iconCollection,
      aliases: { ...defaultAsIconAliases, ...iconAliases },
    }),
    presetVunor({
      baseRadius,
      fingertip: {
        xs: "20px",
        s: "28px",
        m: "32px",
        l: "36px",
        xl: "40px",
      },
      palette: {
        colors: {
          // Design accent — blue
          primary: "#2563eb",
          // Design neutrals — slate
          grey: "#64748b",
          neutral: "#475569",
          // Design danger — red-600
          error: "#dc2626",
        },
        lightest: 0.97,
        darkest: 0.22,
        layersDepth: 0.08,
      },
    }) as Preset,
  ];
}
