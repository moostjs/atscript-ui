# STYLES.md — Consolidating UI styles into a shared package

This document is the implementation plan for consolidating UnoCSS shortcuts and component-styling logic out of the per-package `vue-form` / `vue-table` shortcut files and into a single shared styles package, with per-component safelist generation so consumers don't need to scan `node_modules`.

Each phase below is meant to be picked up by a separate agent. Read the **Context** and **Decisions** sections first — they contain the load-bearing background. Then jump to the phase you've been assigned.

---

## Context

### What this monorepo ships

`atscript-ui` generates automated forms and smart tables driven by atscript type metadata.

- [packages/ui/](packages/ui/) — framework-agnostic core (FormDef, TableDef, annotation keys, validators).
- [packages/ui-table/](packages/ui-table/) — framework-agnostic table logic (filters, presets).
- [packages/ui-fns/](packages/ui-fns/) — opt-in plugin for `@ui.fn.*` dynamic computed annotations.
- [packages/vue-form/](packages/vue-form/) — Vue 3 form components. Components live in three subdirs: `src/components/*.vue` (root, e.g. `as-form.vue`, `as-field.vue`, `as-iterator.vue`), `src/components/defaults/*.vue` (built-in field types like `as-input`, `as-select`, `as-checkbox`), and `src/components/internal/*.vue` (private helpers like `as-field-shell`).
- [packages/vue-table/](packages/vue-table/) — Vue 3 table components. Same subdir structure: root `src/components/*.vue` (`as-table.vue`, `as-table-root.vue`, `as-table-cell-value.vue`, etc.) and `src/components/defaults/*.vue` (`as-filter-dialog`, `as-config-dialog`, `as-column-menu`, etc.).
- [packages/vue-wf/](packages/vue-wf/) — Vue 3 workflow form wrapper. Currently a single component at `src/wf-form.vue` exported as `WfForm`. Uses class `as-wf-form-error`. Same treatment as vue-form/vue-table for build, safelist, and extractor — it is not optional.
- [packages/unocss-preset/](packages/unocss-preset/) — current home for the UnoCSS preset factory + icon loader. **Will be renamed to `@atscript/ui-styles`** (see Decisions).
- [packages/vue-playground/](packages/vue-playground/) — private dev app for manual testing.
- [packages/demo/](packages/demo/) — separate demo app. Has its own `uno.config.ts` with the same source-glob workaround AND scans `../vue-wf/src/**`. Every phase that touches playground UnoCSS config must also touch demo's.

### The problem we're solving

UnoCSS only generates CSS for class names it sees in the consumer's source tree. When `vue-form` and `vue-table` are installed from npm, their class names live inside `node_modules`. UnoCSS won't scan there by default, so consumers either get no styles or have to pull from a pre-generated CSS dump that ignores their theme customization.

The current monorepo workaround in [packages/vue-playground/uno.config.ts](packages/vue-playground/uno.config.ts) lists `../vue-form/src/**/*.{vue,ts}` and `../vue-table/src/**/*.{vue,ts}` in `content.filesystem`. This works in-repo because the source is on disk; it does **not** generalize to end users (their `node_modules` is `dist/` only, and the relative paths are different).

### The reference solution: vunor

