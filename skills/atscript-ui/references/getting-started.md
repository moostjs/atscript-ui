Cross-cutting install + config for atscript-ui. Domain-specific topics (forms, tables, workflows, styling) live in the sibling skills — see [Reading list](#reading-list).

## Contents

- [Install matrix](#install-matrix)
- [atscript.config.ts](#atscriptconfigts)
- [vite.config.ts](#viteconfigts)
- [installDynamicResolver](#installdynamicresolver)
- [Locale providers (optional)](#locale-providers-optional)
- [Reading list](#reading-list)

## Install matrix

Pick the row that matches your goal — the additional packages on the right are layered on top of the shared base (`@atscript/core`, `@atscript/typescript`, `@atscript/ui`).

| Goal | Install |
| --- | --- |
| Forms only (Vue) | `pnpm add @atscript/ui @atscript/vue-form @atscript/ui-styles` |
| Forms with dynamic `@ui.fn.*` | `pnpm add @atscript/ui @atscript/ui-fns @atscript/vue-form @atscript/ui-styles` |
| Forms + tables (Vue) | `pnpm add @atscript/ui @atscript/ui-table @atscript/vue-form @atscript/vue-table @atscript/ui-styles` |
| Forms + tables + workflow forms (Vue) | `pnpm add @atscript/ui @atscript/ui-table @atscript/vue-form @atscript/vue-table @atscript/vue-wf @atscript/ui-styles` |
| Server-side preset persistence (Moost) | `pnpm add @atscript/moost-ui-presets` (in addition to the table client) |
| Server-side workflow runtime (Moost) | `pnpm add @atscript/moost-wf` |
| Non-Vue (React/Svelte/Solid port) | `pnpm add @atscript/ui @atscript/ui-table @atscript/ui-fns` — framework-agnostic core only. Bring your own renderer. See [ui-core.md](ui-core.md). |

The atscript compiler (`asc`) and unplugin are required at build time — see the `atscript` skill for installing those.

## atscript.config.ts

The compiler must know about every annotation namespace you use. Register `uiPlugin()` to unlock `@ui.*`. Add `uiFnsPlugin()` only when consuming dynamic `@ui.fn.*` or `@ui.form.validate`. Add `wfPlugin()` on the server side when authoring workflow models that use `@wf.*`.

```typescript
import uiPlugin from "@atscript/ui/plugin";
import uiFnsPlugin from "@atscript/ui-fns/plugin"; // optional — only when using ui.fn.*
import wfPlugin from "@atscript/moost-wf/plugin"; // optional — server side only
import dbPlugin from "@atscript/db/plugin"; // optional — when using @db.*
import type { TAtscriptUserConfig } from "@atscript/core";

const config: TAtscriptUserConfig = {
  plugins: [
    uiPlugin(),
    uiFnsPlugin(),
    wfPlugin(),
    dbPlugin(),
  ],
  files: ["src/**/*.as"],
};

export default config;
```

Source: `packages/ui/src/plugin.ts:18`, `packages/ui-fns/src/plugin.ts:18`, `packages/moost-wf/src/plugin.ts:24`.

## vite.config.ts

Add the atscript unplugin and (Vue only) the auto-import resolver from `@atscript/ui-styles/vite`. The resolver only auto-imports Tier-1 (`as-*` root) components; Tier-2 defaults stay explicit.

```typescript
import { defineConfig } from "vite-plus";
import vue from "@vitejs/plugin-vue";
import atscript from "@atscript/unplugin/vite";
import Components from "unplugin-vue-components/vite";
import { AsResolver } from "@atscript/ui-styles/vite";

export default defineConfig({
  plugins: [
    vue(),
    atscript(),
    Components({
      resolvers: [AsResolver()],
    }),
  ],
});
```

`AsResolver()` source: `packages/ui-styles/src/vite.ts:24`.

`unplugin-atscript` triggers `.as` recompilation on file change so updated annotations flow through to FormDef / TableDef without a manual rebuild step. If a `.as` edit isn't showing up at runtime, a stale Vite/rolldown cache or out-of-date `.as.d.ts` is the usual cause.

## installDynamicResolver

`@atscript/ui` ships with a `StaticFieldResolver` that ignores `@ui.fn.*` keys. Calling `installDynamicResolver()` swaps in `DynamicFieldResolver` (compiles fn strings via `new Function`) and registers `uiFnsValidatorPlugin()` as a default validator plugin so `@ui.form.validate` strings run automatically.

Call exactly once at app startup, **before any `createFormDef` / `createTableDef` call**:

```typescript
// entry-client.ts (or main.ts)
import { installDynamicResolver } from "@atscript/ui-fns";

installDynamicResolver();
```

Source: `packages/ui-fns/src/index.ts:32`.

Security model: `DynamicFieldResolver` compiles annotation arguments with `new Function`. Only safe for schemas that are part of your build (validated by the atscript compiler at type-check time). Never feed user-controlled `.as` content into a runtime where `installDynamicResolver()` is active.

## Locale providers (optional)

Localization is opt-in — defaults run unlocalized (en-US-ish, no timezone).

**Forms** — provide a single language tag for currency/decimal display:

```vue
<script setup lang="ts">
import { provideAsLocale } from "@atscript/vue-form";

provideAsLocale(() => navigator.language);
</script>
```

Source: `packages/vue-form/src/composables/use-as-locale.ts:16`.

**Tables** — provide language + timezone for date/datetime cells and decimal cells:

```vue
<script setup lang="ts">
import { provideCellLocale } from "@atscript/vue-table";

provideCellLocale(() => ({
  language: navigator.language,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
}));
</script>
```

Source: `packages/vue-table/src/composables/use-cell-locale.ts:12`.

Currency comes from `@db.amount.currency` (literal) or `@db.amount.currency.ref` (sibling-field reference) on the prop. Units come from `@db.unit` / `@db.unit.ref`. See [annotations.md](annotations.md) and the `atscript-db` skill for `@db.amount.*` semantics.

## Reading list

| I want to build... | Skill | Reference file |
| --- | --- | --- |
| Forms (`<AsForm>`, `<AsField>`, custom inputs/components) | `atscript-ui-forms` | `forms.md` |
| Tables (`<AsTable>`, filters, presets, virtualization) | `atscript-ui-tables` | `tables.md` |
| Multi-step workflow forms over HTTP | `atscript-ui-wf` | `wf.md` |
| Custom theming / `as-*` shortcuts / vunor integration | `atscript-ui-styles` | `styles.md` |
| React/Svelte/Solid port — no framework wrapper | `atscript-ui` (this skill) | [ui-core.md](ui-core.md) |
| `.as` syntax, `@meta.*`, `@expect.*` | `atscript` | (external) |
| `@db.*`, DbSpace, moost-db CRUD, Client | `atscript-db` | (external) |
| Theme palette, c8-/i8-/layer-/scope- primitives | `vunor` | (external) |
