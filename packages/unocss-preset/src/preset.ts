import presetIcons from "@unocss/preset-icons";
import type { Preset } from "unocss";
import { presetVunor } from "vunor/theme";
import { createIconsLoader, type IconsLoaderOptions } from "./icon-loader";
import { asTokensPreflight } from "./tokens";

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
  sparkle: "ph:sparkle",
  search: "ph:magnifying-glass",
  close: "ph:x",
  check: "ph:check",
  minus: "ph:minus",
  plus: "ph:plus",
  "chevron-up": "ph:caret-up",
  "chevron-down": "ph:caret-down",
  "chevron-left": "ph:caret-left",
  "chevron-right": "ph:caret-right",
  "arrow-up": "ph:arrow-up",
  "arrow-down": "ph:arrow-down",
  "arrow-up-to-line": "ph:arrow-line-up",
  "arrow-down-to-line": "ph:arrow-line-down",
  grip: "ph:dots-six-vertical",
  funnel: "ph:funnel",
  "sort-asc": "ph:sort-ascending",
  "sort-desc": "ph:sort-descending",
  warning: "ph:warning",
  info: "ph:info",
  "value-help": "ph:stack",
  trash: "ph:trash",
  "x-circle": "ph:x-circle",
  sun: "ph:sun",
  moon: "ph:moon",
  gear: "ph:gear",
  table: "ph:table",
  "list-bullets": "ph:list-bullets",
  "squares-four": "ph:squares-four",
  "check-square": "ph:check-square",
  "list-checks": "ph:list-checks",
  "sliders-horizontal": "ph:sliders-horizontal",
  "arrows-down-up": "ph:arrows-down-up",
  refresh: "ph:arrows-clockwise",
  columns: "ph:columns",
  inbox: "ph:tray",
};

export interface AsPresetVunorOptions {
  iconsDir?: string;
  iconAliases?: Record<string, string>;
  iconCollection?: string;
}

/**
 * The atscript-ui preset: vunor with a slate+blue palette tuned to match the
 * design bundle, plus the `i-as-*` icons loader and a small preflight with
 * design-specific tokens (shadows, radii, typography) that can't be expressed
 * through vunor's scope/layer system.
 */
export function asPresetVunor(options: AsPresetVunorOptions = {}): Preset[] {
  const { iconsDir = ".icons", iconAliases = {}, iconCollection = "as" } = options;

  return [
    asIconsPreset({
      iconsDir,
      collection: iconCollection,
      aliases: { ...defaultAsIconAliases, ...iconAliases },
    }),
    presetVunor({
      baseRadius: "7px",
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
    asTokensPreflight(),
  ];
}
