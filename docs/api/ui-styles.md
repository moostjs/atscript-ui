# @atscript/ui-styles

The vunor-powered UnoCSS preset, the safelist extractor that drives our as-component class collection, the `as-*` shortcut tree, the baked-icon collection, and the `unplugin-vue-components` resolver. Spread `asPresetVunor()` into UnoCSS, register `AsResolver()` in Vite, and every `as-*` class used by `@atscript/vue-form` / `@atscript/vue-table` / `@atscript/vue-wf` resolves correctly.

## Contents

- [Preset](#preset)
- [Extractor](#extractor)
- [Base UnoCSS config](#base-unocss-config)
- [Shortcuts](#shortcuts)
- [Component class maps](#component-class-maps)
- [Icons](#icons)
- [vunor re-exports](#vunor-re-exports)
- [Vite subpath — AsResolver](#vite-subpath-asresolver)
- [Pre-built CSS subpaths](#pre-built-css-subpaths)

## Preset

### `asPresetVunor(options?)`

Returns an array of UnoCSS presets + rules + safelist entries spreadable into `unocss.config.ts`. Bundles vunor (palette / scope / layer / surface / c8 / i8), the `as-*` shortcut tree, the baked icon collection (`i-as-*`), and the safelist extractor.

```typescript
// AsBaseUnoConfigOptions IS vunor's presetVunor option type — every field
// (`baseRadius`, `palette`, `fingertip`, `typography`, `animation`, …) is
// accepted flat at the top level. Omitted fields fall back to the baked
// `defaultAsVunorOptions`. `palette.colors` and `fingertip` shallow-merge
// per-key so you can override one entry without redeclaring the whole map.
type AsVunorPresetOptions = NonNullable<Parameters<typeof presetVunor>[0]>;
interface AsBaseUnoConfigOptions extends AsVunorPresetOptions {}

interface AsPresetVunorOptions extends AsBaseUnoConfigOptions {
  /** Drop a kebab-case component's classes from the safelist when the consumer has replaced it.
   *  Typed against the generated `AsComponentName` union — autocompletes, typos fail the build. */
  excludeComponents?: AsComponentName[];
  /** Replace built-in `i-as-<name>` icons with custom SVG strings. Unknown keys ignored. */
  iconOverrides?: Record<string, string>;
  /**
   * Register the baked `i-as-*` icon collection. Default `true` (since 0.1.133).
   *
   * Set to `false` when the config already runs its OWN `presetIcons()`
   * instance — two instances fight over the `i-` prefix and the second one
   * never resolves. Pass your own loader the `as` collection instead:
   * `presetIcons({ collections: { as: createIconsLoader({ aliases }) } })`.
   *
   * Nothing else is affected: shortcuts, the component extractor, keyframes,
   * the form-grid variant + safelist and vunor itself are all still applied —
   * only the baked-icons `presetIcons` instance is skipped.
   */
  icons?: boolean;
}

function asPresetVunor(options?: AsPresetVunorOptions): Preset[];

/** Baked-in vunor theme atscript-ui has shipped since day one. Exported so
 *  consumers can read or extend it (e.g. spread + tweak one field). */
const defaultAsVunorOptions: AsVunorPresetOptions;
```

```typescript
import { defineConfig } from "unocss";
import { asPresetVunor } from "@atscript/ui-styles";

export default defineConfig({
  presets: [
    ...asPresetVunor({
      baseRadius: "0.5rem",
      palette: { colors: { primary: "#a855f7" } }, // keeps grey/neutral/error defaults
      fingertip: { m: "36px" }, // keeps xs/s/l/xl defaults
      excludeComponents: ["as-input"],
    }),
  ],
});
```

See [Styling — Installation](/styling/installation) and [Theme & Palette](/styling/theme).

## Extractor

### `createAsExtractor(opts)`

Builds the UnoCSS source-code extractor that pre-seeds the safelist with every class our components reference. Used internally by `asPresetVunor`; expose your own for advanced setups (e.g. running the safelist build inside a different bundler).

```typescript
interface AsExtractorOptions {
  /** Kebab-case component names to drop from the safelist. */
  excludeComponents?: AsComponentName[];
}

function createAsExtractor(opts?: AsExtractorOptions): {
  name: string;
  extract(ctx: { code: string; id?: string }): Set<string>;
};
```

## Base UnoCSS config

### `createAsBaseUnoConfig(opts?)`

Returns the minimal UnoCSS base config (vunor + presets + safelist) the demo apps use. Most consumers spread `asPresetVunor()` directly; reach for `createAsBaseUnoConfig` only when you want the entire opinionated config object pre-assembled.

```typescript
function createAsBaseUnoConfig(opts?: AsBaseUnoConfigOptions): UserConfig;
```

## Shortcuts

The shortcut tree is split per package so consumers can opt in. Each export is a `TVunorShortcut[]` ready to spread into a vunor config.

```typescript
import {
  commonShortcuts,
  formShortcuts,
  tableShortcuts,
  wfShortcuts,
  aoothShortcuts,
  allShortcuts,
} from "@atscript/ui-styles";

const commonShortcuts: TVunorShortcut[];
const formShortcuts: TVunorShortcut[];
const tableShortcuts: TVunorShortcut[];
const wfShortcuts: TVunorShortcut[];
const aoothShortcuts: TVunorShortcut[];

const allShortcuts: TVunorShortcut[]; // mergeVunorShortcuts of the five above
```

`asPresetVunor()` already injects `allShortcuts`. Spread individual shortcut sets only when assembling a custom preset for a subset of the libraries.

See [The as-\* Shortcut System](/styling/shortcuts).

## Component class maps

Generated at build time by walking every `as-*.vue` template. Drives the safelist extractor and the optional component-exclusion knob.

```typescript
/** Union of every published kebab-case component name — generated from the component set; powers `excludeComponents` autocomplete (typos fail the build). */
type AsComponentName =
  | "as-action"
  | "as-array"
  | /* …every published component… */ "as-window-table";

/** Map: kebab-case component name → list of class names it references (own classes only). */
const componentClasses: Record<string, readonly string[]>;

/** Map: kebab-case component name → tracked components it renders or lazy-mounts.
 *  The extractor expands these recursively; each entry is independently veto-able
 *  via `excludeComponents`. See the Bundle Optimization guide. */
const componentCompanions: Record<string, readonly string[]>;

/** Map: kebab-case component name → owning package ("form" | "table" | "wf"). */
const componentPackages: Record<string, "form" | "table" | "wf">;

/** Union of every class referenced by the given kebab-case component names, companions included.
 *  Names in `exclude` contribute nothing and are not traversed through. */
function getComponentClasses(names: readonly string[], exclude?: ReadonlySet<string>): string[];

/** Same as `getComponentClasses`, but takes helper-function names and expands them via `helperAliases`. */
function getHelperClasses(...helpers: string[]): string[];

/**
 * Map: default-bundle helper function name → list of kebab-case components it wires up.
 * Keys are `createDefaultCellTypes`, `createDefaultControls`, `createDefaultTypes`.
 * A call to `createDefaultControls()` in your source pulls in the classes for every default
 * component it returns.
 */
const helperAliases: Record<string, readonly string[]>;
```

## Icons

### `bakedIcons`

```typescript
const bakedIcons: Record<string, string>;
```

Map of semantic icon name → Iconify id or inline SVG string. Baked at publish time so the preset works offline and inside CSP-restricted environments. Override individual entries via `asPresetVunor({ iconOverrides })`.

Built-in semantic names include: `search`, `close`, `plus`, `chevron-{up,down,left,right}`, `chevron-double-*`, `arrow-{up,down}`, `grip`, `filter`, `filter-ops`, `sort-asc`, `value-help`, `sun`, `moon`, `check`, `check-square`, `sorters`, `refresh`, `columns`, `eye`, `eye-off`, `eye-slash`, `star`, `star-filled`, `pin`, `pin-filled`, `settings`, `ellipsis`, `menu`, `trash`, `loading`, `warning`, `field-empty`, `field-fill`.

Reference an icon in your own shortcut with `i-as-<name>`:

```typescript
defineShortcuts({
  "my-button": "i-as-plus c8-filled scope-primary",
});
```

### `defaultAsIconAliases`

```typescript
const defaultAsIconAliases: Record<string, string>;
```

The semantic-name → icon-source map the baked collection is generated from
(since 0.1.133). Exported so a consumer running their own `presetIcons()` can
feed the same aliases to `createIconsLoader`, keeping every `i-as-*` class in
our shortcuts resolvable.

### `createIconsLoader(options?)`

**Node-only — build-time.** It reads and writes an on-disk icon cache, so
import it from a build config (`uno.config.ts`), never from browser code.

```typescript
interface IconsLoaderOptions {
  /** Semantic name → Iconify id (or local file name). Defaults to `{}`; pass `defaultAsIconAliases` to cover our own icons. */
  aliases?: Record<string, string>;
  /** On-disk cache / local-SVG directory. Default `".icons"`. */
  iconsDir?: string;
  /** Iconify API base. Default `"https://api.iconify.design"`. */
  iconifyApiUrl?: string;
  /** Cache fetched icons under `iconsDir`. Default `true`. */
  enableCache?: boolean;
  /** Post-process a local SVG — the default recolours hard-coded fills to `currentColor` unless the file starts with `<!-- colored -->`. */
  processLocalSvg?: (svg: string) => string;
}

function createIconsLoader(options?: IconsLoaderOptions): CustomIconLoader;
```

Pair it with `asPresetVunor({ icons: false })` so only one `presetIcons()`
instance owns the `i-` prefix:

```typescript
import presetIcons from "@unocss/preset-icons";
import { asPresetVunor, createIconsLoader, defaultAsIconAliases } from "@atscript/ui-styles";

export default defineConfig({
  presets: [
    ...asPresetVunor({ icons: false }),
    presetIcons({
      collections: {
        as: createIconsLoader({ aliases: { ...defaultAsIconAliases, ...myAliases } }),
        // …your own collections
      },
    }),
  ],
});
```

With `icons: false` the `iconOverrides` option no longer applies either —
merge your overrides yourself (`{ ...bakedIcons, ...myOverrides }`), or point
the `as` collection straight at `bakedIcons` (`as: (name) => bakedIcons[name]`)
when you want the baked SVGs without the loader's network/disk access.

See [Styling — Icons](/styling/icons).

## vunor re-exports

For convenience, the package re-exports the vunor shortcut authoring helpers and the `TVunorShortcut` type so consumers don't need a second import.

```typescript
import { defineShortcuts, mergeVunorShortcuts, toUnoShortcut } from "@atscript/ui-styles";
import type { TVunorShortcut } from "@atscript/ui-styles";

function defineShortcuts(map: Record<string, string>): TVunorShortcut[];
function mergeVunorShortcuts(sets: TVunorShortcut[][]): TVunorShortcut[];
function toUnoShortcut(shortcut: TVunorShortcut): readonly [string | RegExp, string];
```

## Vite subpath — AsResolver

### `@atscript/ui-styles/vite`

```typescript
import { AsResolver } from "@atscript/ui-styles/vite";
import Components from "unplugin-vue-components/vite";

export default {
  plugins: [
    Components({
      resolvers: [AsResolver()],
    }),
  ],
};
```

`AsResolver()` returns a `ComponentResolverObject` that auto-imports the **Tier 1 primary components** — `AsField`, `AsFilters`, `AsForm`, `AsIterator`, `AsPresetPicker`, `AsTable`, `AsTableActions`, `AsTableRoot`, `AsWfForm`, `AsWindowTable` — on first use in a template. (Authoritative source: `primaryComponents` in `packages/ui-styles/src/generated/component-classes.ts`.)

Tier-2 defaults (`AsInput`, `AsFilterDialog`, …) are not auto-resolved — users import them explicitly when composing custom defaults. Composables (`useTable`, …) are never handled by `unplugin-vue-components`.

```typescript
function AsResolver(): ComponentResolverObject;
```

## Pre-built CSS subpaths

For apps that don't run UnoCSS at all, the package ships pre-baked CSS bundles. Importing one of these subpaths for side-effect injects every class our components need.

```typescript
import "@atscript/ui-styles/css"; // alias for /css/all
import "@atscript/ui-styles/css/all"; // form + table + wf + aooth + common
import "@atscript/ui-styles/css/form"; // form only
import "@atscript/ui-styles/css/table"; // table only
import "@atscript/ui-styles/css/wf"; // wf only
import "@atscript/ui-styles/css/aooth"; // @atscript/vue-aooth components only
```

Caveat: pre-built CSS skips theme tuning. Use `asPresetVunor()` if you want to change the palette, base radius, fingertip ladder, or icon set.

See [Pre-built CSS](/styling/prebuilt-css).

## Cross-links

- [Styling — Overview](/styling/)
- [Styling — Installation](/styling/installation)
- [Styling — Theme & Palette](/styling/theme)
- [Styling — Icons](/styling/icons)
- [Styling — The as-\* Shortcut System](/styling/shortcuts)
- [Styling — Pre-built CSS](/styling/prebuilt-css)
- [Guide — Bundle Optimization](/guide/bundle-optimization)
- vunor — internal shortcuts engine atscript-ui composes against (`vunor`, `vunor/theme`, `vunor/utils`)
