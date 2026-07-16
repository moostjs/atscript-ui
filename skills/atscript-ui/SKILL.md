---
name: atscript-ui
description: >-
  General awareness skill for the atscript-ui ecosystem — UI rendered from `.as`
  annotated types. Use when working with `@atscript/ui`, `@atscript/ui-fns`, or
  `@atscript/ui-table` framework-agnostic primitives (FormDef, TableDef,
  FieldResolver, FilterCondition, PresetSnapshot, buildTableQuery,
  ValueHelpClient, buildModelRoutes — app nav/routes from DB models); when
  looking up the full `@ui.*` / `@ui.form.*` / `@ui.table.*` / `@ui.dict.*` /
  `@ui.nav.*` / `@ui.type` / `@wf.*` annotation reference;
  when wiring `installDynamicResolver()` from `@atscript/ui-fns`; when porting
  the engine to a non-Vue framework (React, Svelte); or when deciding which
  specialized atscript-ui skill to load (forms / tables / wf / styles). Scope
  is cross-cutting and framework-agnostic. Out of scope: `.as` syntax,
  `@meta.*`, `@expect.*`, `asc`, `unplugin-atscript`, VSCode LSP (use the
  `atscript` skill); `@db.*`, DbSpace, adapters, `moost-db`, browser `Client`
  (use the `atscript-db` skill); Vue components (use the per-domain skill).
---

# atscript-ui

## Install

```bash
npx skills add moostjs/atscript-ui      # all atscript-ui skills (general + forms + tables + wf + styles)
npx skills add moostjs/atscript         # sibling — .as language
npx skills add moostjs/atscript-db      # sibling — DB layer (often paired with tables / wf)
```

One install pulls in 5 sub-skills (`atscript-ui`, `atscript-ui-forms`, `-tables`, `-wf`, `-styles`); agent loads only the description-matched ones per task.

## Packages (UI side)

```
@atscript/ui              framework-agnostic core: FormDef, TableDef, FieldResolver, value-help, validators, decimal helpers, model nav routes
    ├── @atscript/ui-fns       opt-in dynamic resolver for @ui.fn.* (uses new Function — trusted schemas only)
    ├── @atscript/ui-table     framework-agnostic table model: filter→Uniquery, presets, query builder, window mode
    ├── @atscript/ui-styles    UnoCSS preset + AsResolver + as-* shortcut tree + baked icons
    ├── @atscript/vue-form     Vue 3 form components
    ├── @atscript/vue-table    Vue 3 table components
    ├── @atscript/vue-wf       Vue 3 HTTP workflow form
    ├── @atscript/moost-wf     server-side workflow (decorators + AsWfStore)
    └── @atscript/moost-ui-presets   server-side preset persistence (AsPresetsController)
```

```bash
# install the framework-agnostic core (every UI consumer needs this)
pnpm add @atscript/core @atscript/typescript @atscript/ui
pnpm add @atscript/ui-fns                       # opt-in: dynamic @ui.fn.* expressions
pnpm add @atscript/ui-table                     # if rendering tables
```

## Quick start (framework-agnostic core)

```ts
import {
  createFormDef,
  createFormData,
  resolveFieldProp,
  UI_FORM_FN_LABEL,
  META_LABEL,
} from "@atscript/ui";
import { installDynamicResolver } from "@atscript/ui-fns"; // optional — enables @ui.fn.*

installDynamicResolver(); // optional — call once at startup, before any createFormDef / createTableDef

import { ContactForm } from "./contact.as"; // .as file emits an annotated type
const def = createFormDef(ContactForm);
const formData = createFormData(ContactForm); // { value: domainData }

for (const field of def.fields) {
  // resolveFieldProp picks fn-key (dynamic) when present, else falls back to staticKey (@meta.label here)
  const label = resolveFieldProp<string>(field.prop, UI_FORM_FN_LABEL, META_LABEL, {
    v: undefined,
    data: formData.value,
    context: {},
    entry: undefined,
  });
  // render however your framework wants — see vue-form for the Vue 3 binding
}
```

`createTableDef(meta, type)` merges a `MetaResponse` (server `/meta` payload from `moost-db` or your own
equivalent) with the deserialised atscript type to produce `ColumnDef[]`, `primaryKeys[]`, `actions`, and
CRUD permissions.

## Invariants

