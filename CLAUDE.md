# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

atscript-ui is a monorepo for generating automated forms and smart tables driven by atscript type metadata. Framework-agnostic logic lives in `ui` and `ui-table`; Vue 3 implementations live in `vue-form` and `vue-table`.

## Commands

```bash
# Development
pnpm dev                    # Run vue-playground dev server
pnpm docs:dev               # Run docs dev server (VitePress)

# Testing
pnpm test                   # Run all tests across workspace (vitest via vite-plus)
pnpm --filter @atscript/vue-form run test   # Run tests for a single package
npx vitest run src/__tests__/use-form.spec.ts  # Run a single test file (from package dir)

# Building
pnpm build                  # Build all packages (vp run build -r)

# Linting & formatting
vp fmt                      # Format (Biome via vite-plus)
vp lint                     # Lint (Biome via vite-plus, type-aware)
vp check --fix              # Auto-fix lint+format issues

# Full CI check
pnpm ready                  # fmt → lint → test → build

# Release
pnpm release                # Patch bump all packages, commit, tag
pnpm release:minor          # Minor bump
pnpm release:major          # Major bump
```

## Architecture

### Package dependency graph

```
@atscript/ui          ← framework-agnostic: FormDef, TableDef, annotation keys, field resolver, validators
  ├─ @atscript/ui-fns      ← opt-in plugin: ui.fn.* dynamic computed props (uses new Function)
  ├─ @atscript/ui-table    ← framework-agnostic: filter model, filter→Uniquery conversion, presets
  ├─ @atscript/vue-form    ← Vue 3 form components + composables
  └─ @atscript/vue-table   ← Vue 3 table components + composables (depends on ui-table)
```

`vue-playground` is a private dev app that imports vue-form, vue-table, and vue-wf for manual testing.

**Important:** vue-playground imports library packages from their built `dist/` files (via `package.json` `main`/`exports`), not from source. After changing code in any library package (vue-form, vue-wf, ui, etc.), you must rebuild before the playground picks up the changes:

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
- **Minimize reactivity overhead** — avoid unnecessary `computed`/`ref`/`reactive`. Use `shallowRef` for arrays/objects replaced wholesale. Only make values reactive when the template or a watcher actually depends on them. Plain variables and closures are preferred over reactive wrappers when reactivity is not needed.
- **Form data is wrapped** — form data container is `{ value: domainData }`. Path utilities (`getByPath`, `setByPath`) handle unwrapping.

### Tooling

- **Package manager:** pnpm 10 with workspace catalogs (shared dependency versions in `pnpm-workspace.yaml`)
- **Build:** vite-plus (`vp pack`) — Vite-based bundler, outputs ESM + CJS with `.d.ts`
- **Test:** Vitest via vite-plus (`vp test`), `happy-dom` environment for Vue packages
- **Lint/format:** Biome via vite-plus — configured in root `vite.config.ts`
- **Staged files hook:** `vp check --fix` runs on all staged files

### Conventions

- Vue components use the `as-` prefix (e.g., `as-form`, `as-field`, `as-table`)
- Components use `<script setup lang="ts">` with generics where needed
- Test files: `*.spec.ts`, co-located in `src/` or under `src/__tests__/`
- Test helpers (mock factories) live in `__tests__/helpers.ts`

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
- **Running scripts:** Vite+ commands take precedence over `package.json` scripts. If there is a `test` script defined in `scripts` that conflicts with the built-in `vp test` command, run it using `vp run test`.
- **Do not install Vitest, Oxlint, Oxfmt, or tsdown directly:** Vite+ wraps these tools. They must not be installed directly. You cannot upgrade these tools by installing their latest versions. Always use Vite+ commands.
- **Use Vite+ wrappers for one-off binaries:** Use `vp dlx` instead of package-manager-specific `dlx`/`npx` commands.
- **Import JavaScript modules from `vite-plus`:** Instead of importing from `vite` or `vitest`, all modules should be imported from the project's `vite-plus` dependency. For example, `import { defineConfig } from 'vite-plus';` or `import { expect, test, vi } from 'vite-plus/test';`. You must not install `vitest` to import test utilities.
- **Type-Aware Linting:** There is no need to install `oxlint-tsgolint`, `vp lint --type-aware` works out of the box.

## Review Checklist for Agents

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to validate changes.
<!--VITE PLUS END-->
