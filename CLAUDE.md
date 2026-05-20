# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

atscript-ui is a monorepo for generating automated forms and smart tables driven by atscript type metadata. Framework-agnostic logic lives in `ui` and `ui-table`; Vue 3 implementations live in `vue-form` and `vue-table`.

## Commands

```bash
# Development
pnpm dev                    # Alias for demo:dev (run vue-demo on :3200)
pnpm demo:dev               # Run vue-demo dev server on :3200 (full app, server + client)
pnpm docs:dev               # Run docs dev server (VitePress)

# Testing
pnpm test                   # Run all unit tests across workspace (vitest via vite-plus)
pnpm --filter @atscript/vue-form run test   # Run tests for a single package
vp test src/__tests__/use-form.spec.ts      # Run a single test file (from package dir)
pnpm test:e2e               # Run Playwright e2e suites (tests/e2e/)
pnpm test:e2e:install       # Install the chromium browser used by e2e

# Building
pnpm build                  # Build all packages (vp run build -r)
pnpm --filter @atscript/vue-form run build  # Rebuild a single package

# Linting & formatting
vp fmt                      # Format (Biome via vite-plus)
vp lint                     # Lint (Biome via vite-plus, type-aware)
vp check --fix              # Auto-fix lint+format issues

# Full CI check
pnpm ready                  # fmt → lint → test → build → e2e

# Release
pnpm release                # Patch bump all packages, commit, tag
pnpm release:minor          # Minor bump
pnpm release:major          # Major bump
```

## Architecture

### Package dependency graph

```
@atscript/ui                ← framework-agnostic core: FormDef, TableDef, annotation keys, field resolver, validators
  ├─ @atscript/ui-fns       ← opt-in plugin: ui.fn.* dynamic computed props (uses new Function)
  ├─ @atscript/ui-table     ← framework-agnostic: filter model, filter→Uniquery conversion, presets
  ├─ @atscript/ui-styles    ← shared UnoCSS shortcuts + presets + icon loader (consumed by every vue-* pkg)
  ├─ @atscript/vue-form     ← Vue 3 form components + composables
  ├─ @atscript/vue-table    ← Vue 3 table components + composables (depends on ui-table)
  ├─ @atscript/vue-wf       ← Vue 3 workflow form: HTTP round-trip loop driven by atscript metadata
  ├─ @atscript/moost-wf     ← Moost server-side workflow integration (decorators, interceptors, serialization)
  └─ @atscript/moost-ui-presets ← Moost controller + atscript schema for table-preset persistence
```

One private dev app lives in the workspace:

- `@atscript/vue-demo` — full server+client app on **:3200** with feature pages (forms-demo, table-demo, workflows). This is the consumer app the user typically opens to verify behaviour. Run with `pnpm demo:dev`.

**Important:** dev apps import library packages from their built `dist/` files (via `package.json` `main`/`exports`), not from source. After changing code in any library package, rebuild that package AND restart the consumer dev server — HMR alone won't pick up `dist/` changes or cached UnoCSS presets:

```bash
pnpm --filter @atscript/vue-wf run build   # rebuild a single package
pnpm build                                  # rebuild all packages
```

### Key design principles

- **ui and ui-table have zero framework dependencies** — pure TypeScript. Before adding a utility to a Vue package, check if it belongs in ui/ui-table so React can reuse it.
- **Annotation-driven** — all UI configuration flows from `@ui.*`, `@meta.*`, and `@expect.*` atscript annotations. ui reads static values; ui-fns adds dynamic `@ui.fn.*` support via a pluggable `FieldResolver`.
- **Types map pattern** — both vue-form and vue-table accept a `components`/`types` map that maps field/cell types to Vue components. Default unstyled HTML implementations are provided; users override with their design system (e.g., vunor).
- **Single-context provide/inject** — each renderless (or rendered) component provides its context as a single object under one provide key. Child composables inject the full context and destructure only what they need. Never use multiple provide keys for the same component's state.
- **Performance and caching are priority** — cache expensive computations (e.g., parsed metadata, TableDef) globally by key. Avoid redundant network requests; share cached results across component remounts.
- **Minimize reactivity overhead** — avoid unnecessary `computed`/`ref`/`reactive`. Only make values reactive when the template or a watcher actually depends on them. Plain variables and closures are preferred over reactive wrappers when reactivity is not needed. Default to `ref` for arrays/objects. Only reach for `shallowRef` when the data is large, perf-sensitive, AND every writer already replaces the value wholesale — if you find yourself adding workarounds to trigger updates, `shallowRef` was the wrong choice.
- **Form data is wrapped** — form data container is `{ value: domainData }`. Path utilities (`getByPath`, `setByPath`) handle unwrapping.
- **Model-driven state, no explicit triggers** — table/form state is the contract. Call sites (dialogs, toolbars, external v-model, devtools, programmatic callers) only mutate the model arrays (`filterFields`, `filters`, `columnNames`, `sorters`, `searchTerm`, `pagination`). Reactions — re-query, pagination reset, `mustRefresh` flag — live in watchers at the root (e.g. `use-table-query.ts`), never inside mutators. Any writer triggers identical behaviour because the watcher is the single reaction point.
  - **Mutators are pure** — each touches exactly one entity. Display state and applied state are independent: `filterFields` (which filter inputs are shown) and `filters` (applied conditions) never mutate each other. Hiding an input does not clear its value; clearing a value does not hide its input. Apply the same rule to any future display/applied pair on columns or sorters.
  - **Never run cleanup loops in dialogs** — if applying a dialog feels like it needs a `for (field of removed) state.removeFieldFilter(field)` loop to "synchronize," that's the root-watcher's job, not the dialog's. The dialog just writes the new model array. Move the reaction to the watcher.
  - **Never call `state.query()` to apply a change** — it's reserved for user-initiated refresh (toolbar refresh button, pull-to-refresh). All "I changed some state, please re-fetch" flows go through watchers.

