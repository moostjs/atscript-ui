---
outline: deep
---

# Bundle Optimization

atscript-ui ships a lot of UI — form fields, table chrome, four dialogs, workflow forms — but your app should only pay for what it actually renders. The delivery contract is simple: **don't tag it and you don't ship its JS; don't open it and you don't download it; don't use it and its CSS is never generated.** This page explains the mechanics behind that promise and the knobs for trimming further.

## How JS is delivered

### Per-component subpaths

Every `@atscript/vue-*` package is published code-split per component, and every Tier-1 / Tier-2 component has its own subpath export:

```typescript
import AsTableRoot from "@atscript/vue-table/as-table-root";
import AsInput from "@atscript/vue-form/as-input";
import AsWfForm from "@atscript/vue-wf/as-wf-form";
```

`AsResolver()` from `@atscript/ui-styles/vite` resolves template tags to exactly these subpaths — tag `<AsTableRoot>` and only `as-table-root`'s chunk graph enters your bundle. Nothing else from the package rides along. See [Installation](/styling/installation) for the resolver setup.

Barrel imports (`import { AsInput } from "@atscript/vue-form"`) are also safe: every package declares `sideEffects` (`false`, or `["**/*.css"]` for the packages that ship styles), so named imports tree-shake on webpack-class bundlers as well as Rollup/Vite. Subpath imports and `AsResolver()` remain the recommended pattern — they don't depend on the bundler's tree-shaking quality at all.

### Lazy dialogs in `<AsTableRoot>`

`<AsTableRoot>` splits its dialogs by likelihood of use:

| Dialog               | Loading                                                  | Trigger                                   |
| -------------------- | -------------------------------------------------------- | ----------------------------------------- |
| `AsConfirmDialog`    | static — tiny, core to the `prompt()` / confirm path     | always mounted                            |
| `AsConfigDialog`     | lazy (`defineAsyncComponent` behind a first-open latch)  | first time the config dialog opens        |
| `AsFilterDialog`     | lazy, first-open latch                                   | first time a filter dialog opens          |
| `AsPresetDialog`     | lazy, first-open latch                                   | first time the preset dialog opens        |
| `AsActionFormDialog` | lazy, mounted only when an action declares an input form | table def contains an `@InputForm` action |

A user who never opens the config dialog never downloads its chunk. `AsActionFormDialog` matters most: it wraps `<AsForm>` and pulls in the whole `@atscript/vue-form` runtime, so this lazy boundary is what keeps vue-form out of table-only apps. It is deliberately **not** exported from the `@atscript/vue-table` main entry — eager-loading or overriding goes through the dedicated subpath (`@atscript/vue-table/as-action-form-dialog`).

Assigning a component to `controls.configDialog` / `controls.filterDialog` / `controls.presetDialog` / `controls.actionFormDialog` opts that dialog into **eager** mounting — your replacement (or the pre-seeded default) is in the static import graph and ships up front. That's the trade-off of overriding chrome; see [Customization](/tables/customization) for the controls map.

### Cell renderers ride behind `<AsTable>`, not `<AsTableRoot>`

`<AsTableRoot>` is renderless — an app that renders its own list or cards inside its slot ships **no** cell renderers, header chrome, or row-action menus. Those enter the graph through:

- `<AsTable>` / `<AsWindowTable>` — pull in the row-actions cell (`AsRowActions`), the fallback cell (`AsTableCellValue`), and the header cell.
- `createDefaultCellTypes()` — pulls in the typed renderers (`AsCellDate`, `AsCellNumber`, `AsCellArray`, `AsCellJson`, `AsCellUnion`).

## How CSS is emitted (UnoCSS path)

The UnoCSS path is the optimization path: the preset registers an extractor (`createAsExtractor`, wired automatically by `asPresetVunor()`) that scans **your** source and safelists only the classes of components you actually use. The pre-built CSS bundles are the compatibility path — per-branch granularity (`css/form`, `css/table`, …), lazy chrome always included, no per-component trimming. See [Pre-built CSS](/styling/prebuilt-css); the rest of this section applies to the UnoCSS path only.

