# @atscript/ui-styles

Shared UnoCSS preset, shortcuts, icon loader, per-component class safelist, and pre-built CSS for [`@atscript/vue-form`](../vue-form), [`@atscript/vue-table`](../vue-table), and [`@atscript/vue-wf`](../vue-wf).

> **This README is contributor-oriented.** It covers what the package ships, why each piece exists, and the load-bearing decisions that shape the code. End-user installation and usage docs live at [`/docs/guide/styling.md`](../../docs/guide/styling.md).

## What this package ships

- **`asPresetVunor(opts)`** — the consumer-facing UnoCSS preset. Returns `Preset[]` with vunor's preset, an icons preset, shortcuts merged across `form` / `table` / `wf` / `common`, and a custom **Extractor** that pulls per-component class lists into the consumer's CSS bundle without any `node_modules` filesystem scan.
- **`createAsBaseUnoConfig(opts)`** — same presets + shortcuts as `asPresetVunor` but **without** the extractor. Internal scripts only (see Decision 13).
- **`allShortcuts`** + per-area exports (`formShortcuts`, `tableShortcuts`, `wfShortcuts`, `commonShortcuts`) — direct access to the shortcut maps.
- **`asIconsPreset(opts)`** + **`createIconsLoader(opts)`** — local-SVG icons collection with the `as` prefix.
- **Generated safelist** at [`src/generated/component-classes.ts`](src/generated/component-classes.ts) — committed (Decision 12). Re-export public API: `componentClasses`, `helperAliases`, `componentPackages`, `getComponentClasses(...)`, `getHelperClasses(...)`.
- **Pre-built CSS** at `dist/css/{all,form,table,wf}.css` — for non-UnoCSS consumers (Decision 5). Default theme only; cannot be themed or filtered.
- **`AsResolver()`** at the `@atscript/ui-styles/vite` subpath — `unplugin-vue-components` resolver that maps `As*` PascalCase tags to the matching per-component subpath (`@atscript/vue-{form,table,wf}/<as-name>`). Tag-only — composables must be imported explicitly. Driven by `componentPackages` from the generated module, so new components are picked up automatically.

## Why this package exists

UnoCSS only generates CSS for class names it sees in the consumer's source tree. When `@atscript/vue-form` etc. are installed from npm, their classes live inside `node_modules` and UnoCSS won't scan there. This package solves that with a custom **Extractor** that scans the consumer's own source for component imports / tags / helper calls and pulls in pre-computed class lists per component.

## Load-bearing decisions

The full design rationale lives in [`STYLES.md`](../../STYLES.md). Quick contributor cheat-sheet:

### Decision 6 — Custom UnoCSS Extractor with five match patterns

`createAsExtractor` ([`src/extractor.ts`](src/extractor.ts)) recognizes:

1. Subpath imports — `from '@atscript/vue-form/as-form'`
2. Barrel named imports — `import { AsForm, AsField } from '@atscript/vue-form'`
3. PascalCase tags — `<AsForm`, `<AsTableRoot` (the dominant pattern in real consumer code)
4. Kebab-case tags — `<as-form`
5. Helper-function calls — `createDefaultTypes(`, `createDefaultTableComponents(`

The unknown-name guard is `componentClasses[kebab]` — anything not in the dict is a no-op. PascalCase / kebab equivalence is handled by [`src/kebab.ts`](src/kebab.ts).

### Decision 11 — Helper-call detection (mandatory for default components)

`createDefaultTypes()` and `createDefaultTableComponents()` ship default field/cell components consumers never tag directly. A tag-only extractor would silently drop their classes. The extraction script (`scripts/extract-component-classes.ts`) walks each helper file, parses the single import from `../components/defaults`, kebab-cases the named identifiers, and emits `helperAliases`. The extractor unions a helper's class set into the result whenever it sees the helper name as a function call (member calls like `obj.createDefaultTypes()` are excluded by a leading `(?:^|[^.\w])` guard).

When new helpers are added, they must conform to **Decision 17**'s layout (`src/composables/create-*.ts`, single import from `../components/defaults`) or the parser will hard-fail on regenerate.

### Decision 13 — `createAsBaseUnoConfig` / `asPresetVunor` cycle break

The extractor inside `asPresetVunor()` imports `componentClasses`. The extraction script needs to run UnoCSS with the same shortcuts/presets to compute `componentClasses`. If the script imported `asPresetVunor()`, you'd have a chicken-and-egg.

Two factories:

- **`createAsBaseUnoConfig({})`** — presets + shortcuts, no extractor. Used by `scripts/extract-component-classes.ts` and `scripts/build-css.ts`.
- **`asPresetVunor(opts)`** — same base + the extractor that imports `componentClasses`. Used by consumers.

Don't collapse these. Don't make the build scripts depend on the extractor.

### Decision 15 — `excludeComponents` is post-match, consumer-side, UnoCSS-only

