---
name: atscript-ui
description: >-
  General awareness skill for the atscript-ui ecosystem — UI rendered from `.as`
  annotated types. Use when working with `@atscript/ui`, `@atscript/ui-fns`, or
  `@atscript/ui-table` framework-agnostic primitives (FormDef, TableDef,
  FieldResolver, FilterCondition, PresetSnapshot, buildTableQuery,
  ValueHelpClient); when looking up the full `@ui.*` / `@ui.form.*` /
  `@ui.table.*` / `@ui.dict.*` / `@ui.type` / `@wf.*` annotation reference;
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

One `npx skills add moostjs/atscript-ui` invocation scans the repo and installs all five
sub-skills (`atscript-ui`, `atscript-ui-forms`, `atscript-ui-tables`, `atscript-ui-wf`,
`atscript-ui-styles`). The agent loads only the description-matched ones into context per task.

## Packages (UI side)

```
@atscript/ui              framework-agnostic core: FormDef, TableDef, FieldResolver, value-help, validators, decimal helpers
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
import { createFormDef, resolveFieldProp, UI_FORM_LABEL } from "@atscript/ui";
import { installDynamicResolver } from "@atscript/ui-fns"; // optional — enables @ui.fn.*

installDynamicResolver(); // call once before any createFormDef / createTableDef

// FormDef is the parsed mental model of a .as type
import { ContactForm } from "./contact.as";
const def = createFormDef(ContactForm);

// FieldDefs expose `path`, `prop`, `type`, `customType`, `allStatic`, plus structural
// helpers (`objectDef`, `unionVariants`, `itemField`, `itemFields`).
for (const field of def.fields) {
  const label = resolveFieldProp<string>(
    field.prop,
    "ui.form.fn.label",
    UI_FORM_LABEL,
    { v: undefined, data: formData.value, context: {}, entry: undefined },
  );
  // render however your framework wants — see vue-form for the Vue 3 binding
}
```

For tables, `createTableDef(meta, type)` merges a `MetaResponse` (server `/meta` payload from
`moost-db` or your own equivalent) with the atscript type to produce `ColumnDef[]`,
`primaryKeys[]`, `actions[]`, and CRUD permissions. See [ui-core.md](references/ui-core.md).

## Invariants

| #   | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **`@ui.*.type` is reserved for built-in renderer ids.** Forms: `text`, `password`, `textarea`, `number`, `decimal`, `select`, `radio`, `checkbox`, `paragraph`, `action`, `date`, `datetime`, `time` (plus structured `object`/`array`/`union`/`tuple`/`ref`). Tables: `text`, `number`, `boolean`, `date`, `datetime`, `relative`, `array`, `object`, `union`, `enum`, `ref`. Use `@ui.form.component` / `@ui.table.component` for **custom** renderers — they look up in `:components` not `:types`. |
| 2   | **`@ui.fn.*` requires `installDynamicResolver()` from `@atscript/ui-fns`.** Call once at app startup before constructing any FormDef / TableDef. Without it, dynamic annotations silently behave as undefined. Compiled function strings run via `new Function` in the host's full scope — only safe for compile-time-validated schemas you control.                                                                                                                                |
| 3   | **Form data is wrapped:** `formData = { value: domainData }`. Path helpers `getByPath` / `setByPath` from `@atscript/ui` handle the unwrap. Structured field paths join with `.` (e.g. `address.street`); array indices are numeric segments (`contacts.0.email`).                                                                                                                                                                                                                  |
| 4   | **`FieldResolver` is global and singleton.** `setResolver()` replaces the current resolver app-wide; the dynamic resolver from `ui-fns` replaces the static one. Call before any `createFormDef` / `createTableDef`.                                                                                                                                                                                                                                                              |
| 5   | **Value-help is lazy.** `extractValueHelp(prop)` returns `ValueHelpInfo \| undefined` synchronously; the actual options/rows fetch happens later via `resolveValueHelp(url)` and is cached per URL across the app. Use `resetValueHelpCache()` to force a re-fetch.                                                                                                                                                                                                                |
| 6   | **`flatMap` excludes phantom types.** FormDef / TableDef builders use `flattenAnnotatedType({ excludePhantomTypes: true })`. Phantom fields (e.g. action buttons) appear in the type tree but not in the field/column array unless they carry `@ui.form.action`.                                                                                                                                                                                                                  |
| 7   | **Validator plugins run in registration order.** `setDefaultValidatorPlugins([...])` replaces the list; `getFormValidator(def)` reads it at construction time. First plugin returning `false` short-circuits; `undefined` falls through to the next.                                                                                                                                                                                                                                |

## Key imports