### Scope and reuse

- **DRY-first.** When the same shape repeats 3+ times, extract a reusable piece. Refactors that consolidate duplication and reduce LOC are welcome — even on tasks scoped to a small fix.
- **Reuse over invent.** Before introducing a new shortcut, component, or composable, scan for existing primitives that can fit with minor enhancements. Extend the existing one when possible.
- **Extension naming:** `as-<case>-<concept>` extends `as-<concept>` (e.g. `as-form-description` extends `as-description`). Lets consumers restyle every variant by overriding one shortcut.
- Don't refactor for vanity (cosmetic renames, splitting tiny helpers nobody else calls) and don't sweep the repo as a side-quest unless asked.

### Tooling

- **Package manager:** pnpm 10 with workspace catalogs (shared dependency versions in `pnpm-workspace.yaml`)
- **Build:** vite-plus (`vp pack`) — Vite-based bundler, outputs ESM + CJS with `.d.ts`
- **Test:** Vitest via vite-plus (`vp test`), `happy-dom` environment for Vue packages
- **Lint/format:** Biome via vite-plus — configured in root `vite.config.ts`
- **Staged files hook:** `vp check --fix` runs on all staged files
- **E2E:** Playwright (`tests/e2e/`) — config at `tests/e2e/playwright.config.ts`, suites grouped by feature (a-cells, b-filtering, …)
- **Skills distribution:** `skills-lock.json` + `scripts/setup-skills.js` pull external skills (atscript, atscript-db, moostjs, vunor, wooksjs) into `.claude/skills/` — do not hand-edit those vendored copies; edit at the upstream source listed in `skills-lock.json`

### Conventions

- Vue components use the `as-` prefix (e.g., `as-form`, `as-field`, `as-table`)
- Components use `<script setup lang="ts">` with generics where needed
- Test files: `*.spec.ts`, co-located in `src/` or under `src/__tests__/`
- Test helpers (mock factories) live in `__tests__/helpers.ts`

### Styling with vunor

**Vunor is the customization middleware.** atscript-ui ships as a generic UI layer — vunor (published as the `vunor` npm package) is what makes it skinnable. End users override vunor's theme (palette, spacing, typography, fingertip, radius) and replace icon aliases to ship their own branding without ever touching our library's source or overriding individual classes.

For this to work, we style **only through vunor primitives**. Every pixel literal, hand-rolled focus ring, or hardcoded color we leave in the code is a knob the consumer can't turn.

**Shortcuts, not inline utilities.** Templates only use `as-*` class names. Raw UnoCSS utilities (`flex gap-$s px-$m ...`) belong in the `defineShortcuts({...})` map in `packages/ui-styles/src/shortcuts/{form,table,wf,common}/<as-name>.ts`, never in `.vue` templates. If a new composition is needed, add a new `as-*` shortcut entry in the matching component file (or add a new file under the right subdir and wire it through the barrel).

**Use vunor tokens, not pixel literals.**

