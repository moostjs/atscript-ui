JS and CSS bundle trimming across `@atscript/vue-*` + `@atscript/ui-styles`. Contract: don't tag it → no JS; don't open it → no download; don't use it → no CSS.

## Quick start

```ts
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

## Invariants

| #   | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **JS ships per component.** Published dist is code-split; every Tier-1/Tier-2 component has its own subpath export (`@atscript/vue-table/as-table-root`, `@atscript/vue-form/as-input`). `AsResolver()` (from `@atscript/ui-styles/vite`) resolves template tags to those subpaths — only tagged components enter the import graph.                                                                                                                                                                                                                                                                                        |
| 2   | **All packages declare `sideEffects`** (`false`, or `["**/*.css"]` for ui-styles/vue-form/vue-table), so barrel named imports tree-shake on webpack too. Subpath/`AsResolver` imports remain the recommended pattern.                                                                                                                                                                                                                                                                                                                                                                                                      |
| 3   | **`<AsTableRoot>` lazy-loads its dialogs** (`AsConfigDialog`, `AsFilterDialog`, `AsPresetDialog`, `AsActionFormDialog`) via `defineAsyncComponent` behind first-open latches — never opened means never downloaded. Assigning any `controls.X` makes that dialog eager — pass only the entries you replace; `createDefaultControls()` wholesale statically imports the dialogs and flips them to eager. `AsConfirmDialog` is the one static dialog (tiny, core to `prompt()`).                                                                                                                                             |
| 4   | **`AsActionFormDialog` is the vue-form boundary.** It wraps `<AsForm>`; eager deep-import (`@atscript/vue-table/as-action-form-dialog`) re-bundles the whole `@atscript/vue-form` runtime into table-only apps. It's not exported from the vue-table main entry — subpath only.                                                                                                                                                                                                                                                                                                                                            |
| 5   | **Cell renderers ride behind `<AsTable>`/`<AsWindowTable>`** (row-actions cell, fallback cell, header cell) **and `createDefaultCellTypes()`** (typed renderers) — never behind `<AsTableRoot>` alone. A custom list inside the root's slot ships none of them.                                                                                                                                                                                                                                                                                                                                                            |
| 6   | **CSS extractor is usage-driven, four channels:** subpath import string, barrel named import (`import { AsX } from "@atscript/vue-*"`), template tag (`<AsXxx>` / `<as-xxx>`), helper call (`createDefaultTypes()` / `createDefaultControls()` / `createDefaultCellTypes()`). No match in any channel → no classes generated. UnoCSS path only.                                                                                                                                                                                                                                                                            |
| 7   | **Companions make CSS eager where JS is lazy.** `componentClasses[name]` = own classes only; `componentCompanions[name]` = tracked components it renders or lazy-mounts; the extractor expands companions recursively. Matching `<AsTableRoot>` safelists every companion (the four dialogs, `as-confirm-dialog`, cell renderers, header/filter chrome) so lazy chunks aren't unstyled on open.                                                                                                                                                                                                                            |
| 8   | **`excludeComponents` vetoes per component, through chains.** Option on `asPresetVunor()` / `createAsExtractor()`. Pruning is transitive: excluding `as-filter-dialog` also drops what's reachable only through it; companions kept via another path stay.                                                                                                                                                                                                                                                                                                                                                                 |
| 9   | **Exclusion is build-wide and absolute** — it wins over every match channel; a directly tagged/imported excluded component still emits nothing and renders unstyled. Only exclude components no screen renders.                                                                                                                                                                                                                                                                                                                                                                                                            |
| 10  | **Pre-built CSS trims per branch only** (`css`, `css/all`, `css/form`, `css/table`, `css/wf`, `css/aooth`) — lazy chrome always included, no per-component trimming. Compatibility path, not optimization path. Shortcut groups mount per branch too: `commonShortcuts` / `formShortcuts` / `tableShortcuts` / `wfShortcuts` / `aoothShortcuts` vs `allShortcuts`.                                                                                                                                                                                                                                                         |
| 11  | **Custom cells in `<AsTable>` `:types` (no `createDefaultCellTypes()`): JS automatic, CSS opt-out.** Typed default cells enter JS only via `createDefaultCellTypes()`; `AsTableCellValue` + `AsRowActions` always ship (hard fallbacks in the table renderers). CSS still safelists the default cells via `as-table-root` companions — shed with `excludeComponents: ["as-cell-array", "as-cell-date", "as-cell-json", "as-cell-number", "as-cell-union"]` (add `as-table-cell-value` / `as-row-actions` only when replaced). `excludeComponents` is typed `AsComponentName[]` — names autocomplete, typos fail the build. |

## Key imports

```ts
import { asPresetVunor, createAsExtractor } from "@atscript/ui-styles";
import { componentClasses, componentCompanions, getComponentClasses } from "@atscript/ui-styles";
import {
  allShortcuts,
  commonShortcuts,
  formShortcuts,
  tableShortcuts,
  wfShortcuts,
  aoothShortcuts,
  mergeVunorShortcuts,
} from "@atscript/ui-styles";
import { AsResolver } from "@atscript/ui-styles/vite";
// eager-load / override the action form dialog (subpath only — see invariant 4)
import AsActionFormDialog from "@atscript/vue-table/as-action-form-dialog";
```

## See also

- Docs: https://ui.atscript.dev/guide/bundle-optimization
- `atscript-ui-styles` skill — preset, theming, shortcut tree, pre-built CSS.
- `atscript-ui-tables` skill — the `:controls` map whose entries flip dialogs to eager.