```ts
// Framework-agnostic core
import {
  // factories
  createFormDef, createTableDef, createFormData, buildUnionVariants,
  // resolver
  FieldResolver, StaticFieldResolver, setResolver, getResolver,
  resolveFieldProp, resolveFormProp, resolveStatic, hasComputedAnnotations,
  // path helpers
  getByPath, setByPath, createFormValueResolver, detectUnionVariant,
  // validation
  getFormValidator, createFieldValidator, setDefaultValidatorPlugins, getDefaultValidatorPlugins,
  // value-help
  extractValueHelp, extractLiteralOptions, ValueHelpClient, resolveValueHelp, resetValueHelpCache,
  // grid layout helpers
  parseColSpan, parseRowSpan, resolveGridSpec, buildGridClasses,
  // decimal helpers
  enforceScale, formatDecimalForDisplay, parseDecimalInput,
  // column helpers
  getVisibleColumns, getSortableColumns, getFilterableColumns, getColumn,
  // type guards
  isArrayField, isObjectField, isUnionField, isTupleField,
  // annotation key constants (UI_FORM_*, UI_TABLE_*, UI_DICT_*, UI_TYPE — see annotations.md)
  UI_TYPE, UI_FORM_LABEL, UI_FORM_PLACEHOLDER, UI_TABLE_WIDTH, UI_DICT_LABEL,
  // utilities
  asArray, parseStaticAttrs, optKey, optLabel,
} from "@atscript/ui";

// Atscript build plugin (in atscript.config.ts)
import { uiPlugin } from "@atscript/ui/plugin";

// Dynamic resolver (opt-in)
import { installDynamicResolver, DynamicFieldResolver } from "@atscript/ui-fns";
import type { TFnScope, TComputed, TFieldEvaluated } from "@atscript/ui-fns";

// Atscript build plugin for @ui.fn.* keys (in atscript.config.ts)
import { uiFnsPlugin } from "@atscript/ui-fns/plugin";

// Framework-agnostic table model
import {
  // filter model
  FilterCondition, FieldFilters, FilterConditionType,
  filtersToUniqueryFilter, uniqueryFilterToFieldFilters,
  conditionsForType, columnFilterType, parseFilterInput, formatFilterCondition,
  defaultCondition, dateShortcuts,
  // preset model
  PresetSnapshot, PresetSnapshotWire, PresetAspect, PRESET_ASPECTS, derivePresetAspects,
  toWireSnapshot, fromWireSnapshot,
  // preset clients (HTTP)
  PresetsClient, AppPrefsClient, PresetsHttpError, isAuthError,
  // query builder
  buildTableQuery, mergeSorters, mergeFilters,
  // URL bridge
  stateToUrlQueryString, urlQueryStringToState, resolveAspectGate,
  // selection
  togglePk, trimSelection, rowsToPks,
  // state contracts (framework-agnostic)
  ConfigTab, TableStateData, TableStateMethods,
  // window mode helpers
  pageAlignedBlocksFor, blockStartFor, planFetch, walkForwardAbsorb, walkBackwardAbsorb,
  // column widths
  computeDefaultColumnWidth, reconcileColumnWidthDefaults, MAX_DEFAULT_COLUMN_WIDTH_PX,
  // utils
  debounce, arraysEqual, setsEqual, sortersEqual, reorderColumnNames,
} from "@atscript/ui-table";
```

## References — load only what's needed

| Domain                | File                                                       | When                                                                                                                                                                                                                                                              |
| --------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First contact         | [getting-started.md](references/getting-started.md)        | Install matrix per use-case, root `atscript.config.ts` (UI plugins), root `vite.config.ts` (unplugin-atscript), `installDynamicResolver()` placement, locale providers, dev-server hooks                                                                          |
| Ecosystem map         | [ecosystem.md](references/ecosystem.md)                    | Which package solves which problem, dep graph, decision table, glossary, sibling-skill routing                                                                                                                                                                    |
| `@ui.*` annotations   | [annotations.md](references/annotations.md)                | Full exhaustive reference of every `@ui.*` / `@ui.form.*` / `@ui.form.fn.*` / `@ui.table.*` / `@ui.table.fn.*` / `@ui.dict.*` / `@ui.type` / `@wf.*` key — argument shape, what reads it, precedence. The fastest grep target for "which annotation does X" queries |
| Framework-agnostic    | [ui-core.md](references/ui-core.md)                        | `@atscript/ui` + `@atscript/ui-table` + `@atscript/ui-fns` programmatic APIs for a non-Vue consumer: `createFormDef`, `createTableDef`, `FieldResolver` contract, validators, value-help, decimal helpers, filter model, preset model, query builder, URL bridge   |

## See also

Reference docs: https://ui.atscript.dev. Source: https://github.com/moostjs/atscript-ui.