| Intent                                      | Use                                                                 | Not                                                    |
| ------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------ |
| Gap / padding / margin                      | spacing tokens `$xxs..$xxl`                                         | `gap-[8px]`, `px-[12px]`                               |
| Control heights / touch targets             | `h-fingertip-xs/s/m/l/xl`                                           | `h-[32px]`                                             |
| Body / secondary / title text               | `text-body`, `text-callout`, `text-body-l`                          | `text-[length:13px]`                                   |
| Icon-glyph sizing                           | em-based `text-[1.25em]`, `w-[1em] h-[1em]`                         | `w-[16px] h-[16px]`                                    |
| Elevated surfaces (popups, dialogs, toasts) | `shadow-popup`                                                      | hand-rolled box-shadow                                 |
| Borders (default)                           | `border-1` alone — color comes from active surface/layer            | `border-grey-200 dark:border-grey-800`                 |
| Focus rings                                 | `current-outline-hl outline i8-apply-outline`                       | `[box-shadow:0_0_0_3px_...]`                           |
| Button / clickable surfaces                 | `c8-filled / c8-flat / c8-outlined / c8-light / c8-chrome`          | hand-rolled hover/active                               |
| Inputs (bordered)                           | `border-1 layer-0 current-outline-hl` + `i8-apply-outline` on focus | `i8-input i8-apply-border` (leaks scope color as fill) |

**Explicit text color on inputs** — inside a `layer-0` wrapper, `--current-text` resolves to `scope-dark-2` (muted). Use `text-scope-dark-0 dark:text-scope-light-0` on `<input>` so user input reads as primary text, not placeholder.

**Fonts live in the consumer, not the preset.** The `@atscript/ui-styles` package ships scope/layer/surface/c8/i8 + icons + the `as-*` shortcut tree. Typography baseline (Inter family, 13px body, smoothing) lives in `packages/vue-demo/src/styles/app.css`. Real consumers bring their own font stack.

**Reka-ui state attributes** — menu items, listbox rows, and combobox items expose keyboard state as `data-highlighted=""`, selection as `data-state="checked"`. Style them via descendant attribute selectors in the `as-*` shortcut. Nested `[]` inside an arbitrary-variant bracket (`[&_tr[data-state=checked]]:`) silently fails to compile — wrap the inner attribute selector in `:is(...)`:

```ts
"[&_tbody_tr:is([data-highlighted=''])]:": "scope-primary bg-current-hl/10",
"[&_tbody_tr:is([data-state=checked])]:": "scope-primary bg-current-hl/15",
```

**Composing Reka-ui primitives with vunor.** Prefer `as-child` on Root/Anchor/Trigger/Input wrappers with a plain HTML child — events and props merge onto the real element. Skip `ComboboxTrigger` when the input itself drives opening (`@focus="open = true"`); leaving it in toggles open/closed on the bubbled click and closes the dropdown immediately after focus opens it.

**Checklist before hand-rolling a rule:**

1. Is there a vunor primitive? (`scope-*`, `layer-*`, `surface-*`, `c8-*`, `i8-*`, spacing `$*`, typography, `fingertip-*`)
2. If painting over an existing shortcut, add to the variant map (`hover:`, `focus-within:`, `[&_child]:`) — don't copy the whole shortcut.
3. If introducing a new piece of UI, add a new `as-*` shortcut entry rather than inlining classes in the template.
4. Build-verify: `pnpm --filter @atscript/ui-styles run build` and re-run the demo dev server. Confirm the generated selector appears in the consumer app's UnoCSS output — UnoCSS silently drops malformed arbitrary variants.

### Component organization (vue-\* packages)

Every `@atscript/vue-*` package follows a three-tier canonical layout
where the **directory dictates the public surface**. The class-extractor
and pre-built CSS pipelines depend on it — deviation silently breaks
consumer styling.

| Subdir                          | Tier                            | Subpath | Barrel | Auto-resolver |
| ------------------------------- | ------------------------------- | ------- | ------ | ------------- |
| `src/components/*.vue`          | **1 — Primary** (user-tagged)   | ✓       | ✓      | ✓             |
| `src/components/defaults/*.vue` | **2 — Defaults** (swap targets) | ✓       | ✓      | ✗             |
| `src/components/internal/*.vue` | **3 — Internals**               | ✗       | ✗      | ✗             |

- **Tier 1 — Primary:** components users tag in templates
  (`<AsForm>`, `<AsTable>`, `<AsTableRoot>`, `<AsFilters>`, `<AsField>`,
  `<AsIterator>`, `<AsWfForm>`). Importable AND auto-resolved by
  `unplugin-vue-components` via `AsResolver()`.
- **Tier 2 — Defaults:** out-of-the-box swap targets users compose via
  `:types` / `:components` prop maps and may also import explicitly
  (`AsInput`, `AsSelect`, `AsFilterDialog`, `AsConfigDialog`, …). Public
  and importable, but NOT auto-resolved — users compose them via
  explicit imports. Re-exported from `src/components/defaults/index.ts`
  (a pure re-export barrel: no logic, no helper functions).
- **Tier 3 — Internals:** composition helpers nobody outside the package
  should reference (`AsTableBase`, `AsTableVirtualizer`,
  `AsOrderableList`, `AsFilterConditions`, `AsFilterValueHelp`,
  `AsFieldsSelector`, `AsSortersConfig`, `AsFieldShell`, `AsNoData`, …).
  Not exported from `src/index.ts`, no subpath in `package.json`
  exports, no resolver entry. Their classes still reach the safelist
  via the dependency walk from public entries.