| #   | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **`@ui.type` / `@ui.form.type` / `@ui.table.type` are reserved for built-in renderer ids.** Closed list registered by the `@atscript/ui` plugin: `text`, `password`, `number`, `decimal`, `select`, `textarea`, `checkbox`, `radio`, `multiselect`, `date`, `datetime`, `time`, `paragraph`, `action`. Structured renderer kinds (`array`, `object`, `union`, `tuple`) are exposed by FormDef as `field.type`, never as a `@ui.*.type` argument. `multiselect` is form-only and auto-dispatches on `(literal \| union)[]` and primitive-item arrays carrying `@ui.form.options` / `@ui.form.fn.options` (value model `T[]`). Custom renderers always go via `@ui.form.component` / `@ui.table.component`, which look up in the consumer's `:components` map (not `:types`). |
| 2   | **`@ui.fn.*` requires `installDynamicResolver()` from `@atscript/ui-fns`.** Call once at app startup before constructing any FormDef / TableDef. Without it, dynamic annotations silently behave as undefined. Compiled function strings run via `new Function` in the host's full scope — only safe for compile-time-validated schemas you control.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 3   | **Form data is wrapped:** `formData = { value: domainData }`. Path helpers `getByPath` / `setByPath` from `@atscript/ui` handle the unwrap. Structured field paths join with `.` (e.g. `address.street`); array indices are numeric segments (`contacts.0.email`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 4   | **`FieldResolver` is global and singleton.** `setResolver()` replaces the current resolver app-wide; the dynamic resolver from `ui-fns` replaces the static one. Call before any `createFormDef` / `createTableDef`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 5   | **Value-help is lazy.** `extractValueHelp(prop)` returns `ValueHelpInfo \| undefined` synchronously; the actual options/rows fetch happens later via `resolveValueHelp(url)` and is cached per URL across the app. Use `resetValueHelpCache()` to force a re-fetch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 6   | **`flatMap` excludes phantom types.** FormDef / TableDef builders use `flattenAnnotatedType({ excludePhantomTypes: true })`. Phantom fields (e.g. action buttons) appear in the type tree but not in the field/column array unless they carry `@ui.form.action`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 7   | **Validator plugins run in registration order.** `setDefaultValidatorPlugins([...])` replaces the list; `getFormValidator(def)` reads it at construction time. First plugin returning `false` short-circuits; `undefined` falls through to the next.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 8   | **OCC version columns are auto-hidden.** Tables annotated with `@db.column.version` expose `meta.versionColumn`. Pass it to `createFormDef(type, { versionColumn })` so the version field doesn't render as an input; the value stays in form data and rides the wire payload for the server's `$cas` lift. `createTableDef` propagates it to `TableDef.versionColumn` and skips the column from `def.columns`; `resolveValueHelp` skips it from `primaryKeys` / `filterableFields` / `sortableFields` / `attrFields`. On write, catch `VersionMismatchError` from `@atscript/db-client` to surface 409 conflicts. See `atscript-db` skill (OCC reference) and the `atscript-ui-forms` skill's OCC edit pattern.                                                            |

## Key imports

```ts
// Framework-agnostic core
import {
  // factories
  createFormDef,
  createTableDef,
  createFormData,
  buildUnionVariants,
  // resolver (most consumers only need resolveFieldProp / resolveFormProp)
  FieldResolver,
  resolveFieldProp,
  resolveFormProp,
  // path helpers
  getByPath,
  setByPath,
  createFormValueResolver,
  detectUnionVariant,
  // validation
  getFormValidator,
  createFieldValidator,
  setDefaultValidatorPlugins,
  getDefaultValidatorPlugins,
  // value-help
  extractValueHelp,
  extractLiteralOptions,
  ValueHelpClient,
  resolveValueHelp,
  resetValueHelpCache,
  // grid layout helpers
  parseColSpan,
  parseRowSpan,
  resolveGridSpec,
  buildGridClasses,
  // decimal helpers
  enforceScale,
  formatDecimalForDisplay,
  parseDecimalInput,
  // column helpers
  getSortableColumns,
  getFilterableColumns,
  getColumn,
  // model nav routes (feed dbPlugin({ manifest }) output — see annotations.md, @ui.nav.*)
  buildModelRoutes,
  // + type TModelRoute
  // annotation key constants (UI_FORM_*, UI_TABLE_*, UI_DICT_*, UI_TYPE — see annotations.md)
  UI_TYPE,
  UI_FORM_FN_LABEL,
  UI_FORM_LABEL_SINGULAR,
  UI_FORM_PLACEHOLDER,
  UI_TABLE_WIDTH,
  UI_TABLE_SELECT_WITH,
  UI_DICT_LABEL,
  UI_NAV_GROUP,
  UI_NAV_ORDER,
  UI_NAV_HIDDEN,
  // utilities
  asArray,
  optKey,
  optLabel,
} from "@atscript/ui";

// Atscript build plugin (in atscript.config.ts) — default exports
import uiPlugin from "@atscript/ui/plugin";

// Dynamic resolver (opt-in)
import { installDynamicResolver, DynamicFieldResolver } from "@atscript/ui-fns";
import type { TFnScope, TComputed, TFieldEvaluated } from "@atscript/ui-fns";

// Atscript build plugin for @ui.fn.* keys (in atscript.config.ts) — default export
import uiFnsPlugin from "@atscript/ui-fns/plugin";

// Framework-agnostic table model
import {
  // filter model
  FilterCondition,
  FieldFilters,
  FilterConditionType,
  filtersToUniqueryFilter,
  uniqueryFilterToFieldFilters,
  conditionsForType,
  columnFilterType,
  parseFilterInput,
  formatFilterCondition,
  defaultCondition,
  dateShortcuts,
  // preset model
  PresetSnapshot,
  PresetSnapshotWire,
  PresetAspect,
  PRESET_ASPECTS,
  derivePresetAspects,
  toWireSnapshot,
  fromWireSnapshot,
  // preset clients (HTTP)
  PresetsClient,
  AppPrefsClient,
  PresetsHttpError,
  isAuthError,
  // query builder
  buildTableQuery,
  // URL bridge
  stateToUrlQueryString,
  urlQueryStringToState,
  resolveAspectGate,
  // selection
  togglePk,
  trimSelection,
  rowsToPks,
  // column widths
  computeDefaultColumnWidth,
  reconcileColumnWidthDefaults,
  // utils
  debounce,
  reorderColumnNames,
} from "@atscript/ui-table";
```