`asPresetVunor({ excludeComponents: ["as-filter-dialog"] })` lets a power user drop classes for default components they've replaced with their own. The exclusion is applied **after** the regex matches — matched-but-excluded components silently don't add classes. This is documented; replacing with `<AsFilterDialog>` after excluding it gives an unstyled component and is the user's explicit choice.

**Pre-built CSS does not honor `excludeComponents`.** The CSS files in `dist/css/` are generated once at our build time with the full safelist for each package. The option is a runtime extractor knob; it has no place in a pre-baked artifact. Users who need to drop default components must use the UnoCSS path.

### `AsResolver` — `componentPackages` is the single source of truth

The resolver in [`src/vite.ts`](src/vite.ts) does **not** maintain its own dispatch table. It looks up every `As*` tag in `componentPackages` and forms `${PKG_TO_NPM[pkg]}/${kebab}`. When a new public component lands in any vue-\* package, the extraction script picks it up, `componentPackages` regenerates, and the resolver routes to it on the next build — no resolver edits needed.

`unplugin-vue-components` is wired as an **optional** peerDependency. Consumers who don't auto-import (use explicit `import { AsForm } from "@atscript/vue-form"` everywhere) don't need to install it; consumers who do auto-import already have it.

### Decision 17 — Canonical component layout in vue-\* packages

Every `@atscript/vue-*` package follows one layout:

- **Public root** components at `src/components/*.vue`.
- **Public defaults** at `src/components/defaults/*.vue`, re-exported through `src/components/defaults/index.ts` (a pure re-export barrel — no logic, no helper functions).
- **Private internals** at `src/components/internal/*.vue` — not exported, no subpath, but classes still reach the safelist via the dependency walk.
- **Helpers** at `src/composables/create-*.ts`, importing components only via `import { AsX, ... } from "../components/defaults"`. The helper-alias parser in `scripts/extract-component-classes.ts` depends on this exact shape — a non-conforming helper file fails the build.

Any new component or helper must conform; otherwise tooling silently drops or hard-fails it.

## Pre-built CSS — the trade-off (Decision 5)

For consumers who don't run UnoCSS, this package ships four pre-built CSS files in `dist/css/`:

| File        | Contents                                    |
| ----------- | ------------------------------------------- |
| `all.css`   | Every component across form + table + wf.   |
| `form.css`  | Components from `@atscript/vue-form` only.  |
| `table.css` | Components from `@atscript/vue-table` only. |
| `wf.css`    | Components from `@atscript/vue-wf` only.    |

Caveats:

- **No theming.** Built once at our publish time with the default `asPresetVunor()` palette. Consumers who want a custom theme must use the UnoCSS path.
- **No `excludeComponents`.** See Decision 15 above.
- **Per-package files overlap.** Each is independently complete — `as-spacer` lands in every per-package file that uses it. **Don't combine** `form.css` + `table.css` + `wf.css`; load `all.css` instead.

The `wf.css` file is small today (vue-wf has one component) but exists for symmetry — vue-wf will grow and consumers can already load just what they need.

## Generated artifacts

- [`src/generated/component-classes.ts`](src/generated/component-classes.ts) — committed to git (Decision 12). Three maps + two helper functions. Regenerate with `pnpm extract-classes`. CI must run the script and fail on drift; PRs that change `.vue` templates without regenerating will be flagged.
- `dist/css/{all,form,table,wf}.css` — gitignored build artifacts, shipped via the published tarball through `files: ["dist"]`. Built by `pnpm build-css`.

## Build pipeline

```bash
pnpm --filter @atscript/ui-styles run build
# expands to:
pnpm extract-classes && vp pack && pnpm build-css
```

- `extract-classes` (`scripts/extract-component-classes.ts`) — walks vue-form/table/wf source files, runs UnoCSS, emits `src/generated/component-classes.ts`. Reads source on disk; **does not** consume their `dist/`. A clean checkout can run this even before vue-\* packages are built (Decision 8).
- `vp pack` — bundles two TS entry points: `src/index.ts` (the main surface) and `src/vite.ts` (the `AsResolver`). Output: `dist/{index,vite}.{mjs,cjs,d.mts,d.cts}`.
- `build-css` (`scripts/build-css.ts`) — uses `createAsBaseUnoConfig()` (Decision 13) plus `componentClasses` + `componentPackages` from the generated module to emit the four CSS files. Output is byte-deterministic across runs.

## Iterating on shortcuts

After Phase 6, the playground and demo configs no longer source-scan `vue-{form,table,wf}/src/**`. Editing a shortcut and seeing it reflected in the playground requires `@atscript/ui-styles` to be in watch mode:

```bash
# terminal 1
pnpm --filter @atscript/ui-styles run dev   # vp pack --watch

# terminal 2
pnpm dev
```

This trades dev ergonomics for a clean, prod-like setup that matches what end users get.