### The four match channels

A component's classes enter the safelist when your source matches any of:

| Channel        | Example                                                                         |
| -------------- | ------------------------------------------------------------------------------- |
| Subpath import | `import AsTableRoot from "@atscript/vue-table/as-table-root"`                   |
| Barrel import  | `import { AsFilterDialog } from "@atscript/vue-table"`                          |
| Template tag   | `<AsTableRoot>` or `<as-table-root>`                                            |
| Helper call    | `createDefaultTypes()` / `createDefaultControls()` / `createDefaultCellTypes()` |

No match in any channel → the component's classes never reach the generated stylesheet.

### Companions: CSS is eager where JS is lazy

The generated class maps split a component's footprint in two: `componentClasses[name]` holds only the component's **own** classes; `componentCompanions[name]` lists the tracked components it renders or lazy-mounts. The extractor expands companions recursively — so matching `<AsTableRoot>` safelists the classes of all its companions, including the lazily loaded dialogs and the cell / header / filter chrome.

This asymmetry is deliberate: a lazy JS chunk arrives at runtime, long after the CSS build finished, so its classes must be in the stylesheet up front or the dialog would render unstyled on first open. The cost is dead CSS in apps that never open those dialogs — which is exactly what `excludeComponents` is for.

### `excludeComponents`

Pass kebab-case component names to `asPresetVunor()` (or `createAsExtractor()` directly) to veto components from the safelist. Each companion is vetoed independently, including through expansion chains:

```typescript
// uno.config.ts — app mounts <AsTableRoot> but never opens the built-in dialogs
import { defineConfig } from "unocss";
import { allShortcuts, asPresetVunor } from "@atscript/ui-styles";
import { vunorShortcuts } from "vunor/theme";

export default defineConfig({
  presets: asPresetVunor({
    excludeComponents: [
      "as-config-dialog",
      "as-filter-dialog",
      "as-preset-dialog",
      "as-action-form-dialog",
    ],
  }),
  shortcuts: [vunorShortcuts(allShortcuts)],
});
```

Excluding a component also prunes everything reachable **only** through it — in a `<AsTableRoot>`-only app, excluding `as-filter-dialog` also drops the value-help window-table chrome that nothing else pulls in. A companion that's still reachable through another kept component stays in.

::: warning Exclusion is build-wide and absolute
`excludeComponents` wins over every match channel: tagging `<AsFilterDialog>` directly or importing it elsewhere in the app still emits nothing while it's excluded. Only exclude components that **no** screen in the app renders — otherwise that screen renders unstyled.
:::

### Mount only the shortcut branches you use

The shortcut tree is also split per branch: `commonShortcuts`, `formShortcuts`, `tableShortcuts`, `wfShortcuts`, `aoothShortcuts` — with `allShortcuts` as the merge. A forms-only app can register a narrower tree:

```typescript
import { commonShortcuts, formShortcuts, mergeVunorShortcuts } from "@atscript/ui-styles";
import { vunorShortcuts } from "vunor/theme";

export default defineConfig({
  presets: asPresetVunor(),
  shortcuts: [vunorShortcuts(mergeVunorShortcuts([commonShortcuts, formShortcuts]))],
});
```

With the extractor in place this is belt-and-braces — unmatched shortcuts don't generate CSS anyway — but it bounds what _can_ be emitted and speeds up shortcut resolution.

## Recipes

### Custom list on `<AsTableRoot>`

You use `<AsTableRoot>` for querying, filtering state, and pagination, but render your own cards/list in the slot. JS is already minimal (renderless root, no cell renderers). For CSS, shed the dialog and table-chrome companions:

```typescript
asPresetVunor({
  excludeComponents: [
    // dialogs you never open
    "as-config-dialog",
    "as-filter-dialog",
    "as-preset-dialog",
    "as-action-form-dialog",
    // cell / header / row chrome you don't render
    "as-table-header-cell",
    "as-table-cell-value",
    "as-row-actions",
    "as-column-menu",
    "as-filter-field",
    "as-filter-input",
    "as-cell-array",
    "as-cell-date",
    "as-cell-json",
    "as-cell-number",
    "as-cell-union",
  ],
});
```

Keep `as-confirm-dialog` if you use `state.prompt()` / confirm-gated actions — it's always mounted.

### Forms-only app

Don't import `@atscript/vue-table` anywhere; `AsResolver()` only resolves what you tag, so nothing table-shaped enters the JS graph. Mount `commonShortcuts` + `formShortcuts` instead of `allShortcuts` (snippet above). No `excludeComponents` needed — the extractor never matches table components in the first place. On the no-UnoCSS path the equivalent is the `css/form` bundle — see [Pre-built CSS](/styling/prebuilt-css).

### Custom cells while keeping `<AsTable>`

You render `<AsTable>` but supply your own cell components via `:types` and never call `createDefaultCellTypes()`. **JS is automatic:** the typed default cells (`AsCellDate`, `AsCellNumber`, `AsCellJson`, `AsCellArray`, `AsCellUnion`) only enter the bundle through that helper — skip the call and they never ship. `AsTableCellValue` and `AsRowActions` still ride along: they're hard fallbacks inside the table renderers. **CSS is not automatic:** matching `as-table-root` safelists the default cells' classes as companions, so opt out explicitly — the prop is typed against the generated component-name union, so your editor autocompletes every name:

```typescript
asPresetVunor({
  excludeComponents: [
    "as-cell-array",
    "as-cell-date",
    "as-cell-json",
    "as-cell-number",
    "as-cell-union",
  ],
});
```

Add `as-table-cell-value` / `as-row-actions` to the list only if you've replaced those too — by default they still render.

### Replaced a default — shed its styles

You swapped the filter dialog for your own via `controls.filterDialog` (see [Customization](/tables/customization)). Your component now mounts eagerly and carries its own styles; the default's classes are dead weight:

```typescript
asPresetVunor({
  excludeComponents: ["as-filter-dialog"],
});
```

The same applies to any replaced Tier-2 default — `as-input` after swapping the form text field, `as-row-actions` after a design-system row menu, and so on.

## DOs and DON'Ts

- **DO** import via subpaths or tag via `AsResolver()` — **DON'T** deep-import `@atscript/vue-table/as-action-form-dialog` eagerly at the app entry "just in case"; it re-bundles the entire `@atscript/vue-form` runtime into table-only screens.
- **DO** let the dialogs lazy-load — **DON'T** seed `controls.X` with the default dialog component unless you deliberately want eager loading.
- **DO** pass only your actual overrides in `:controls` — **DON'T** pass `createDefaultControls()` wholesale; it statically imports the dialogs and flips them to eager. Every dispatch site falls back to its built-in internally.
- **DO** pass `excludeComponents` for replaced or never-used chrome — **DON'T** expect the pre-built CSS bundles to trim per component; they only split per branch.
- **DO** verify an exclusion app-wide before adding it — **DON'T** exclude a component any screen still renders; exclusion overrides direct matches and that screen will render unstyled.
- **DO** mount only the shortcut branches your app uses — **DON'T** hand-maintain a manual `safelist` for `as-*` classes; the extractor already covers every supported usage channel.

## See also

- [Styling — Installation](/styling/installation) — the UnoCSS + `AsResolver()` setup this page builds on.
- [Pre-built CSS](/styling/prebuilt-css) — the no-UnoCSS path and its trade-offs.
- [Tables — Customization](/tables/customization) — the `controls` map and lazy control entries.
- [API — @atscript/ui-styles](/api/ui-styles) — `asPresetVunor`, `createAsExtractor`, the class/companion maps, shortcut groups.
