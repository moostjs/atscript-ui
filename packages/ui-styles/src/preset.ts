import presetIcons from "@unocss/preset-icons";
import type { Preset } from "unocss";
import { presetVunor, vunorShortcuts } from "vunor/theme";
import { createAsExtractor } from "./extractor";
import { bakedIcons } from "./generated/baked-icons";
import { allShortcuts } from "./shortcuts";

/**
 * Default semantic icon → Iconify-id (or local-token) mapping. Source of
 * truth for which icons we bake into `dist/`. Internal — consumed only by
 * `scripts/bake-icons.ts`. Consumers override individual entries via
 * `asPresetVunor({ iconOverrides })`.
 */
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
  "value-help": "value-help",
  sun: "ph:sun",
  moon: "ph:moon",
  check: "ph:check-bold",
  "check-square": "ph:check-square",
  sorters: "sorters",
  refresh: "ph:arrows-clockwise",
  columns: "si:table-columns-line",
  "eye-slash": "iconamoon:eye-off-light",
  ellipsis: "ph:dots-three",
  loading: "loading",
  warning: "ph:warning-circle",
};

/**
 * Builds the `as` icon collection by merging the baked default map with any
 * consumer-supplied overrides, then hands the resolver to UnoCSS's
 * `presetIcons`. Sync, no filesystem, no network — works in every runtime.
 */
function bakedIconsPreset(overrides?: Record<string, string>) {
  const collection = overrides ? { ...bakedIcons, ...overrides } : bakedIcons;
  return presetIcons({
    collections: {
      as: (name: string) => collection[name],
    },
  });
}

export interface AsBaseUnoConfigOptions {
  /** Forwarded to vunor's `baseRadius`; drives `rounded-base` and the `r0..r4` ladder. */
  baseRadius?: string;
}

export interface AsPresetVunorOptions extends AsBaseUnoConfigOptions {
  /**
   * Kebab-case component names whose classes the extractor should drop from
   * the safelist (post-match). Use when the consumer has replaced a built-in
   * default with their own implementation and wants to shed the unused styles.
   * See STYLES.md Decision 15.
   */
  excludeComponents?: string[];
  /**
   * Replace any of our built-in `i-as-<name>` icons with custom SVG strings.
   * Keys are the semantic names listed in `bakedIcons` (e.g. `search`,
   * `close`, `loading`). Values are full `<svg>...</svg>` strings — fetch
   * them from anywhere, paste them inline, copy from another Iconify set,
   * etc. Unknown keys are ignored. Built-in defaults remain untouched for
   * any name not present in this map.
   */
  iconOverrides?: Record<string, string>;
}

/**
 * Preset entry that injects the `@keyframes as-shimmer` definition used by
 * `<AsWindowSkeletonRow>`'s gradient animation. Lives at preset level so the
 * keyframes are emitted exactly once into the consumer's UnoCSS output (not
 * duplicated per shortcut).
 */
const shimmerKeyframesPreset: Preset = {
  name: "atscript-ui-shimmer-keyframes",
  preflights: [
    {
      getCSS: () =>
        "@keyframes as-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }",
    },
  ],
};

function buildBasePresets(options: AsPresetVunorOptions): Preset[] {
  const { baseRadius = "8px", iconOverrides } = options;

  return [
    bakedIconsPreset(iconOverrides),
    shimmerKeyframesPreset,
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

export function asPresetVunor(options: AsPresetVunorOptions = {}): Preset[] {
  const { excludeComponents, ...baseOpts } = options;
  return [
    ...buildBasePresets(baseOpts),
    {
      name: "atscript-ui-extractors",
      extractors: [createAsExtractor({ excludeComponents })],
    } as Preset,
  ];
}

/**
 * Cycle-breaking factory used by the class-extraction script and the
 * pre-built CSS pipeline. Returns the same presets + shortcuts that
 * consumers receive via `asPresetVunor()`, but without the safelist
 * extractor — so the extraction script can compute the safelist that
 * the extractor later imports.
 */
export function createAsBaseUnoConfig(options: AsBaseUnoConfigOptions = {}) {
  return {
    presets: buildBasePresets(options),
    shortcuts: [vunorShortcuts(allShortcuts)],
  };
}