- **Helper functions** wiring up default components live at
  `src/composables/create-*.ts`. They import their components via a
  single `import { AsX, AsY, ... } from "../components/defaults"` line.
  They MUST NOT import individual `.vue` files. If a Tier-2 component
  physically lives outside `defaults/`, re-export it from the defaults
  barrel so the single-import rule still holds.
- Naming: `As<Name>` PascalCase identifier ↔ `as-<name>.vue` filename ↔
  `as-<name>-*` class names.

**Picking a tier when adding a new component:** does a user write it as
a tag in their template? → Tier 1 (root). Is it a default that users
swap via a prop map? → Tier 2 (`defaults/`). Otherwise → Tier 3
(`internal/`).

Background: see STYLES.md Decision 17.

### Commit style

One-line commit messages, no co-author trailers.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, but it invokes Vite through `vp dev` and `vp build`.

## Vite+ Workflow

`vp` is a global binary that handles the full development lifecycle. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

### Start

- create - Create a new project from a template
- migrate - Migrate an existing project to Vite+
- config - Configure hooks and agent integration
- staged - Run linters on staged files
- install (`i`) - Install dependencies
- env - Manage Node.js versions

### Develop

- dev - Run the development server
- check - Run format, lint, and TypeScript type checks
- lint - Lint code
- fmt - Format code
- test - Run tests

### Execute

- run - Run monorepo tasks
- exec - Execute a command from local `node_modules/.bin`
- dlx - Execute a package binary without installing it as a dependency
- cache - Manage the task cache

### Build

- build - Build for production
- pack - Build libraries
- preview - Preview production build

### Manage Dependencies

Vite+ automatically detects and wraps the underlying package manager such as pnpm, npm, or Yarn through the `packageManager` field in `package.json` or package manager-specific lockfiles.

- add - Add packages to dependencies
- remove (`rm`, `un`, `uninstall`) - Remove packages from dependencies
- update (`up`) - Update packages to latest versions
- dedupe - Deduplicate dependencies
- outdated - Check for outdated packages
- list (`ls`) - List installed packages
- why (`explain`) - Show why a package is installed
- info (`view`, `show`) - View package information from the registry
- link (`ln`) / unlink - Manage local package links
- pm - Forward a command to the package manager

### Maintain

- upgrade - Update `vp` itself to the latest version

These commands map to their corresponding tools. For example, `vp dev --port 3000` runs Vite's dev server and works the same as Vite. `vp test` runs JavaScript tests through the bundled Vitest. The version of all tools can be checked using `vp --version`. This is useful when researching documentation, features, and bugs.

## Common Pitfalls

- **Using the package manager directly:** Do not use pnpm, npm, or Yarn directly. Vite+ can handle all package manager operations.
- **Always use Vite commands to run tools:** Don't attempt to run `vp vitest` or `vp oxlint`. They do not exist. Use `vp test` and `vp lint` instead.
- **Running scripts:** Vite+ built-in commands (`vp dev`, `vp build`, `vp test`, etc.) always run the Vite+ built-in tool, not any `package.json` script of the same name. To run a custom script that shares a name with a built-in command, use `vp run <script>`. For example, if you have a custom `dev` script that runs multiple services concurrently, run it with `vp run dev`, not `vp dev` (which always starts Vite's dev server).
- **Do not install Vitest, Oxlint, Oxfmt, or tsdown directly:** Vite+ wraps these tools. They must not be installed directly. You cannot upgrade these tools by installing their latest versions. Always use Vite+ commands.
- **Use Vite+ wrappers for one-off binaries:** Use `vp dlx` instead of package-manager-specific `dlx`/`npx` commands.
- **Import JavaScript modules from `vite-plus`:** Instead of importing from `vite` or `vitest`, all modules should be imported from the project's `vite-plus` dependency. For example, `import { defineConfig } from 'vite-plus';` or `import { expect, test, vi } from 'vite-plus/test';`. You must not install `vitest` to import test utilities.
- **Type-Aware Linting:** There is no need to install `oxlint-tsgolint`, `vp lint --type-aware` works out of the box.

## CI Integration

For GitHub Actions, consider using [`voidzero-dev/setup-vp`](https://github.com/voidzero-dev/setup-vp) to replace separate `actions/setup-node`, package-manager setup, cache, and install steps with a single action.

```yaml
- uses: voidzero-dev/setup-vp@v1
  with:
    cache: true
- run: vp check
- run: vp test
```

## Review Checklist for Agents

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to validate changes.
<!--VITE PLUS END-->
