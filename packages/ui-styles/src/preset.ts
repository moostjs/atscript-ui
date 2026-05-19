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
  filter: "tabler:filter-2",
  "filter-ops": "tabler:filter-2-edit",
  "sort-asc": "ph:sort-ascending-light",
  "value-help": "value-help",
  sun: "ph:sun",
  moon: "ph:moon",
  check: "ph:check-bold",
  "check-square": "ph:check-square",
  sorters: "tabler:sort-ascending",
  refresh: "ph:arrows-clockwise",
  columns: "tabler:columns-3",
  "eye-slash": "iconamoon:eye-off-light",
  // `eye` reads as "public/shared with people" — the bxs:group glyph is
  // a clearer signifier than an actual eye for the public-preset toggle.
  eye: "bxs:group",
  "eye-off": "bx:group",
  star: "ph:star",
  "star-filled": "ph:star-fill",
  pin: "ph:push-pin",
  "pin-filled": "ph:push-pin-fill",
  settings: "ph:gear-six",
  ellipsis: "ph:dots-three",
  menu: "heroicons-outline:menu",
  trash: "iconoir:trash",
  loading: "loading",
  warning: "ph:warning-circle",
  "field-empty": "field-empty",
  "field-fill": "field-fill",
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

/**
 * Full `presetVunor()` options object. Re-exported so consumers can type
 * their own theme overrides without reaching into `vunor/theme` themselves.
 */
export type AsVunorPresetOptions = NonNullable<Parameters<typeof presetVunor>[0]>;

/**
 * Baked-in vunor theme defaults atscript-ui has shipped since day one.
 * Any field a consumer omits from `asPresetVunor({ vunor: ... })` falls
 * back to the value here. Exported so consumers can read the defaults
 * if they want to extend (rather than replace) a nested map.
 */