## References — load only what's needed

| Domain              | File                                                        | When                                                                                                                                                                                                                                                                                                                                             |
| ------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| First contact       | [getting-started.md](references/getting-started.md)         | Install matrix per use-case, root `atscript.config.ts` (UI plugins), root `vite.config.ts` (unplugin-atscript), `installDynamicResolver()` placement, locale providers, dev-server hooks                                                                                                                                                         |
| Ecosystem map       | [ecosystem.md](references/ecosystem.md)                     | Which package solves which problem, dep graph, decision table, glossary, sibling-skill routing                                                                                                                                                                                                                                                   |
| `@ui.*` annotations | [annotations.md](references/annotations.md)                 | Full exhaustive reference of every `@ui.*` / `@ui.form.*` / `@ui.form.fn.*` / `@ui.table.*` / `@ui.table.fn.*` / `@ui.dict.*` / `@ui.nav.*` / `@ui.type` / `@wf.*` key — argument shape, what reads it, precedence. Also `buildModelRoutes` (model manifest → nav/route registry). The fastest grep target for "which annotation does X" queries |
| Bundle optimization | [bundle-optimization.md](references/bundle-optimization.md) | When trimming JS or CSS bundle size: subpath/`AsResolver` delivery, `<AsTableRoot>` lazy dialogs + `controls.X` eager flip, `AsActionFormDialog`/vue-form boundary, extractor match channels, `componentCompanions` + `excludeComponents`, pre-built CSS granularity                                                                             |

## Customization

Every `@atscript/vue-*` package follows a three-tier component layout, and the tier of a component tells you how you interact with it:

- **Tier 1 — Primary roots.** Components you write as tags in your templates: `<AsForm>`, `<AsTable>`, `<AsTableRoot>`, `<AsWfForm>`, `<AsField>`, `<AsIterator>`. You compose and configure them; you don't swap them. If you need a completely different shell, build with the public composables (`useAsForm`, `useAsTable`, `useWfForm`) directly.
- **Tier 2 — Defaults.** Shipped renderers you replace via prop maps — this is the customization surface. Forms expose `:types` (built-in renderer ids: `text`, `select`, `date`, …) and `:components` (custom names paired with `@ui.form.component` on the field). Tables expose the same plus `controls.configDialog` / `controls.filterDialog` / `controls.presetDialog` for dialog-level swaps. Per-domain skills (`atscript-ui-forms`, `atscript-ui-tables`, `atscript-ui-wf`) walk through each swap with code examples.
- **Tier 3 — Internals.** Composition helpers consumers don't tag directly. You don't swap them, but their style classes ride along with the Tier-2 defaults that use them, so swapping out a default also releases its internal style shortcuts as dead weight in your bundle (see "Style consequence" below).

### Cross-cutting swap — `ClientFactory`

The one customization that's not domain-specific is the HTTP client. Tables, value-help (FK pickers), and the preset/app-config controllers all reach the network through a `ClientFactory` from `@atscript/db-client`. Replace the default to inject auth headers, route through a gateway, or run in a custom transport:

```ts
import { setDefaultClientFactory } from "@atscript/ui";
import { Client } from "@atscript/db-client";

setDefaultClientFactory(
  (url) =>
    new Client(url, {
      fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
      // headers, base URL rewriting, retry, etc.
    }),
);
```

Per-component overrides exist where it matters (`<AsTableRoot :client-factory>`, `<AsForm>` value-help passes its own factory through `useAsValueHelp`).

### Style consequence

Style classes ride with the components you import. Keep `AsFilterDialog` and its `as-filter-*` shortcuts stay reachable in your bundle; replace it with a custom dialog that doesn't tag those classes and the related shortcuts drop out of your bundle automatically. For granular opt-out, `@atscript/ui-styles` exports four shortcut groups plus an `allShortcuts` super-merge — pass a narrower subset (e.g. `commonShortcuts + formShortcuts` only) when you intentionally want to drop a domain. See the `atscript-ui-styles` skill.

## See also

Reference docs: https://ui.atscript.dev. Source: https://github.com/moostjs/atscript-ui.