[vunor](https://github.com/maxim-mazurok/vunor) (source at `/Users/mavrik/code/vunor/`) solves the same problem. We're copying its mechanism. The pieces:

1. **Per-component build** — each Vue component is its own `.mjs` entry, exported under a subpath (`vunor/Button`, `vunor/Input`, …).
2. **Build-time class extraction** — a script walks each component's source dependency graph, runs UnoCSS `generate()`, and captures the matched class set per component into a generated `Record<ComponentName, string[]>` module.
3. **Custom UnoCSS Extractor** — embedded in the preset. At consumer build time, it regexes the consumer's source for component imports and tag usage, looks up the per-component class lists, and feeds them into UnoCSS. No filesystem scan needed.
4. **No pre-built CSS** — vunor consciously skips it because pre-bundled CSS bakes theme tokens. We will ship pre-built CSS anyway, with the explicit caveat that it cannot be themed (see Decisions).

Reference files in vunor (read these before implementing the corresponding phase):

- [/Users/mavrik/code/vunor/packages/vunor/rolldown.config.ts](/Users/mavrik/code/vunor/packages/vunor/rolldown.config.ts) — multi-entry build config.
- [/Users/mavrik/code/vunor/packages/vunor/scripts/extract-component-classes.ts](/Users/mavrik/code/vunor/packages/vunor/scripts/extract-component-classes.ts) — class extraction script (the load-bearing piece).
- [/Users/mavrik/code/vunor/packages/vunor/scripts/gen-exports.js](/Users/mavrik/code/vunor/packages/vunor/scripts/gen-exports.js) — auto-generates `package.json` exports map from filesystem.
- [/Users/mavrik/code/vunor/packages/vunor/src/theme/preset-vunor.ts](/Users/mavrik/code/vunor/packages/vunor/src/theme/preset-vunor.ts) — `createVunorExtractor()` is at the top.
- [/Users/mavrik/code/vunor/packages/vunor/src/vite.ts](/Users/mavrik/code/vunor/packages/vunor/src/vite.ts) — `VunorVueResolver` for `unplugin-vue-components`.

### Current state inventory (as of writing)

- [packages/unocss-preset/src/preset.ts](packages/unocss-preset/src/preset.ts) — exports `asPresetVunor()` factory + `asIconsPreset()` + `createIconsLoader()`. **No shortcuts. No safelist. No CSS.** Note: `asPresetVunor()` returns `Preset[]` (an array), not a single preset — see Decision 14.
- [packages/vue-form/src/unocss/shortcuts.ts](packages/vue-form/src/unocss/shortcuts.ts) — ~40 `as-*` shortcuts.
- [packages/vue-table/src/unocss/shortcuts.ts](packages/vue-table/src/unocss/shortcuts.ts) — ~60 `as-*` shortcuts.
- vue-wf has no shortcuts file today; its sole class `as-wf-form-error` should become a shortcut in `ui-styles/src/shortcuts/wf/` during Phase 1.
- Both vue-form and vue-table emit `dist/unocss.css` via `unocss 'src/**/*.{vue,ts}' -o dist/unocss.css --minify` ([packages/vue-form/package.json:34](packages/vue-form/package.json#L34)). This step will be removed.
- Each vue-\* package has its own [packages/vue-form/uno.config.ts](packages/vue-form/uno.config.ts) / [packages/vue-table/uno.config.ts](packages/vue-table/uno.config.ts). Both currently `import { asFormShortcuts } from "./src/unocss"` (or table equivalent) and `from "@atscript/unocss-preset"` — Phase 1 must update or delete these, otherwise lint/CI breaks.
- `vp pack` already supports multi-entry: `entry: ["src/index.ts", "src/unocss/index.ts"]` in [packages/vue-form/vite.config.ts:12](packages/vue-form/vite.config.ts#L12).
- Templates audited: 100% `as-*` shortcuts, no inline raw utilities. Per `CLAUDE.md` discipline.
- **Tag style is PascalCase, not kebab-case** in real consumer code. Spot check of [packages/vue-playground/src/views/](packages/vue-playground/src/views/) shows `<AsForm>`, `<AsTableRoot>`, `<AsTable>`, `<AsFilters>`, `<AsIterator>` — zero kebab-case `<as-form>` usage. The extractor must match PascalCase as the primary pattern, kebab as a fallback.
- **Today vue-wf exports `WfForm` without the `As` prefix.** This is the only outlier; Decision 16 normalizes it to `AsWfForm` in Phase 1 so all components follow the `As*` PascalCase / `as-*.vue` filename / `as-*` class convention. Until Phase 1 lands, expect the inconsistency in the codebase.
- **Helper functions wire up default components consumers never tag directly:**
  - `createDefaultTypes()` ([packages/vue-form/src/composables/create-default-types.ts:24](packages/vue-form/src/composables/create-default-types.ts#L24)) returns a map of all built-in form field types: `AsInput`, `AsSelect`, `AsRadio`, `AsCheckbox`, `AsParagraph`, `AsAction`, `AsObject`, `AsArray`, `AsUnion`, `AsTuple`, `AsRef`.
  - `createDefaultTableComponents()` ([packages/vue-table/src/components/defaults/index.ts:29](packages/vue-table/src/components/defaults/index.ts#L29)) returns a map of default table internals: `AsTableHeaderCell`, `AsTableCellValue`, `AsColumnMenu`, `AsFilterDialog`, `AsFilterInput`, `AsFilterField`, `AsConfigDialog`.
  - These maps are passed to `<AsForm :types>` / `<AsTable>` props. The components inside are never written as tags by consumers, so a tag-only extractor will miss them. Helper-call detection is mandatory (see Decision 11).
- Dynamic class construction: only `` `as-item-${keyCounter++}` `` in [packages/vue-form/src/composables/use-form-array.ts:39](packages/vue-form/src/composables/use-form-array.ts#L39) — and this is a **Vue list key**, not a CSS class. So we have zero dynamic-class concerns.

### Tooling

- Package manager: pnpm 10 (workspace catalogs in `pnpm-workspace.yaml`).
- Build: **vite-plus** (`vp pack`) — Vite/tsdown/rolldown wrapped under one CLI. Do not invoke `rolldown`, `tsdown`, or `vite` directly. Do not install vitest/oxlint/oxfmt directly. See [CLAUDE.md](CLAUDE.md) "Using Vite+" section for full rules.
- Vue compilation: handled by `vp pack`'s `dts: { vue: true }` + `plugins: [vue()]`.
- Test: `vp test` (Vitest under the hood). Do not call vitest directly.
- Lint/format: `vp check`, `vp lint`, `vp fmt`.
- Sanity check command before declaring a phase done: `pnpm ready` (runs `fmt → lint → test → build`).

---

## Decisions

These were settled in conversation. Don't relitigate them inside a phase — if you think a decision is wrong, raise it and pause.

1. **Rename `@atscript/unocss-preset` → `@atscript/ui-styles`.**
   - **Why:** matches the `@atscript/ui` / `@atscript/ui-table` namespace style. The new name is broader — it eventually houses pre-built CSS, the safelist data module, and possibly future framework-neutral style utilities. Decouples the package name from a specific tool.
   - **Scope:** internal rename only. Update all `workspace:^` references and import paths. No backwards-compat alias — bump the major version.

2. **Use `vp pack` (vite-plus), not standalone rolldown.**
   - **Why:** the rest of the monorepo is on vite-plus. Don't fragment the toolchain just to mimic vunor's choice of rolldown. `vp pack` already handles multi-entry and Vue compilation.
   - **Implication:** the per-component build config differs from vunor's — see Phase 2 for how to translate.

3. **Don't externalize sibling component imports.**
   - **Why:** vunor externalizes them (`Button.vue` imports `Input.vue` → bundler emits `import 'vunor/Input'`) to keep per-component `.mjs` files small. With proper multi-entry config, the bundler will hoist shared code into shared chunks automatically — same outcome, no source-import rewriting needed.
   - **Implication:** Phase 2 is significantly simpler than vunor's setup. Skip the `externalize-sibling-components` plugin.

4. **Shortcuts organized by component, not flattened.**
   - **Why:** keeps code-split granularity, makes future React reuse cleaner, lets the safelist generator key by component name without parsing.
   - **Layout:** `packages/ui-styles/src/shortcuts/{form,table,common}/` with one file per component (or per logical group), each exporting an object. A barrel exposes `formShortcuts`, `tableShortcuts`, `allShortcuts`. Common shortcuts (e.g. `as-spacer`) go in `common/`.

5. **Ship four pre-built CSS files**, not one.
   - **Layout:**
     - `dist/css/all.css` — everything (form + table + wf). Default for users who install more than one Vue package.
     - `dist/css/form.css` — form components only.
     - `dist/css/table.css` — table components only.
     - `dist/css/wf.css` — workflow form components only.
   - **Why:** users may install just one package. The per-package files will overlap on common shortcuts (`as-spacer`, etc.) — that's fine, they're not meant to be loaded together. `all.css` deduplicates.
   - **Why a `wf.css` even though vue-wf has just one component today:** keeps the per-package CSS surface symmetric and stable as vue-wf grows.
   - **Theme:** all four are baked with the default `asPresetVunor()` palette. **No theme customization, no `excludeComponents` opt-out** (see Decision 15) with pre-built CSS. Document this loudly. Users who want either must use UnoCSS.

6. **Use a custom UnoCSS Extractor (not a Vite plugin).**
   - **Why:** vunor's pattern. Works in any UnoCSS-enabled environment (Vite, Nuxt, CLI). Doesn't bind us to Vite. The extractor is registered inside the preset, so consumers get it automatically.
   - **Match patterns** — the extractor must match all of these, because real consumer code uses all of them:
     1. PascalCase tags: `<AsForm`, `<AsTableRoot`, `<AsTable`, `<AsWfForm` — **primary pattern in actual usage**.
     2. Kebab-case tags: `<as-form`, `<as-wf-form` — supported but rarely used.
     3. Subpath imports: `from '@atscript/vue-form/as-form'`, `from '@atscript/vue-wf/as-wf-form'` — emerges with Phase 2.
     4. Barrel named imports: `import { AsForm, AsField } from '@atscript/vue-form'`, `import { AsWfForm } from '@atscript/vue-wf'` — current usage.
     5. Helper-function calls: `createDefaultTypes(`, `createDefaultTableComponents(` — mandatory for default components (see Decision 11).
   - PascalCase ↔ kebab mapping: standard kebabize transform (`AsForm` → `as-form`, `AsWfForm` → `as-wf-form`, `AsTableRoot` → `as-table-root`).
   - Regex uses `As[A-Z]\w*` (prefix-anchored, per Decision 16). The `componentClasses` lookup is still the gate, so unknown `As*` identifiers in consumer code are no-ops.

7. **Safelist key = kebab-case of the source filename.**
   - **Why:** the dictionary in `componentClasses` is the single source of truth for which components exist. Keys are derived from the `.vue` filename (`as-form.vue` → `as-form`, `as-wf-form.vue` → `as-wf-form`). The extractor kebabizes PascalCase matches and looks them up; if the kebab name isn't in the dict, the match is a no-op. No per-consumer translation.

8. **Build order: vue-form, vue-table, vue-wf → ui-styles (loose ordering).**
   - **Why:** the extraction script reads the Vue packages' **source files on disk** (hardcoded relative paths like `../vue-form/src/components`) — it does NOT consume their built artifacts. The dependency is therefore weaker than a typical "consumer depends on built output" relationship.
   - **What this means in practice:** the only reason ui-styles depends on the Vue packages as devDependencies is for pnpm's topological install/run ordering and for IDE-side type resolution. A clean checkout can run `extract-classes` even if the Vue packages haven't been built. Don't add code that assumes `dist/` exists in those packages.
   - **No circular dep:** none of the Vue packages import from ui-styles at runtime — templates use class names by string, not by import.

9. **Drop the per-package `dist/unocss.css` step.**
   - **Why:** redundant once ui-styles ships pre-built CSS. The current per-package CSS uses an in-monorepo source scan that doesn't match the new pipeline anyway.

10. **No backwards-compat shims.**
    - The monorepo is the only consumer today. Bump majors, change paths, move on. Per CLAUDE.md: don't add re-exports or `// removed` comments for removed code.

11. **Helper-call detection in the extractor; helper aliases generated alongside per-component classes.**
    - **Why:** `createDefaultTypes()` and `createDefaultTableComponents()` ship default components that consumers never tag. A tag-only extractor would silently drop their classes. We can't reasonably ask consumers to add manual safelist entries for built-in defaults.
    - **Mechanism:** the extraction script (Phase 3) emits a second map alongside `componentClasses`:
      ```ts
      export const helperAliases: Record<string, string[]> = {
        createDefaultTypes: ["as-input", "as-select", "as-radio", ..., "as-ref"],
        createDefaultTableComponents: ["as-table-header-cell", ..., "as-config-dialog"],
      };
      ```
      Per Decision 17, every helper conforms to a fixed layout: it lives at `src/composables/create-*.ts` and imports its components from `../components/defaults`. The parser walks each helper file, finds the single import from that barrel, kebab-cases the named identifiers — done. No fallback path needed.
    - The extractor matches `\b(createDefaultTypes|createDefaultTableComponents)\s*\(` and unions the helper's class set into the result. The helper-name list is data-driven from the generated `helperAliases` map.
    - **Helpers do not cover every public default.** Some default components (e.g. vue-table's `AsFilters`, `AsFilterConditions`, `AsFilterValueHelp`, `AsFieldsSelector`, `AsSortersConfig`, `AsOrderableList`) are public (re-exported from the defaults barrel and the package's `src/index.ts`) but are NOT wired up by any helper. They reach the safelist only via Patterns 2–4 (subpath import, barrel named import, PascalCase/kebab tag) — never via Pattern 5 (helper call). This is fine: they're addressable directly, so consumers who use them will trigger the extractor; consumers who don't won't pay the cost.
    - When new helpers are added, the helper file must conform to Decision 17's layout — then the parser picks them up automatically and the alias map regenerates.

12. **Generated files are committed to git, not gitignored.**
    - **Why:** if `src/generated/component-classes.ts` is gitignored, then `vp check`, `vp test`, and any consumer building from a fresh checkout fail until `extract-classes` runs. Committing keeps clean checkouts buildable.
    - **Trade-off:** every change to a `.vue` template that adds/removes class names produces a diff in the generated file. That's noise, but it's also useful — reviewers can see the safelist impact of a UI change. Sort keys + classes deterministically so diffs are minimal.
    - CI must run `extract-classes` and fail if the result diverges from what's committed (drift check), so PRs can't forget to regenerate.

13. **Split `createAsBaseUnoConfig()` from `asPresetVunor()` to break the bootstrap cycle.**
    - **Why:** the extractor (registered in `asPresetVunor()`) imports `componentClasses`. The extraction script needs to run UnoCSS with the same shortcuts/presets to compute `componentClasses`. If the script imports `asPresetVunor()`, you get a chicken-and-egg: the preset wants the safelist, but the safelist needs the preset to be generated.
    - **Mechanism:** export two factories from `@atscript/ui-styles`:
      - `createAsBaseUnoConfig({ tokens })` — returns `{ presets, shortcuts }` with no safelist/extractor dependency. Used by extraction script and CSS build.
      - `asPresetVunor(opts)` — returns `Preset[]` containing the base config + the extractor that imports `componentClasses`. Used by consumers.
    - The CSS build (Phase 5) also uses `createAsBaseUnoConfig()` and passes `safelist:` explicitly — it doesn't need the extractor either.

14. **Don't re-wrap `asPresetVunor()` output in another array.**
    - **Why:** `asPresetVunor()` returns `Preset[]` already (see [packages/unocss-preset/src/preset.ts:59](packages/unocss-preset/src/preset.ts#L59)). UnoCSS configs that write `presets: [asPresetVunor({})]` create `Preset[][]`, which is wrong even though UnoCSS may flatten silently.
    - **Mechanism:** consumers write `presets: asPresetVunor({})`, not `presets: [asPresetVunor({})]`. Document this in the README.
    - **Audit status:** the four existing call sites in this repo ([packages/vue-form/uno.config.ts:10](packages/vue-form/uno.config.ts#L10), [packages/vue-table/uno.config.ts:10](packages/vue-table/uno.config.ts#L10), [packages/vue-playground/uno.config.ts](packages/vue-playground/uno.config.ts), [packages/demo/uno.config.ts](packages/demo/uno.config.ts)) all already use the unwrapped form — no rewriting needed. Phase 1 / Phase 6 just guard against regressions.

15. **Power-user opt-out via `excludeComponents`.**
    - **Why:** the default extractor is intentionally defensive — when it sees `<AsForm>` or `createDefaultTypes(`, it pulls in classes for every component reachable from those entry points. Most consumers want this: zero-config is the goal. But power users who replace built-in dialogs with their own (e.g., they ship a custom `<MyFilterDialog>` and never render the default `AsFilterDialog`) want a way to drop those classes from the bundle.
    - **API:** `asPresetVunor()` accepts an `excludeComponents` option. The extractor skips any component whose kebab name is in the list, even if matched.
      ```ts
      // uno.config.ts
      presets: asPresetVunor({
        excludeComponents: ["as-filter-dialog", "as-config-dialog"],
      }),
      ```
    - **Semantics:** the exclusion is _post-match_. The match patterns still run; matched-but-excluded components silently drop. This means a user who excludes `as-filter-dialog` but then renders it anyway will get an unstyled component — that is the user's explicit choice. Document this in the README near the option.
    - **Helper-call interaction:** if `createDefaultTableComponents` is matched and `as-filter-dialog` is excluded, the helper still expands to its alias list, but the excluded items drop. Power users who built their own filter dialog and call `createDefaultTableComponents` to get the rest will see exactly the right behavior.
    - **Pre-built CSS path:** `excludeComponents` is a **consumer-side option only**. Pre-built CSS is generated once at our build time and shipped fixed; consumers cannot influence it. A user who needs to drop default components from their bundle must use the UnoCSS path. Document this trade-off in the README.
    - **Internal CSS-build option (different concern):** the Phase 5 CSS build script may take a separate internal flag to omit specific components from the _generated_ `all.css` artifact (e.g., for size-tuning experiments). That flag is internal tooling, not a public API, and it is unrelated to the consumer-facing `excludeComponents`. Do not expose it in `package.json` exports or document it for consumers.
    - **Public helper for advanced cases:** in addition to `excludeComponents`, expose `getComponentClasses(...kebabNames)` so users who want full manual control can build their own safelist and skip the extractor entirely.

16. **All exported components use the `As*` prefix. Rename `WfForm` → `AsWfForm`.**
    - **Why:** consistency with `AsForm`, `AsTable`, etc., simplifies the extractor regex (`<As[A-Z]\w*` is the only PascalCase pattern), and aligns with the `as-*` class prefix and `as-*.vue` filename convention. `WfForm` is the one exception today; renaming it is a small, isolated change.
    - **Scope of rename (Phase 1):**
      - Rename file: `packages/vue-wf/src/wf-form.vue` → `packages/vue-wf/src/components/as-wf-form.vue` (note new `components/` subdir per Decision 17).
      - Rename export: `WfForm` → `AsWfForm` in [packages/vue-wf/src/index.ts](packages/vue-wf/src/index.ts) and any internal references.
      - Rename test file: `packages/vue-wf/src/__tests__/wf-form.spec.ts` → `as-wf-form.spec.ts` (test file naming follows component file naming).
      - Update all consumer call sites (`packages/demo/src/**`, `packages/vue-playground/src/**` if present, tests).
      - The class name `as-wf-form-error` stays (it already follows the `as-*` convention).
    - **Convention going forward:** any new exported Vue component must (a) be named `As<Name>` in PascalCase, (b) live in `as-<name>.vue` under the canonical layout (Decision 17), (c) use class names prefixed `as-<name>-...`.

17. **Canonical component layout for vue-\* packages — directory IS the tier.**
    - **Why:** rather than make the extractor and helper-alias parser handle the quirks of each package's current layout, enforce one canonical layout so the tooling has a single, simple set of rules. Every new component or helper conforms automatically; the extractor doesn't grow special cases. Equally important: the directory a component lives in dictates **how it's exposed to consumers** — there is no separate "is this public?" config.
    - **Three tiers — every vue-\* package follows this:**

      | Subdir | Tier | Subpath import (`pkg/as-name`) | Barrel named export (`{ AsName } from "pkg"`) | Auto-import resolver |
      |--------|------|--------------------------------|----------------------------------------------|----------------------|
      | `src/components/*.vue` | **1 — Primary** (user tags in templates) | ✓ | ✓ | ✓ |
      | `src/components/defaults/*.vue` | **2 — Default implementations** (swap targets) | ✓ | ✓ | ✗ |
      | `src/components/internal/*.vue` | **3 — Composition internals** | ✗ | ✗ | ✗ |

      The auto-import resolver covers Tier 1 only — defaults are public and importable, but users compose them via explicit imports rather than tagging them directly in templates.

      Tier 3 internals still reach the per-component safelist via the dependency walk from public entries — they just aren't importable.

    - **Tier definitions in plain English:**
      - **Tier 1 (primary):** components a user types as a tag. Examples: `<AsForm>`, `<AsTable>`, `<AsTableRoot>`, `<AsFilters>`, `<AsField>`, `<AsIterator>`, `<AsWfForm>`. These are the package's user-facing API.
      - **Tier 2 (defaults):** out-of-the-box implementations users may swap via prop maps (`:types`, `:components`). Examples: `AsInput`, `AsSelect`, `AsFilterDialog`, `AsConfigDialog`, `AsTableHeaderCell`. Users get them via `createDefaultTypes()` / `createDefaultTableComponents()` AND can import them explicitly to wrap or compose.
      - **Tier 3 (internals):** composition helpers that exist only because some other library component renders them. Examples: `AsTableBase`, `AsTableVirtualizer`, `AsOrderableList`, `AsFilterConditions`, `AsFilterValueHelp`, `AsFieldsSelector`, `AsSortersConfig`, `AsFieldShell`, `AsNoData`, `AsStructuredHeader`, `AsVariantPicker`. Not part of the public API. Users can't tag them, can't import them, can't override them — they're an implementation detail.

    - **Helper functions** (`createDefaultTypes`, `createDefaultTableComponents`) live at `src/composables/create-*.ts`. They import from the defaults barrel only — `import { AsX, AsY } from "../components/defaults"` — and **must not** import from individual `.vue` files. They are re-exported from `src/index.ts`. The defaults barrel may also re-export Tier 2 components that physically live elsewhere (e.g. swap targets at root pulled in via `from "../as-name.vue"`), so the helper's single canonical import line still resolves.

    - **Defaults barrel** (`src/components/defaults/index.ts`) is a **pure re-export barrel** (no logic, no helper functions). It must list every Tier 2 component the package ships, including any whose `.vue` file lives outside `defaults/`.

    - **Tooling implication:** Phase 3's helper-alias parser needs only one rule: "open each helper file in `<pkg>/src/composables/create-*.ts`, find the import that points at `../components/defaults`, take the named identifiers, kebab-case them." No fallback parsing path. No special-casing per package.

    - **Propagation to project guidance:** Phase 1 step 9 propagates this layout into [CLAUDE.md](CLAUDE.md) and [openspec/config.yaml](openspec/config.yaml) so subsequent feature designs (post-this-initiative, by agents who never read STYLES.md) follow the same rules. Without that propagation the convention drifts the moment someone adds a new component.

    - **Migration history (now done):**
      - Phase 1 moved `WfForm` → `AsWfForm` to `src/components/as-wf-form.vue` (Decision 16 + 17).
      - Phase 1 step 4a extracted `createDefaultTableComponents()` from `defaults/index.ts` into `src/composables/create-default-table-components.ts` and widened the defaults barrel to re-export `AsTableHeaderCell` / `AsTableCellValue` (still physically at root, since they're swap targets that some users may also want to tag directly).
      - **Post-Phase-1 follow-up (this revision):** vue-table layout was rebalanced to match the three-tier model:
        - Moved to `internal/`: `as-table-base.vue`, `as-table-virtualizer.vue` (from root); `as-filter-conditions.vue`, `as-filter-value-help.vue`, `as-fields-selector.vue`, `as-sorters-config.vue`, `as-orderable-list.vue` (from defaults/).
        - Moved root → defaults/: `as-table-header-cell.vue`, `as-table-cell-value.vue` (they're swap targets, not user-tagged primaries).
        - Moved defaults/ → root: `as-filters.vue` (it's a user-tagged primary, used 2× as `<AsFilters>` in playground/demo).
        - vue-form and vue-wf were already aligned and required no further changes.

---

## Phase 0 — Inventory & dynamic-class audit ✅ Implemented

**Goal:** confirm the migration is safe before touching anything.

**Why now:** if there are dynamic class names we missed, the static-extraction approach will silently drop them at consumer build time and the UI will look broken.

**Done already** (recorded here so the agent doesn't redo it):

- Templates: 100% `as-*` shortcuts. No inline raw utilities found in spot checks of [packages/vue-form/src/components/as-form.vue](packages/vue-form/src/components/as-form.vue) and [packages/vue-table/src/components/as-table.vue](packages/vue-table/src/components/as-table.vue).
- Dynamic class construction across both packages: only one match — `` `as-item-${keyCounter++}` `` in [packages/vue-form/src/composables/use-form-array.ts:39](packages/vue-form/src/composables/use-form-array.ts#L39), which is a Vue `:key` value, not a CSS class. Safe to ignore.

**Remaining steps for the Phase 0 agent:**

1. Re-run the dynamic-class grep more broadly (look for `class:`, `:class=`, conditional class objects, classList operations, `setAttribute('class'`) across **all three Vue packages** including all component subdirs (root, `defaults/`, `internal/`):
   ```bash
   grep -rn ":class\|class:\|classList\|setAttribute(['\"]class" packages/vue-form/src packages/vue-table/src packages/vue-wf/src
   grep -rn "\\\`as-\\|'as-\\|\"as-" packages/vue-form/src packages/vue-table/src packages/vue-wf/src | grep -v "shortcuts.ts"
   ```
2. Audit helper-driven component usage. Confirm the current contents of `createDefaultTypes()` and `createDefaultTableComponents()` to produce a **throwaway draft** of the `helperAliases` map for sanity-checking Phase 3 output (the real map is generated by the script per Decision 17):
   ```bash
   grep -n "from \"../components/defaults\"\|from './defaults'" packages/vue-form/src/composables/create-default-types.ts packages/vue-table/src/components/defaults/index.ts
   ```
   Note: `packages/vue-table/src/components/defaults/index.ts` is the **pre-Phase-1** location of `createDefaultTableComponents`. After Phase 1 step 4a it moves to `packages/vue-table/src/composables/create-default-table-components.ts`, and that's the path the Phase 3 extraction script will scan. The draft from this audit is purely for verifying the post-migration script produces the expected component lists — discard once Phase 3 lands.
3. Snapshot current outputs for diff comparison later. The old per-package CSS pipeline must produce both files before Phase 1 lands; if either is missing, fail loudly rather than silently skip — a missing snapshot means we have nothing to diff against post-migration.
   ```bash
   set -euo pipefail
   pnpm --filter @atscript/vue-form --filter @atscript/vue-table run build
   [[ -s packages/vue-form/dist/unocss.css ]] || { echo "ERROR: vue-form/dist/unocss.css missing — old pipeline broken before snapshot"; exit 1; }
   [[ -s packages/vue-table/dist/unocss.css ]] || { echo "ERROR: vue-table/dist/unocss.css missing — old pipeline broken before snapshot"; exit 1; }
   cp packages/vue-form/dist/unocss.css /tmp/unocss-snapshot-form-before.css
   cp packages/vue-table/dist/unocss.css /tmp/unocss-snapshot-table-before.css
   ```
   vue-wf has no `dist/unocss.css` today — its single class (`as-wf-form-error`) currently leaks in via the misfiled shortcut in [packages/vue-form/src/unocss/shortcuts.ts:111](packages/vue-form/src/unocss/shortcuts.ts#L111), so it's already included in the vue-form snapshot.
   Keep these. After Phase 5, the new `all.css` should be a superset of the union of these two (plus any classes that the old per-package scan missed).
4. List any class names that are constructed dynamically. For each, decide: refactor to static, or add to a manual safelist override in the new package. Append the list to a "known-dynamic classes" section at the bottom of this doc when reporting.
5. Confirm the demo package ([packages/demo/uno.config.ts](packages/demo/uno.config.ts)) has the same source-glob workaround as [packages/vue-playground/uno.config.ts](packages/vue-playground/uno.config.ts), AND scans `../vue-wf/src/**`. Any differences should be noted — every later phase touches both configs.
6. Audit the per-package configs that will break in Phase 1:
   - [packages/vue-form/uno.config.ts](packages/vue-form/uno.config.ts) imports `./src/unocss` and `@atscript/unocss-preset`.
   - [packages/vue-table/uno.config.ts](packages/vue-table/uno.config.ts) same pattern.
   - vue-wf may not have one — check; if absent, no action needed in Phase 1.
   - Decide for each: keep (point at `@atscript/ui-styles`), or delete (consumer apps own the UnoCSS config). Deletion is preferred unless these configs power something specific (e.g., a per-package `vp check` style step).
7. Inventory `WfForm` references across the repo for the Decision 16 rename:
   ```bash
   grep -rn "WfForm\|wf-form\.vue" packages/
   ```
   Produce a list of files to update in Phase 1.

**Success criteria:** dynamic-class list captured (likely empty or near-empty), helper alias draft produced, demo workaround confirmed, snapshot CSS files saved, per-package config decisions made, `WfForm`-rename file list produced.

---

## Phase 1 — Rename to `@atscript/ui-styles` and move shortcuts ✅ Implemented

**Goal:** all shortcut definitions live in `@atscript/ui-styles`. The Vue packages no longer ship shortcuts.

**Depends on:** Phase 0 complete.

**Steps:**

1. **Rename the package.**
   - In [packages/unocss-preset/package.json](packages/unocss-preset/package.json), change `"name": "@atscript/unocss-preset"` → `"name": "@atscript/ui-styles"`.
   - Bump version to `1.0.0` (from `0.x` — major because it's a breaking rename).
   - Rename the directory: `packages/unocss-preset/` → `packages/ui-styles/`.
   - Find every `@atscript/unocss-preset` reference and update it:
     ```bash
     grep -rln "@atscript/unocss-preset" --include="*.ts" --include="*.json" --include="*.mts" --include="*.vue" --include="*.md" .
     ```
     Expected hits: `packages/vue-form/{package.json,vite.config.ts}`, `packages/vue-table/{package.json,vite.config.ts}`, `packages/vue-playground/{package.json,uno.config.ts}`, possibly `pnpm-workspace.yaml` catalog entries, possibly README/docs.
   - Run `pnpm install` to refresh the workspace lockfile.

2. **Move shortcut files.**
   - Create `packages/ui-styles/src/shortcuts/` with subdirs `form/`, `table/`, `wf/`, `common/`.
   - Split [packages/vue-form/src/unocss/shortcuts.ts](packages/vue-form/src/unocss/shortcuts.ts) by component (`as-form`, `as-field`, `as-checkbox-field`, `as-radio-group`, `as-structured-*`, `as-object*`, `as-array*`, `as-dropdown*`, `as-ref-*`, `as-action-field`, `as-submit-btn`, etc.) into one file per component group under `form/`. One sensible split: `as-form.ts`, `as-field.ts`, `as-array.ts`, `as-object.ts`, `as-dropdown.ts`, `as-buttons.ts`. Don't be too granular — match the component file boundaries in [packages/vue-form/src/components/](packages/vue-form/src/components/).
   - Same for [packages/vue-table/src/unocss/shortcuts.ts](packages/vue-table/src/unocss/shortcuts.ts) under `table/`. The natural splits are visible in the existing file's section comments: `as-page-*`, `as-fpill-*`, `as-table-*`, `as-column-menu-*`, `as-filter-dialog-*`, `as-config-dialog-*`, `as-orderable-list-*`, `as-sorter-*`, `as-config-tab-*`. Group by visual surface, not by every prefix.
   - For vue-wf: create `packages/ui-styles/src/shortcuts/wf/as-wf-form.ts` exporting an object with the `as-wf-form-error` shortcut. **The shortcut is currently misfiled in [packages/vue-form/src/unocss/shortcuts.ts:111](packages/vue-form/src/unocss/shortcuts.ts#L111)** (a vue-wf class living in the vue-form shortcut file). Move it from there into the new `wf/` directory — don't leave a copy behind in `form/`.
   - Anything used across multiple packages (`as-spacer`, `as-status-badge`, `as-tag-chip` from the table file's "generic utilities" section — verify by grep across `packages/vue-form/src` and `packages/vue-wf/src`) goes to `common/`.

3. **Add barrel exports — preserve the existing vunor re-exports.**
   - `packages/ui-styles/src/shortcuts/index.ts` exports `formShortcuts`, `tableShortcuts`, `wfShortcuts`, `commonShortcuts`, and a merged `allShortcuts` (use `mergeVunorShortcuts` from `vunor`).
   - Update `packages/ui-styles/src/index.ts` to re-export from `./shortcuts`.
   - **Preserve the vunor re-exports.** [packages/unocss-preset/src/index.ts:6-7](packages/unocss-preset/src/index.ts#L6-L7) currently re-exports `defineShortcuts`, `mergeVunorShortcuts`, `toUnoShortcut`, and `TVunorShortcut` from `vunor/theme`. Both [packages/vue-playground/uno.config.ts](packages/vue-playground/uno.config.ts) and [packages/demo/uno.config.ts](packages/demo/uno.config.ts) consume `defineShortcuts` from `@atscript/unocss-preset`, not from `vunor/theme` directly. The new `@atscript/ui-styles/src/index.ts` MUST keep these re-exports identical, otherwise Phase 1 breaks the consumer configs.

4. **Rename `WfForm` → `AsWfForm` and migrate to canonical layout** per Decisions 16 + 17.
   - Move + rename: `packages/vue-wf/src/wf-form.vue` → `packages/vue-wf/src/components/as-wf-form.vue` (file renamed AND placed under the canonical `components/` subdir).
   - Rename test file: `packages/vue-wf/src/__tests__/wf-form.spec.ts` → `as-wf-form.spec.ts`.
   - Update [packages/vue-wf/src/index.ts](packages/vue-wf/src/index.ts) export to `AsWfForm` and adjust the import path to `./components/as-wf-form.vue`.
   - Update all references found in Phase 0 step 7. Expected hits: spec files, demo views, `vue-playground` if any.
   - Re-run the inventory grep — `grep -rn "WfForm\|wf-form\.vue" packages/` should only return the new `AsWfForm` / `as-wf-form.vue` references.

4a. **Migrate vue-table to the canonical helper layout** (Decision 17). Note: vue-form's [packages/vue-form/src/composables/create-default-types.ts](packages/vue-form/src/composables/create-default-types.ts) already conforms — only vue-table needs migration.

- **Extend the defaults barrel to cover what the helper imports.** The helper today reaches `AsTableHeaderCell` and `AsTableCellValue` directly from `src/components/as-table-header-cell.vue` and `src/components/as-table-cell-value.vue` (root). Per Decision 17 a helper imports only from the canonical defaults barrel, so the barrel must re-export them. In [packages/vue-table/src/components/defaults/index.ts](packages/vue-table/src/components/defaults/index.ts), add re-exports:

  ```ts
  // Re-exported here for the helper's canonical-barrel import (Decision 17).
  // These components physically live at src/components/ but are exposed through
  // the defaults barrel so createDefaultTableComponents can import them with the
  // single from "../components/defaults" line that the parser expects.
  export { default as AsTableHeaderCell } from "../as-table-header-cell.vue";
  export { default as AsTableCellValue } from "../as-table-cell-value.vue";
  ```

  This widens the role of `defaults/index.ts` from "re-export the `defaults/` files" to "the canonical aggregation point for everything any helper needs." That's intentional — Decision 17's parser rule depends on it.

- Create `packages/vue-table/src/composables/create-default-table-components.ts`. Move the `createDefaultTableComponents` function body from [packages/vue-table/src/components/defaults/index.ts:29](packages/vue-table/src/components/defaults/index.ts#L29) into this new file. Imports become a single line:

  ```ts
  import {
    AsTableHeaderCell,
    AsTableCellValue,
    AsColumnMenu,
    AsFilterDialog,
    AsFilterInput,
    AsFilterField,
    AsConfigDialog,
  } from "../components/defaults";
  ```

- Strip `createDefaultTableComponents` and the now-redundant individual default-component imports from `packages/vue-table/src/components/defaults/index.ts`. The file becomes pure re-exports (the existing `export { AsColumnMenu, AsFilters, ... }` block plus the two new re-exports above).

- Update [packages/vue-table/src/index.ts](packages/vue-table/src/index.ts) to import `createDefaultTableComponents` from its new location instead of from `./components/defaults`. The public API (the `createDefaultTableComponents` export name) does not change — only its internal location.

- Verify tests still pass for vue-table; the helper itself is unchanged in behavior.

5. **Wire the playground AND demo.**
   - In **both** [packages/vue-playground/uno.config.ts](packages/vue-playground/uno.config.ts) and [packages/demo/uno.config.ts](packages/demo/uno.config.ts), replace the per-package shortcut imports with `import { allShortcuts } from '@atscript/ui-styles'`.
   - **Keep the existing library source globs** (`../vue-form/src/**`, `../vue-table/src/**`, `../vue-wf/src/**`) in `content.filesystem` for now — the safelist extractor doesn't exist yet, so without these globs the styles will be missing. Phase 6 removes them, not Phase 1.
   - Audit any `presets: [asPresetVunor({...})]` calls and unwrap to `presets: asPresetVunor({...})` per Decision 14.

6. **Update or delete the per-package `uno.config.ts` files.**
   - [packages/vue-form/uno.config.ts](packages/vue-form/uno.config.ts) currently imports `./src/unocss` and `@atscript/unocss-preset`. After Phase 1 step 7 deletes `src/unocss/`, this config breaks.
   - [packages/vue-table/uno.config.ts](packages/vue-table/uno.config.ts) same situation.
   - **Decision** (per Phase 0 step 6): if these configs serve no purpose (they're not invoked by the build script today — `package.json` `build` script calls `unocss CLI` directly with inline config), **delete them**. If you want to keep a per-package config for ad-hoc UnoCSS runs, point it at `@atscript/ui-styles` and `formShortcuts` / `tableShortcuts` from the new package.
   - vue-wf may not have a `uno.config.ts` — verify; if absent, nothing to do here.

7. **Delete the old shortcut files** in `vue-form/src/unocss/` and `vue-table/src/unocss/`. Drop the `./unocss` subpath export from each `package.json`. Drop the `unocss CLI` step from each package's `build` script. Drop the `dist/unocss.css` and `./unocss.css` exports.

8. **Drop the now-dead `@atscript/unocss-preset` devDep + neverBundle entries.** Once shortcuts have moved out, the per-package `uno.config.ts` files are deleted/repointed (step 6), and the `dist/unocss.css` step is gone (step 7), neither vue-form nor vue-table needs the styles package as a dependency anymore. Clean it up:
   - Remove `"@atscript/unocss-preset"` (or `"@atscript/ui-styles"` if step 1 left it as a stale rename) from `devDependencies` in [packages/vue-form/package.json:47](packages/vue-form/package.json#L47) and [packages/vue-table/package.json:46](packages/vue-table/package.json#L46).
   - Remove the same entry from the `pack.deps.neverBundle` arrays in [packages/vue-form/vite.config.ts:22](packages/vue-form/vite.config.ts#L22) and [packages/vue-table/vite.config.ts:21](packages/vue-table/vite.config.ts#L21).
   - Run `pnpm install` to refresh the lockfile.
   - vue-wf may not have either reference today — verify and skip if absent.

9. **Propagate Decision 17 rules to project guidance docs.** This step locks in the canonical layout for every future feature design — agents working on unrelated work after this initiative will read these files (not STYLES.md, which is implementation-specific) and must follow the same conventions, otherwise the class-extractor system silently breaks on new components.
   - **Update [CLAUDE.md](CLAUDE.md).** Add a new section (place it inside the existing "Architecture" or "Conventions" block — co-locate with the styling guidance so it's read together):

     ```markdown
     ### Component organization (vue-\* packages)

     Every `@atscript/vue-*` package follows a single canonical layout. The
     class-extractor and pre-built CSS pipelines depend on it — deviation
     silently breaks consumer styling.

     - All `.vue` components live under `src/components/`.
     - **Public root components** at `src/components/*.vue` — exported by name
       from `src/index.ts`, exposed via package subpath `@atscript/<pkg>/<as-name>`.
     - **Public default implementations** at `src/components/defaults/*.vue` —
       same exposure as root, plus re-exported from
       `src/components/defaults/index.ts` (a pure re-export barrel: no logic,
       no helper functions).
     - **Private internals** at `src/components/internal/*.vue` — NOT exported
       from `src/index.ts`, no subpath, no resolver entry. Their classes still
       reach the safelist via the dependency walk from public entries.
     - **Helper functions** wiring up default components live at
       `src/composables/create-*.ts`. They import their components via a single
       `import { AsX, AsY, ... } from "../components/defaults"` line. They
       MUST NOT import individual `.vue` files. If a public root component is
       referenced by a helper, re-export it from the defaults barrel so the
       single-import rule still holds.
     - Naming: `As<Name>` PascalCase identifier ↔ `as-<name>.vue` filename ↔
       `as-<name>-*` class names.

     Background: see STYLES.md Decision 17.
     ```

   - **Update [openspec/config.yaml](openspec/config.yaml).** Extend the existing `context:` block with a parallel paragraph (insert after the "Adapter boundary" or "Styling" paragraph — wherever component organization fits the existing flow):

     ```yaml
       Component layout (vue-* packages): canonical structure required for
       the class-extractor and pre-built CSS pipelines (STYLES.md Decision 17).
       All `.vue` components under `src/components/`. Public root at
       `src/components/*.vue`; public defaults at `src/components/defaults/*.vue`
       re-exported from `src/components/defaults/index.ts` (pure barrel).
       Private internals at `src/components/internal/*.vue` (not exported,
       no subpath). Helper functions at `src/composables/create-*.ts` import
       components via one line `from "../components/defaults"` only — never
       from individual `.vue` files. Naming: `As<Name>` ↔ `as-<name>.vue` ↔
       `as-<name>-*` classes. Deviation breaks the extractor silently.
     ```

   - **Update [packages/unocss-preset/](packages/unocss-preset/) → `@atscript/ui-styles` line in openspec/config.yaml** as part of the Phase 1 rename — that line will be stale otherwise.

   - **Update [packages/demo, packages/vue-playground](#) line in openspec/config.yaml** if it still says "consume library dist/, not source — rebuild library before testing." After Phase 6, the playground's filesystem-scan workaround is gone; that note becomes accurate by default.

   - **Verification:** after the edits, a fresh agent reading only CLAUDE.md and openspec/config.yaml should be able to add a new component or helper without violating Decision 17. Sanity-test by drafting a hypothetical "add a new vue-form component" task and confirming the docs alone yield the right placement and import shape.

**Success criteria:**

- `pnpm build` succeeds on every package.
- `pnpm dev` (playground) and the demo app both load visually identical to before.
- No `@atscript/unocss-preset` reference left anywhere (`grep -r` returns nothing).
- No `WfForm` reference left anywhere — only `AsWfForm`.
- `vue-form/dist/` and `vue-table/dist/` no longer contain `unocss.css`.
- All `asPresetVunor(...)` consumer call sites use `presets: asPresetVunor(...)` (no extra array wrap).
- `vp check` and `vp test` pass on all packages including vue-wf.
- **Decision 17 conformance check:** `createDefaultTableComponents` lives at `packages/vue-table/src/composables/create-default-table-components.ts` and is re-exported from [packages/vue-table/src/index.ts](packages/vue-table/src/index.ts). Its only `from "..."` import in the body is a single line referencing `"../components/defaults"`. The defaults barrel ([packages/vue-table/src/components/defaults/index.ts](packages/vue-table/src/components/defaults/index.ts)) contains zero function definitions — only re-exports.
- vue-wf's component lives at `packages/vue-wf/src/components/as-wf-form.vue` (post Decision 17 layout), not at the package root.
- **Project-guidance docs updated:** [CLAUDE.md](CLAUDE.md) has the "Component organization" section; [openspec/config.yaml](openspec/config.yaml)'s `context:` block has the canonical-layout paragraph. Both reference STYLES.md Decision 17 so future readers know where to find the full rationale.

**Risks:** the playground and demo _intentionally_ still depend on filesystem scanning of `../vue-{form,table,wf}/src/**` until the extractor exists. Don't delete those filesystem entries until Phase 6.

---

## Phase 2 — Per-component build entries for `vue-form`, `vue-table`, and `vue-wf` ✅ Implemented

**Goal:** each Vue component is importable as its own subpath (`@atscript/vue-form/as-form`, `@atscript/vue-table/as-table`, `@atscript/vue-wf/as-wf-form`, etc.). Tree-shaking improves; per-component safelists become possible.

**Depends on:** Phase 1 (so the build doesn't have to dance around the `unocss` subpath, and `WfForm` is already renamed).

**Component classification — reads from Decision 17.**

After Phase 1's canonical-layout migration, **every** vue-\* package has the same structure:

| Subdir                          | Public subpath? | Build entry?                                   | In safelist?                                                 |
| ------------------------------- | --------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| `src/components/*.vue` (root)   | **Yes**         | Yes                                            | Yes                                                          |
| `src/components/defaults/*.vue` | **Yes**         | Yes                                            | Yes                                                          |
| `src/components/internal/*.vue` | **No**          | **No** dedicated entry; ships in shared chunks | **Yes** — discovered via dependency walk from public entries |

Concrete examples (post-Phase-1 layout):

- vue-form root: `as-form.vue`, `as-field.vue`, `as-iterator.vue`.
- vue-form `defaults/`: `as-input.vue`, `as-select.vue`, `as-radio.vue`, `as-checkbox.vue`, `as-paragraph.vue`, `as-action.vue`, `as-object.vue`, `as-array.vue`, `as-union.vue`, `as-tuple.vue`, `as-ref.vue`.
- vue-form `internal/`: `as-field-shell.vue`, `as-no-data.vue`, `as-structured-header.vue`, `as-variant-picker.vue` (4 files, all private).
- vue-table root: `as-table.vue`, `as-table-root.vue`, `as-table-base.vue`, `as-table-virtualizer.vue`, `as-table-cell-value.vue`, `as-table-header-cell.vue` (all 6 are public per Decision 17).
- vue-table `defaults/`: `as-column-menu.vue`, `as-filters.vue`, `as-filter-dialog.vue`, `as-filter-input.vue`, `as-filter-field.vue`, `as-filter-conditions.vue`, `as-filter-value-help.vue`, `as-config-dialog.vue`, `as-fields-selector.vue`, `as-sorters-config.vue`, `as-orderable-list.vue`.
- vue-table `internal/`: empty (not currently used).
- vue-wf root: `as-wf-form.vue` (the only component, post-rename + move).

So the build needs **two** views of the component tree:

- **Public entries** (root + `defaults/`) — get their own subpath in `package.json` exports.
- **All `.vue` files everywhere** — must be discoverable by the Phase 3 extractor so internal-component classes end up in the right safelist.

**Steps:**

1. **Auto-generate the entries map.**
   - Write a single `scripts/gen-exports.mjs` shared across all three Vue packages (or per-package if simpler — the logic is identical because Decision 17 unifies the layout). It should:
     - Recursively scan `src/components/**/*.vue`. After Phase 1, every package has this layout — no per-package branching needed.
     - Filter out `internal/` for the public `exports` map and `pack.entry` map. Internal components are bundled into whichever public entry imports them.
     - Build an `entries` record from root + `defaults/` files: `{ "as-form": "src/components/as-form.vue", "as-input": "src/components/defaults/as-input.vue", "as-wf-form": "src/components/as-wf-form.vue", ... }` plus the existing `index` entry.
     - Naming collision check: assert no two public components share a kebab-case name across root vs `defaults/`. If they do, fail loudly — the safelist key would be ambiguous.
     - Update `package.json` `exports` map: add one entry per public component.
   - Reference [vunor's gen-exports.js](/Users/mavrik/code/vunor/packages/vunor/scripts/gen-exports.js) — same idea, adapted to our directory layout.
   - Wire the script into the `build` npm script: `"build": "node scripts/gen-exports.mjs && vp pack"`.

2. **Update `vp pack` config.**
   - In [packages/vue-form/vite.config.ts](packages/vue-form/vite.config.ts), [packages/vue-table/vite.config.ts](packages/vue-table/vite.config.ts), and `packages/vue-wf/vite.config.ts`, expand `pack.entry` to include all **public** per-component entries (root + `defaults/` for form/table; root for wf; **never** `internal/`).
   - Use a dedicated glob library, not `node:fs`'s `globSync` with multiple positional args (that signature does not exist). `tinyglobby` is already in the workspace catalog; either of these works:

     ```ts
     // Option A — tinyglobby with brace pattern (works for vue-form/vue-table)
     import { globSync } from "tinyglobby";
     const componentEntries = Object.fromEntries(
       globSync(["src/components/*.vue", "src/components/defaults/*.vue"]).map((p) => [
         p.match(/(?:components\/(?:defaults\/)?)(.+)\.vue$/)![1],
         p,
       ]),
     );
     // pack.entry: { index: "src/index.ts", ...componentEntries }

     // Option B — fs.glob (Node 22+) with one call per directory
     import { globSync } from "node:fs";
     const componentEntries = Object.fromEntries(
       [
         ...globSync("src/components/*.vue"),
         ...globSync("src/components/defaults/*.vue"),
       ].map(/* same map */),
     );
     ```

     Pick A (tinyglobby) — it's already used elsewhere and supports brace expansion if needed.

   - Verify `dts: { vue: true }` and `plugins: [vue()]` are still set — they handle the `.vue` SFC compilation.

3. **Do not externalize sibling components** (per Decision 3). Let the bundler emit shared chunks. Verify after build that `dist/` contains shared chunks (`chunk-*.mjs` or similar) and that loading two component entries doesn't duplicate code. `internal/` components should appear inside shared chunks, not as their own entries.

4. **Verify subpath imports work.**
   - From the playground, change one import: `import { AsForm } from '@atscript/vue-form'` → `import AsForm from '@atscript/vue-form/as-form'`. Confirm it works in dev and in build.
   - Try a defaults import: `import AsInput from '@atscript/vue-form/as-input'` — should also work.
   - Try an internal-only import: `import AsFieldShell from '@atscript/vue-form/as-field-shell'` — should **fail** (internal components have no subpath). This is correct.
   - The barrel `index.mjs` should keep working too (don't break consumers who use the barrel — it's still valid).

5. **Type generation.**
   - `dts: { vue: true }` should produce `as-form.d.mts` for each public component. Verify: open one of the generated `.d.mts` files and confirm the default export type is the SFC type.
   - If `vp pack` doesn't emit per-component `.d.mts` cleanly, fall back to a post-build vue-tsc step (vunor does this — see [vunor's emit-vue-dts.js](/Users/mavrik/code/vunor/packages/vunor/scripts/emit-vue-dts.js)). Try the simple path first.

**Success criteria:**

- `dist/as-form.mjs` exists for every public component (root + `defaults/`), plus the existing barrel `dist/index.mjs`.
- No standalone `dist/as-field-shell.mjs` or other internal components — they should be in shared chunks.
- `package.json` `exports` map has one entry per public component, none for internals.
- Playground and demo continue to work.
- Bundle size of a single-component import is meaningfully smaller than the full barrel (rough check: `du dist/as-form.mjs` vs `du dist/index.mjs`).

**Risks:**

- Per-component `.d.mts` for Vue SFCs can be finicky. If `vp pack`'s built-in dts emitter struggles, the fallback (post-build vue-tsc) adds complexity. Budget ~½ extra day for that case.
- Vue plugin in `vp pack` may need explicit configuration for SFC `<script setup lang="ts">` — verify before committing.
- A `defaults/` component name colliding with a root component name will break safelist lookup. The gen-exports script must assert no collision.

---

## Phase 3 — Class extraction script ✅ Implemented

**Goal:** generate `packages/ui-styles/src/generated/component-classes.ts` containing three maps:

- `componentClasses: Record<string, string[]>` — per-component safelist
- `helperAliases: Record<string, string[]>` — per-helper-function safelist
- `componentPackages: Record<string, "form" | "table" | "wf">` — which package each component came from (used by Phase 5's per-package CSS split)

**Depends on:** Phase 1 (shortcuts in ui-styles, including `createAsBaseUnoConfig()` per Decision 13) and Phase 2 (component entries discoverable by file).

**Steps:**

1. **Add `createAsBaseUnoConfig()` to ui-styles** if Phase 1 hasn't already. Per Decision 13, this returns `{ presets, shortcuts }` _without_ the extractor — it's the cycle-breaking factory the script needs. Keep `asPresetVunor()` as the consumer-facing function that wraps the base + adds the extractor in Phase 4.

2. **Write the extraction script** at `packages/ui-styles/scripts/extract-component-classes.ts`. Imports must come from `unocss`, not `@unocss/core` (this package depends on `unocss`):

   ```ts
   import { createGenerator } from "unocss";
   import { createAsBaseUnoConfig } from "../src"; // base, not asPresetVunor — avoids cycle
   import { glob } from "tinyglobby"; // or node:fs/promises glob
   import fs from "node:fs/promises";
   import path from "node:path";

   // High-level flow (canonical layout from Decision 17 — every package shares this structure):
   // a) Discover all .vue components across vue-form, vue-table, vue-wf:
   //      <pkg>/src/components/{*.vue, defaults/*.vue, internal/*.vue}
   //    Record which package each component belongs to → componentPackages.
   // b) For each PUBLIC entry (root + defaults/) walk its dependency graph
   //    to collect every reachable .vue/.ts file. internal/ is reachable transitively, never an entry.
   // c) Concatenate the source of all reachable files; run uno.generate(); capture matched classes
   //    → componentClasses.
   // d) Discover helper functions in src/composables/create-*.ts; per Decision 17 each imports its
   //    components via a single `from "../components/defaults"` line. Parse that line, kebab-case
   //    the identifiers, and record helperAliases[helperName] = [kebabComponentNames].
   // e) Write src/generated/component-classes.ts with all three maps.
   ```

3. **Dependency graph walking — strongly prefer rolldown's `scan()` over a hand-rolled walker.**
   - **Default approach: rolldown scan.** Vunor uses `rolldown/experimental` `scan()` because a hand-rolled walker has to handle `.vue` SFCs (multiple `<script>` blocks, `<script setup>`, lang variants), TS path aliases, barrel re-exports (`defaults/index.ts`), `defineAsyncComponent`, and conditional imports. `scan()` handles all of this correctly.
   - **Toolchain note (Decision 2 caveat):** Decision 2 says "use vp pack, not standalone rolldown." That's about _building_ — the production output. The extraction script is a build-time tool, not a build artifact. Importing `rolldown` (or `rolldown/experimental`) directly inside a `scripts/` file is acceptable and necessary here. `rolldown` is already transitively present via `vite-plus` (`pnpm why rolldown` confirms). Add it as an explicit `devDependency` of ui-styles to make the dependency intentional.
   - **Hand-rolled walker is NOT recommended.** Don't ship a 50-line recursive resolver thinking it'll suffice — it will silently miss classes referenced through `defaults/index.ts` barrel re-exports (which is exactly how `createDefaultTypes` finds its components) and the failure mode is unstyled UI in production, which is hard to spot in tests.

4. **UnoCSS generator setup.**
   - Use `createAsBaseUnoConfig()` (NOT `asPresetVunor()` — Decision 13 cycle break) with default tokens. Pass the base config's `presets` and `shortcuts` straight to `createGenerator()`.
   - Run `uno.generate(code, { preflights: false })` — strips reset CSS so only matched class names come back.
   - The returned `matched` Set contains class names. Convert to a sorted array and store.

5. **Helper-alias extraction (one canonical rule, per Decision 17).**
   - For each vue-_ package, scan `src/composables/create-_.ts`. Every file matching that glob is treated as a helper.
   - Inside each helper file, find the single `import { AsX, AsY, ... } from "../components/defaults"` statement (canonical layout guarantees exactly one such import). Extract the named identifiers; strip `as Foo` aliases if present.
   - Kebab-case each identifier (`AsInput` → `as-input`). The result is `helperAliases[<helperFunctionName>]`.
   - The helper function name is the file's primary export — derive it from the file name (`create-default-types.ts` → `createDefaultTypes`) or by parsing the `export function ...` declaration. File-name derivation is simpler and fine since Decision 17 mandates the naming.
   - Expected output after Phase 1's canonical migration:
     - `createDefaultTypes` (vue-form) → 11 entries (`as-input`, `as-select`, `as-radio`, `as-checkbox`, `as-paragraph`, `as-action`, `as-object`, `as-array`, `as-union`, `as-tuple`, `as-ref`).
     - `createDefaultTableComponents` (vue-table, post-migration to `composables/`) → 7 entries (`as-table-header-cell`, `as-table-cell-value`, `as-column-menu`, `as-filter-dialog`, `as-filter-input`, `as-filter-field`, `as-config-dialog`).
   - Sanity assert in the script: every PascalCase identifier referenced in the helper file's returned object literal must appear in the `import` line. If a helper references a default not pulled from the canonical barrel, fail loudly — that means a regression of Decision 17's layout.
   - **Don't hand-curate** under this regime. Hand-curated lists drift from source. The canonical layout makes parsing simple enough that hand-curation has no advantage.

6. **Output module shape.**

   ```ts
   // packages/ui-styles/src/generated/component-classes.ts
   // GENERATED — DO NOT EDIT BY HAND. Run `pnpm --filter @atscript/ui-styles run extract-classes`.

   export const componentClasses: Record<string, readonly string[]> = {
     "as-form": ["as-default-field", "as-field" /* ... */],
     "as-input": ["as-input-wrap" /* ... */],
     "as-table": ["as-table-outer-wrap" /* ... */],
     "as-filter-dialog": [
       /* ... */
     ],
     "as-wf-form": ["as-wf-form-error"],
     // one entry per PUBLIC component (root + defaults/ for form/table; root for wf), no internal/
   };

   export const helperAliases: Record<string, readonly string[]> = {
     createDefaultTypes: [
       "as-input",
       "as-select",
       "as-radio",
       "as-checkbox",
       "as-paragraph",
       "as-action",
       "as-object",
       "as-array",
       "as-union",
       "as-tuple",
       "as-ref",
     ],
     createDefaultTableComponents: [
       "as-table-header-cell",
       "as-table-cell-value",
       "as-column-menu",
       "as-filter-dialog",
       "as-filter-input",
       "as-filter-field",
       "as-config-dialog",
     ],
   };

   // Used by Phase 5's per-package CSS split (form.css, table.css, wf.css).
   export const componentPackages: Record<string, "form" | "table" | "wf"> = {
     "as-form": "form",
     "as-input": "form",
     "as-table": "table",
     "as-filter-dialog": "table",
     "as-wf-form": "wf",
     // ...
   };

   export function getComponentClasses(...names: string[]): string[] {
     const set = new Set<string>();
     for (const name of names) {
       for (const cls of componentClasses[name] ?? []) set.add(cls);
     }
     return [...set];
   }

   export function getHelperClasses(...helpers: string[]): string[] {
     return getComponentClasses(...helpers.flatMap((h) => helperAliases[h] ?? []));
   }
   ```

7. **Wire into the ui-styles build.**
   - `package.json` script: `"extract-classes": "tsx scripts/extract-component-classes.ts"`.
   - `package.json` script: `"build": "pnpm extract-classes && vp pack"`.
   - **Commit `src/generated/component-classes.ts` to git** (Decision 12). Do NOT add `src/generated/` to `.gitignore`. Add a CI step (or husky pre-commit hook) that runs `extract-classes` and fails if the working tree is dirty afterward (drift check).
   - **Drift-check caveats** — the obvious `git diff --exit-code` after extraction will misfire unless the generator is genuinely deterministic. To avoid spurious CI failures on PRs that don't touch styling:
     - Force LF line endings in the writer (`fs.writeFile(..., content.replace(/\r\n/g, "\n"))` or set `.gitattributes` `* text=auto eol=lf`).
     - Sort with `Array.prototype.toSorted()` and an explicit locale: `arr.toSorted((a, b) => a.localeCompare(b, "en"))`. Default sort is locale-sensitive and varies across CI runners.
     - Use `tinyglobby` (already a workspace dep) instead of `fs.glob` — its result order is stable across platforms.
     - Pin the script's pnpm/Node version via `engines` in `package.json`. UnoCSS preset/utility output can vary subtly across versions.
     - The CI step should be `pnpm extract-classes && git diff --exit-code packages/ui-styles/src/generated/`. Test the drift check once on a PR that touches a class to verify it passes; once on a PR that doesn't, to verify it doesn't false-flag.
   - Reference vue-form, vue-table, and vue-wf as `devDependencies` of ui-styles so the script can resolve their source paths. Hardcoded relative paths (`../vue-form/src/components`, `../vue-table/src/components`, `../vue-wf/src/components` — all uniform per Decision 17) are acceptable since this script only runs in-monorepo.

8. **Determinism.** Sort the classes inside each list and sort the top-level keys alphabetically. This keeps generated diffs minimal across unrelated edits.

**Success criteria:**

- Running `pnpm --filter @atscript/ui-styles run extract-classes` produces `src/generated/component-classes.ts` with **one entry per public component** discovered under `<pkg>/src/components/{*.vue, defaults/*.vue}` for every package. Internal-only components don't get their own entries — their classes appear inside whichever public component imports them.
- `helperAliases` contains entries for `createDefaultTypes` and `createDefaultTableComponents`, each listing the correct set of default components (cross-check against current source).
- `componentPackages` covers every component in `componentClasses` with one of `"form" | "table" | "wf"`. No entry missing or extra.
- All public-component class lists are non-empty (including `as-wf-form: ["as-wf-form-error", ...]`).
- The union of all class sets is a superset of the Phase 0 snapshot CSS files.
- Re-running the script produces a byte-identical file (commit the result and verify `git diff` is clean).
- `vp check` and `vp test` pass on a clean checkout (because the generated file is committed).

**Risks:**

- A hand-rolled walker that just greps `.vue` import paths will see helpers' canonical-barrel import (`from "../components/defaults"`) and stop — it won't resolve the barrel to its individual component re-exports, so the helper's reachable component set comes back empty. Same trap with any `from "./defaults"` re-export inside a public component. `scan()` resolves these correctly; a naive walker doesn't.
- **Decision 17 non-conformance silently breaks helper-alias generation.** If a new helper is added in the wrong location (not `src/composables/create-*.ts`), or imports from `.vue` files directly, or has multiple imports for its components instead of a single `from "../components/defaults"` line, the parser's sanity assert (Phase 3 step 5) fails at extraction time. Mitigation: Decision 17 conformance is the contract; the asserter is the enforcement point. Don't soften the parser to "be helpful" — it should fail loudly so the violation is fixed at the source, not papered over.
- Preset version drift — script and consumers must use the exact same shortcuts/preset. Decision 13's `createAsBaseUnoConfig()` is the single source of truth; do not reconstruct shortcuts inside the script.

---

## Phase 4 — Custom Extractor in `asPresetVunor`

**Goal:** consumers don't need to add anything to their `content.filesystem` for our components — installing `@atscript/ui-styles` and using its preset is sufficient.

**Depends on:** Phase 3 (the safelist module + helper aliases exist).

**Background — what the extractor must match:**

Real consumer code in the playground and demo uses **all of these patterns**, sometimes in a single file. The extractor must handle each. Per Decision 6:

1. **PascalCase tags** — `<AsForm>`, `<AsTableRoot>`, `<AsTable>`, `<AsFilters>`, `<AsIterator>`. **This is the dominant pattern in actual code** — kebab-case is virtually unused. Do not skip this.
2. **Kebab-case tags** — `<as-form>`. Supported but rare.
3. **Subpath imports** — `from '@atscript/vue-form/as-form'`. Emerges with Phase 2.
4. **Barrel named imports** — `import { AsForm, AsField } from '@atscript/vue-form'`. The current pattern; will continue to be common.
5. **Helper-function calls** — `createDefaultTypes(`, `createDefaultTableComponents(`. Mandatory because the components those helpers wire up are never tagged directly by consumers.

**Steps:**

1. **Write `createAsExtractor(opts)`** in [packages/ui-styles/src/preset.ts](packages/ui-styles/src/preset.ts). Reference: [vunor's createVunorExtractor](/Users/mavrik/code/vunor/packages/vunor/src/theme/preset-vunor.ts). The helper-name list is data-driven from the generated `helperAliases` so adding a helper in Phase 3 doesn't require an extractor edit. Per Decision 15, the extractor accepts an `excludeComponents` list:

   ```ts
   import type { Extractor } from "unocss";
   import { componentClasses, helperAliases } from "./generated/component-classes";

   const KEBAB_OF = (pascal: string) => pascal.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

   export interface AsExtractorOptions {
     /**
      * Kebab-case component names whose classes should NEVER be added to the safelist,
      * even when the extractor matches them. Use to drop styles for default components
      * the consumer has replaced with their own (e.g., custom filter dialog).
      */
     excludeComponents?: string[];
   }

   function createAsExtractor(opts: AsExtractorOptions = {}): Extractor {
     const exclude = new Set(opts.excludeComponents ?? []);
     const helperNames = Object.keys(helperAliases);
     const helperPattern = helperNames.length
       ? new RegExp(`\\b(${helperNames.join("|")})\\s*\\(`, "g")
       : null;

     return {
       name: "atscript-ui-components",
       order: -1,
       extract({ code }) {
         const matched = new Set<string>();
         const addClassesFor = (kebab: string) => {
           if (exclude.has(kebab)) return; // Decision 15 opt-out
           for (const cls of componentClasses[kebab] ?? []) matched.add(cls);
         };

         // Pattern 1: subpath imports — `from '@atscript/vue-{form,table,wf}/as-foo'`
         for (const [, name] of code.matchAll(
           /['"]@atscript\/(?:vue-form|vue-table|vue-wf)\/(as-[\w-]+)['"]/g,
         ))
           addClassesFor(name);

         // Pattern 2: barrel named imports — `import { AsForm, AsField } from '@atscript/(vue-form|vue-table|vue-wf)'`
         for (const [, names] of code.matchAll(
           /import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*['"]@atscript\/(?:vue-form|vue-table|vue-wf)['"]/g,
         )) {
           for (const ident of names.split(",")) {
             const name = ident.trim().split(/\s+as\s+/)[0]; // strip "AsForm as Form" aliases
             if (/^As[A-Z]/.test(name)) addClassesFor(KEBAB_OF(name));
           }
         }

         // Pattern 3: PascalCase tags — `<AsForm`, `<AsTableRoot`, `<AsWfForm` (Decision 16)
         for (const [, name] of code.matchAll(/<(As[A-Z][\w]*)/g)) addClassesFor(KEBAB_OF(name));

         // Pattern 4: kebab-case tags — `<as-form`, `<as-wf-form`
         for (const [, name] of code.matchAll(/<(as-[\w-]+)/g)) addClassesFor(name);

         // Pattern 5: helper-function calls — `createDefaultTypes(`, `createDefaultTableComponents(`
         if (helperPattern) {
           for (const [, helper] of code.matchAll(helperPattern)) {
             for (const kebab of helperAliases[helper] ?? []) addClassesFor(kebab);
           }
         }

         return matched.size > 0 ? matched : undefined;
       },
     };
   }
   ```

2. **Register the extractor in the consumer-facing preset only, and forward the opt-out option.**
   Per Decision 13: `createAsBaseUnoConfig()` does NOT include the extractor (it's used by the extraction script, which would cause a cycle). `asPresetVunor(opts)` returns the base config plus a thin preset wrapping `extractors: [createAsExtractor({ excludeComponents: opts.excludeComponents })]`. Extend the existing `AsPresetVunorOptions` type at [packages/unocss-preset/src/preset.ts](packages/unocss-preset/src/preset.ts) with `excludeComponents?: string[]`.

3. **Re-export safelist helpers as public API** from `@atscript/ui-styles`:
   - `componentClasses`, `helperAliases` — for advanced users who want to inspect or build manual safelists.
   - `getComponentClasses(...kebabNames)`, `getHelperClasses(...helperNames)` — convenience wrappers.

4. **Document escape hatches** in the README:
   - Re-tagging a component with a custom name (`const MyForm = AsForm; ... <MyForm />`) defeats the tag pattern. Consumers in this case can either (a) keep using PascalCase + barrel import (Pattern 2 still catches it), or (b) explicitly add `safelist: getComponentClasses("as-form")` to their UnoCSS config.
   - Calling default components conditionally (`if (cond) types.input = MyInput; else types = createDefaultTypes()`) — the helper-call pattern still catches it because the literal `createDefaultTypes(` appears in the source.

**Success criteria:**

- A test `uno.config.ts` that imports only `asPresetVunor()` (zero `content.filesystem` entries pointing into vue-form, vue-table, or vue-wf source) generates valid CSS for the playground and demo apps. Visual diff against the pre-Phase-4 snapshot is empty.
- All five extractor patterns have unit tests covering:
  - PascalCase tag in a `.vue` template
  - Kebab-case tag in a `.vue` template
  - Subpath import in a `.ts` file
  - Barrel named import (with and without `as` aliasing)
  - Helper-function call in a `.ts` file
- Phase 6 (workaround removal) passes.

**Risks:**

- The regex matches names even when they don't exist in `componentClasses` — that's a no-op (the `?? []` guard handles it). Fine.
- A consumer's MDX/Markdown file containing literal `<AsForm>` triggers extraction unnecessarily. Cost is including a few extra classes in the CSS bundle. Acceptable.
- The barrel-import regex could mis-parse exotic import syntax (e.g. multi-line import lists with comments). Test against real consumer files in the playground/demo before declaring done.
- If a new helper function is added in any vue-_ package that returns components the user must style, the helper file must conform to Decision 17 (live at `src/composables/create-_.ts`, single import from `../components/defaults`). The Phase 3 parser then picks it up automatically and `helperAliases` regenerates. Add a comment at the top of each helper function pointing to STYLES.md Decision 17 — it's the contract that governs the file's location and import shape. Decision 11 only describes the runtime mechanism the extractor uses; Decision 17 is what authors of new helpers need to read.

---

## Phase 5 — Pre-built CSS for non-UnoCSS consumers

**Goal:** ship `dist/css/all.css`, `dist/css/form.css`, `dist/css/table.css`, `dist/css/wf.css` from `@atscript/ui-styles` for users who don't run UnoCSS.

**Depends on:** Phase 3 (the safelist exists, including `componentPackages`).

**Steps:**

1. **Write a CSS build script** at `packages/ui-styles/scripts/build-css.ts`. Use `createAsBaseUnoConfig()` (Decision 13) — the script does not need the extractor, it provides its own `safelist`. Imports from `unocss`, not `@unocss/core`:

   ```ts
   import { createGenerator } from "unocss";
   import { createAsBaseUnoConfig } from "../src";
   import { componentClasses, componentPackages } from "../src/generated/component-classes";
   import fs from "node:fs/promises";

   const byPkg = (pkg: "form" | "table" | "wf") =>
     Object.keys(componentClasses).filter((c) => componentPackages[c] === pkg);

   async function build(name: string, components: string[]) {
     const safelist = [...new Set(components.flatMap((c) => componentClasses[c] ?? []))];
     const base = createAsBaseUnoConfig({});
     const uno = await createGenerator({
       presets: base.presets,
       shortcuts: base.shortcuts,
       safelist,
     });
     const { css } = await uno.generate(safelist.join(" "));
     await fs.writeFile(`dist/css/${name}.css`, css);
   }

   await fs.mkdir("dist/css", { recursive: true });
   await build("all", Object.keys(componentClasses));
   await build("form", byPkg("form"));
   await build("table", byPkg("table"));
   await build("wf", byPkg("wf"));
   ```

   **Why a separate `wf.css`** even though vue-wf currently has only one component: keeps the per-package CSS surface symmetric, matches consumer mental model ("one CSS file per package I install"), and means future vue-wf component growth doesn't change the public CSS API. The file will be small today (a few classes) — that's fine.

   `componentPackages` is part of Phase 3's output (see updated module shape there). The build script just reads it.

2. **Add CSS exports to `package.json`.**

   ```json
   "./css": "./dist/css/all.css",
   "./css/all": "./dist/css/all.css",
   "./css/form": "./dist/css/form.css",
   "./css/table": "./dist/css/table.css",
   "./css/wf": "./dist/css/wf.css"
   ```

3. **Wire into the build.**
   `"build": "pnpm extract-classes && vp pack && pnpm build-css"`.

4. **Document the trade-off** in [packages/ui-styles/README.md](packages/ui-styles/README.md):
   - Pre-built CSS uses default theme. No customization.
   - Pre-built CSS is **shipped fixed** — there is no consumer-side mechanism to remove components from it. The Decision 15 `excludeComponents` option only affects the UnoCSS path, not these `.css` files.
   - For theming OR for excluding components: install UnoCSS, use `asPresetVunor({...})` with custom palette/tokens and (optionally) `excludeComponents`.

**Success criteria:**

- All four CSS files exist after `pnpm build` (`all.css`, `form.css`, `table.css`, `wf.css`).
- A non-UnoCSS test app can `import "@atscript/ui-styles/css/all"` and the components render with the default theme.
- File sizes are reasonable (likely 20-100KB minified for `all`, smaller for the per-package files — large enough to make tree-shaking worthwhile, small enough not to be alarming).

**Risks:**

- Class overlap between `form.css`, `table.css`, `wf.css` is intentional but could surprise users who load multiple. **Mechanism:** the per-package CSS files are independently complete, not partitioned. A class from `common/` (or any shared utility used across packages) ends up in `form.css` if any form component pulls it in via the dependency walk, in `table.css` if any table component does, and so on. So `as-spacer` will appear in all three files when it's used in components from all three packages — that's by design so each per-package CSS is self-contained. Document: "load `all.css` if you use more than one package — don't combine the per-package files."

---

## Phase 6 — Cleanup

**Goal:** remove the monorepo-only workarounds.

**Depends on:** Phase 4 (extractor lives in the preset and works).

**Steps:**

1. In **both** [packages/vue-playground/uno.config.ts](packages/vue-playground/uno.config.ts) and [packages/demo/uno.config.ts](packages/demo/uno.config.ts), remove the `../vue-form/src/**`, `../vue-table/src/**`, and `../vue-wf/src/**` filesystem entries (plus the explicit `../vue-{form,table}/src/unocss/shortcuts.ts` entries). Keep only each app's own `src/**`. The extractor handles the rest.
2. Confirm no remaining references to `@atscript/unocss-preset` (Phase 1 should have caught these, but verify after the cleanup).
3. Confirm no `dist/unocss.css` is being generated by any package (Phase 1 dropped the script — verify it didn't sneak back).
4. Confirm all `presets:` consumer call sites use `presets: asPresetVunor(...)` and not `presets: [asPresetVunor(...)]` (Decision 14).
5. Run the full `pnpm ready` pipeline (`fmt → lint → test → build`).
6. Run `pnpm dev` and manually verify forms + tables render correctly. Repeat for the demo app — both must be visually identical to the pre-Phase-4 snapshot.
7. Diff the generated CSS against the Phase 0 snapshots. Any classes present in the snapshot but missing from the new output are bugs (unless they're genuinely unused — investigate before dismissing).

**Success criteria:**

- Playground AND demo work with zero filesystem-scan workarounds for library code.
- All snapshots from Phase 0 are accounted for.
- All five extractor patterns from Phase 4 are exercised by at least one file in the playground or demo (audit by grep — easy way to be sure the regression test surface is real).

**Risks:**

- **Dev-iteration ergonomics regress.** Today, the playground and demo filesystem-scan vue-form/table/wf source directly, so any shortcut tweak in those packages shows up instantly with HMR. After Phase 6, shortcut classes only become visible to UnoCSS via `@atscript/ui-styles`'s built output (the generated `componentClasses` map). Iterating on a shortcut now requires `pnpm --filter @atscript/ui-styles run dev` (vp pack --watch) running alongside the playground.
  - **Mitigation 1:** document the dual-watch flow in the root README ("for shortcut iteration, run ui-styles in watch mode").
  - **Mitigation 2 (optional):** add a dev-only escape hatch in the playground/demo configs — e.g., guard the source-glob filesystem entries behind `if (process.env.AS_DEV_SOURCE_SCAN)`. Off by default (clean prod-like setup), on for active styling work. This is a workaround, not a permanent solution; weigh whether it's worth the complexity.

---

## Phase 7 — Vue Resolver and consumer docs

**Goal:** ergonomic auto-import for end users.

**Depends on:** Phase 2 (per-component subpaths exist).

**Steps:**

1. **Write `AsResolver`** for `unplugin-vue-components` at `packages/ui-styles/src/vite.ts`. Reference: [vunor's VunorVueResolver](/Users/mavrik/code/vunor/packages/vunor/src/vite.ts). Use `componentPackages` (Phase 3 output) as the source of truth for the package each component lives in:

   ```ts
   import { componentPackages } from "./generated/component-classes";

   const PKG_TO_NPM = {
     form: "@atscript/vue-form",
     table: "@atscript/vue-table",
     wf: "@atscript/vue-wf",
   } as const;

   export function AsResolver() {
     return {
       type: "component" as const,
       resolve(name: string) {
         if (!/^As[A-Z]/.test(name)) return;
         const kebab = name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
         const pkg = componentPackages[kebab];
         if (!pkg) return;
         return { name: "default", from: `${PKG_TO_NPM[pkg]}/${kebab}` };
       },
     };
   }
   ```

2. Add subpath export `"./vite": "./dist/vite.mjs"` to `package.json`.

3. **Write consumer-facing docs** — add a section to the root README or [docs/](docs/) covering each consumer path. **Use `presets: asPresetVunor(...)` everywhere — never `presets: [asPresetVunor(...)]`** (Decision 14):

   ```ts
   // uno.config.ts — UnoCSS path (recommended for theming)
   import { defineConfig } from "unocss";
   import { asPresetVunor } from "@atscript/ui-styles";

   export default defineConfig({
     presets: asPresetVunor({
       // Theme customization (Decision 5):
       baseRadius: "6px",
       palette: { primary: "#7c3aed" },
       // Power-user opt-out (Decision 15):
       excludeComponents: ["as-filter-dialog", "as-config-dialog"],
     }),
   });
   ```

   **Important footgun to highlight in the README** — partial customization of helper output:

   ```ts
   // Common pattern: customize ONE default, keep the rest
   const types = {
     ...createDefaultTableComponents(),
     filterDialog: MyFilterDialog, // override just this
   };
   ```

   The `createDefaultTableComponents(` literal still appears in the source, so the extractor pulls in classes for ALL its default components — including the `as-filter-dialog` you just overrode. The override happens at runtime; the extractor sees source code only. To actually drop those styles from the bundle, the consumer must add `excludeComponents: ["as-filter-dialog"]` to their `asPresetVunor` config. The README should call this out with this exact code shape, because it's the most likely real-world customization pattern and the most counterintuitive interaction.

   ```ts
   // app entry — pre-built CSS path (no theming, no opt-out)
   import "@atscript/ui-styles/css/all";
   // or per-package:
   // import "@atscript/ui-styles/css/form";
   // import "@atscript/ui-styles/css/table";
   // import "@atscript/ui-styles/css/wf";
   ```

   ```ts
   // vite.config.ts — auto-import resolver
   import Components from "unplugin-vue-components/vite";
   import { AsResolver } from "@atscript/ui-styles/vite";

   export default {
     plugins: [Components({ resolvers: [AsResolver()] })],
   };
   ```

   Cover:
   - Install: `pnpm add @atscript/vue-form @atscript/vue-table @atscript/vue-wf @atscript/ui-styles unocss`.
   - The three consumer paths (UnoCSS, pre-built CSS, resolver).
   - Theme customization via `asPresetVunor({...})`.
   - Power-user opt-out via `excludeComponents` (Decision 15) — note that pre-built CSS does not honor this.
   - Manual safelist via `getComponentClasses(...)` for advanced cases.

**Success criteria:**

- A fresh sample app outside the monorepo can install the published packages, configure UnoCSS with the preset, and render forms, tables, and the workflow form without filesystem-scan tricks.
- The README example for `excludeComponents` produces a CSS bundle that is measurably smaller than the unfiltered version.

**Risks / scope clarifications:**

- **`AsResolver` is tag-only.** It only resolves identifiers used as Vue tags (e.g. `<AsTable />`). Composables like `useTable`, `useFormState` — which are the dominant usage pattern (see [packages/vue-table/src/index.ts:7-23](packages/vue-table/src/index.ts#L7-L23)) — are NOT resolved by this plugin and must be imported explicitly. That's correct behavior (composables don't carry classes), but worth a unit test that confirms `useTable` doesn't trigger spurious resolutions and the extractor's barrel-import regex (Pattern 2) drops non-`As*` identifiers cleanly.
- The resolver dispatch table is generated from `componentPackages` (Phase 3 output). When new components are added, the generated map updates automatically — no resolver edits needed.

---

## Quick reference: command cheatsheet

```bash
# Per-package work (run from repo root)
pnpm --filter @atscript/ui-styles run build
pnpm --filter @atscript/vue-form run build
pnpm --filter @atscript/vue-table run build
pnpm --filter @atscript/vue-wf run build

# Full check
pnpm ready

# Class extraction (Phase 3 onward)
pnpm --filter @atscript/ui-styles run extract-classes

# CSS build (Phase 5 onward)
pnpm --filter @atscript/ui-styles run build-css

# Manual playground sanity check
pnpm dev
```

## Quick reference: file map

| Concern                                                                       | Location                                                                                                                                                                            |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base UnoCSS config (no extractor) — used by scripts                           | `packages/ui-styles/src/preset.ts` (`createAsBaseUnoConfig`)                                                                                                                        |
| Consumer-facing preset (with extractor)                                       | `packages/ui-styles/src/preset.ts` (`asPresetVunor`)                                                                                                                                |
| Component extractor                                                           | `packages/ui-styles/src/preset.ts` (`createAsExtractor`)                                                                                                                            |
| Shortcuts (form)                                                              | `packages/ui-styles/src/shortcuts/form/*.ts`                                                                                                                                        |
| Shortcuts (table)                                                             | `packages/ui-styles/src/shortcuts/table/*.ts`                                                                                                                                       |
| Shortcuts (wf)                                                                | `packages/ui-styles/src/shortcuts/wf/*.ts`                                                                                                                                          |
| Shortcuts (common)                                                            | `packages/ui-styles/src/shortcuts/common/*.ts`                                                                                                                                      |
| Generated safelist (`componentClasses`, `helperAliases`, `componentPackages`) | `packages/ui-styles/src/generated/component-classes.ts` (committed)                                                                                                                 |
| Class extraction script                                                       | `packages/ui-styles/scripts/extract-component-classes.ts`                                                                                                                           |
| CSS build script                                                              | `packages/ui-styles/scripts/build-css.ts`                                                                                                                                           |
| Pre-built CSS output                                                          | `packages/ui-styles/dist/css/{all,form,table,wf}.css`                                                                                                                               |
| Per-component entries (form, public)                                          | `packages/vue-form/dist/{as-form,as-field,as-input,...}.mjs`                                                                                                                        |
| Per-component entries (table, public)                                         | `packages/vue-table/dist/{as-table,as-table-root,as-filter-dialog,...}.mjs`                                                                                                         |
| Per-component entries (wf, public)                                            | `packages/vue-wf/dist/as-wf-form.mjs`                                                                                                                                               |
| Form components (root, public)                                                | `packages/vue-form/src/components/*.vue`                                                                                                                                            |
| Form components (defaults, public)                                            | `packages/vue-form/src/components/defaults/*.vue`                                                                                                                                   |
| Form components (internal, NOT public)                                        | `packages/vue-form/src/components/internal/*.vue`                                                                                                                                   |
| Table components (root, public)                                               | `packages/vue-table/src/components/*.vue` (all 6 — `as-table*.vue` files)                                                                                                           |
| Table components (defaults, public)                                           | `packages/vue-table/src/components/defaults/*.vue`                                                                                                                                  |
| Wf components (root, public)                                                  | `packages/vue-wf/src/components/*.vue` (post-Phase-1 — currently just `as-wf-form.vue`)                                                                                             |
| Helper functions (canonical location, Decision 17)                            | `packages/vue-form/src/composables/create-default-types.ts`, `packages/vue-table/src/composables/create-default-table-components.ts` (post-Phase-1, moved from `defaults/index.ts`) |
| Defaults barrel (pure re-export, no logic)                                    | `packages/<pkg>/src/components/defaults/index.ts`                                                                                                                                   |
| Resolver for auto-import                                                      | `packages/ui-styles/src/vite.ts`                                                                                                                                                    |
| Demo app UnoCSS config                                                        | `packages/demo/uno.config.ts`                                                                                                                                                       |
| Playground UnoCSS config                                                      | `packages/vue-playground/uno.config.ts`                                                                                                                                             |
| Per-package UnoCSS configs (delete or repoint in Phase 1)                     | `packages/vue-form/uno.config.ts`, `packages/vue-table/uno.config.ts`                                                                                                               |