export const defaultAsVunorOptions = {
  baseRadius: "4px",
  fingertip: {
    xs: "1.5em",
    s: "2.15em",
    m: "2.6em",
    l: "2.9em",
    xl: "3.25em",
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
} as const satisfies AsVunorPresetOptions;

/**
 * Full `presetVunor()` theme options. Every field is optional and merged on
 * top of the baked atscript-ui defaults (`defaultAsVunorOptions`):
 * - `palette.colors` is shallow-merged so consumers can override one colour
 *   without losing the others.
 * - `fingertip` is shallow-merged the same way.
 * - All other fields (`baseRadius`, `typography`, `animation`, …) replace
 *   the default wholesale — provide a complete shape if you set them.
 */
export interface AsBaseUnoConfigOptions extends AsVunorPresetOptions {}

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

/**
 * Preset entry that injects the `@keyframes as-progress-fill` definition
 * driving the `c8-progress-fill` shortcut (and any other consumer that wants
 * a 0→100% left-to-right width fill). Duration is supplied per-instance via
 * the `--progress-duration` CSS custom property on the host element, so the
 * same keyframes serve every timed-fill UI — no per-duration class explosion.
 */
const progressKeyframesPreset: Preset = {
  name: "atscript-ui-progress-keyframes",
  preflights: [
    {
      getCSS: () => "@keyframes as-progress-fill { from { width: 0%; } to { width: 100%; } }",
    },
  ],
};

/**
 * No-op marker classes referenced by other shortcuts. UnoCSS warns
 * `unmatched utility "X" in shortcut "Y"` when a shortcut body references
 * a utility that doesn't resolve to any rule:
 * - `group` is registered by `presetWind` only as a *variant* (for
 *   `group-hover:`, `group-data-*:`, …) — not a static rule. Templates
 *   that put `group` on a parent so children can use `group-hover:foo`
 *   compile fine at the call site, but referencing `group` inside a
 *   `defineShortcuts` body trips the warning.
 * - `btn-square` is a vunor marker class (`{ '': '' }` empty-body
 *   shortcut). Empty body resolves to nothing, which UnoCSS reports
 *   the same way — yet it's load-bearing because `btn`'s
 *   `[&.btn-square]:` variant relies on it being present in the class
 *   list.
 *
 * Both are intentional: the class needs to exist on the element so a
 * descendant variant or peer shortcut can target it. We register a
 * dynamic rule whose body function returns `undefined`, which gives
 * `parseUtil` a successful match but emits no CSS — the warning's
 * suppressed and the consumer output stays byte-identical.
 */
const markerRulesPreset: Preset = {
  name: "atscript-ui-marker-rules",
  rules: [
    // Body uses a `$$`-prefixed entry — UnoCSS' `clearIdenticalEntries`
    // strips `$$*` keys before serialising, so `parseUtil` succeeds (the
    // entry-count check passes inside `resolveCSSResult`) but no CSS is
    // emitted into the shortcut body or the standalone selector. This
    // suppresses the warning with zero impact on consumer output.
    ["group", { $$noop: "" }],
    ["btn-square", { $$noop: "" }],
  ],
};

/**
 * Form-grid preset.
 *
 * 1. Registers the `as-narrow:` variant — `as-narrow:col-span-12` resolves
 *    to `@container as-grid (max-width: 480px) { .as-narrow\\:col-span-12
 *    { ... } }`. The parent grid declares `container-name: as-grid` via
 *    `as-form-grid`, so the rule activates against the grid's inline size,
 *    not the viewport. Nested grids re-evaluate independently — an inner
 *    grid inside a half-width slot stacks automatically when the outer
 *    grid hits narrow.
 *
 * 2. Safelists `col-span-N` / `row-span-N` (and their `as-narrow:` flavours)
 *    so the dynamic classes `AsField` stamps from
 *    `@ui.form.grid.colSpan|rowSpan` always appear in the consumer's
 *    generated CSS — the static extractor cannot see them in source.
 *    Row-span ceiling is 6, which is plenty for any sane form layout
 *    and keeps the safelist bloat bounded.
 */
const FORM_GRID_NARROW_BREAKPOINT = "480px";
const FORM_GRID_CONTAINER_NAME = "as-grid";

const FORM_GRID_SAFELIST: string[] = (() => {
  const list: string[] = [];
  for (let i = 1; i <= 12; i++) {
    list.push(`col-span-${i}`, `as-narrow:col-span-${i}`);
  }
  for (let i = 1; i <= 6; i++) {
    list.push(`row-span-${i}`, `as-narrow:row-span-${i}`);
  }
  return list;
})();

const formGridSafelistPreset: Preset = {
  name: "atscript-ui-form-grid",
  variants: [
    {
      name: "as-narrow",
      match(matcher) {
        const prefix = "as-narrow:";
        if (!matcher.startsWith(prefix)) return undefined;
        return {
          matcher: matcher.slice(prefix.length),
          handle: (input, next) =>
            next({
              ...input,
              parent: `${input.parent ? `${input.parent} $$ ` : ""}@container ${FORM_GRID_CONTAINER_NAME} (max-width: ${FORM_GRID_NARROW_BREAKPOINT})`,
            }),
        };
      },
    },
  ],
  safelist: FORM_GRID_SAFELIST,
};

/**
 * Merges consumer-supplied vunor options on top of `defaultAsVunorOptions`.
 * `palette.colors` and `fingertip` shallow-merge per-key so a consumer can
 * override one entry without redeclaring the whole map; every other field
 * replaces the default outright.
 */
function mergeVunorOptions(user: AsVunorPresetOptions | undefined): AsVunorPresetOptions {
  if (!user) return defaultAsVunorOptions;
  const { fingertip, palette, ...rest } = user;
  return {
    ...defaultAsVunorOptions,
    ...rest,
    fingertip: { ...defaultAsVunorOptions.fingertip, ...fingertip },
    palette: palette
      ? {
          ...defaultAsVunorOptions.palette,
          ...palette,
          colors: { ...defaultAsVunorOptions.palette.colors, ...palette.colors },
        }
      : defaultAsVunorOptions.palette,
  };
}

function buildBasePresets(options: AsPresetVunorOptions): Preset[] {
  const { iconOverrides, excludeComponents: _exc, ...vunorOpts } = options;

  return [
    bakedIconsPreset(iconOverrides),
    shimmerKeyframesPreset,
    progressKeyframesPreset,
    markerRulesPreset,
    formGridSafelistPreset,
    presetVunor(mergeVunorOptions(vunorOpts)) as Preset,
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
