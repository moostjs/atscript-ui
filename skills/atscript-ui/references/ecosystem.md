Package map, routing across sibling skills, glossary.

## Contents

- [Three sibling skills](#three-sibling-skills)
- [Package dependency graph](#package-dependency-graph)
- [When to use which package](#when-to-use-which-package)
- [Glossary](#glossary)
- [Cross-skill routing](#cross-skill-routing)

## Three sibling skills

`atscript-ui` is one of three sibling skills. Each owns a domain — load the right one for the question.

| Skill | Docs site | Owns |
| --- | --- | --- |
| `atscript` | atscript.dev | `.as` syntax, `@meta.*` / `@expect.*`, primitives, `asc` CLI, `atscript.config.ts`, unplugin, VSCode LSP, plugin authoring |
| `atscript-db` | db.atscript.dev | `@db.*` annotations, DbSpace, adapters (sqlite/postgres/mysql/mongo), table/view CRUD, query filters, `@atscript/moost-db`, browser `Client` |
| `atscript-ui` | ui.atscript.dev | `@ui.*` / `@wf.*` annotations, FormDef/TableDef, framework-agnostic table state, vue-form/vue-table/vue-wf, `as-*` styles, moost-ui-presets, moost-wf |

One-line route phrases:

- "How do I define a type / write `@meta.label` / use `@expect.minLength`?" → `atscript`
- "How do I query my DB / write `@db.rel.FK` / set up a CRUD controller?" → `atscript-db`
- "How do I render a form / a table / a workflow page / customize `as-*` classes?" → `atscript-ui`

## Package dependency graph

```
@atscript/ui                    framework-agnostic — FormDef, TableDef, annotation keys, FieldResolver, validators, value-help
  ├─ @atscript/ui-fns           framework-agnostic — opt-in plugin for @ui.fn.* / @ui.form.validate (new Function)
  ├─ @atscript/ui-table         framework-agnostic — filter model, filter→Uniquery, presets, table state contracts
  ├─ @atscript/ui-styles        Vue-leaning — UnoCSS shortcuts (`as-*`), presets, icon loader, AsResolver()
  ├─ @atscript/vue-form         Vue 3 — <AsForm>, <AsField>, default inputs, useAsForm
  ├─ @atscript/vue-table        Vue 3 — <AsTable>, <AsTableRoot>, virtualization, cell renderers, presets client
  ├─ @atscript/vue-wf           Vue 3 — <AsWfForm>, workflow loop (HTTP round-trip driven by atscript metadata)
  ├─ @atscript/moost-wf         server-side — workflow runtime, AsWfStore, @wf.* plugin, action serialization
  └─ @atscript/moost-ui-presets server-side — Moost controller + AsPresetEntry schema for preset persistence
```

`@atscript/ui` is **zero-framework**. Anything you build on top of `@atscript/ui` / `@atscript/ui-table` is reusable from a non-Vue runtime (React/Svelte/Solid). Anything you build on top of `@atscript/vue-*` is Vue-only.

## When to use which package

| I want... | Packages | Skill ref |
| --- | --- | --- |
| Render a form from a `.as` type | `@atscript/vue-form` + `@atscript/ui` + `@atscript/ui-styles` | `atscript-ui-forms` → `forms.md` |
| Add dynamic enable/disable/options on form fields | + `@atscript/ui-fns` | [annotations.md](annotations.md) (`@ui.form.fn.*`) |
| Render a CRUD-backed table with filters/sort/pagination | `@atscript/vue-table` + `@atscript/ui-table` + `@atscript/ui` + `@atscript/ui-styles` | `atscript-ui-tables` → `tables.md` |
| Persist user-saved presets/filter views server-side | + `@atscript/moost-ui-presets` (server) | `atscript-ui-tables` → `presets.md` |
| Build a multi-step workflow form (HTTP wizard) | `@atscript/vue-wf` (client) + `@atscript/moost-wf` (server) | `atscript-ui-wf` → `wf.md` |
| Build a React/Svelte/Solid port — no Vue | `@atscript/ui` + `@atscript/ui-table` + `@atscript/ui-fns` | [ui-core.md](ui-core.md) |
| Customize theme (palette, c8/i8/layer/scope tokens) | `@atscript/ui-styles` + vunor | `atscript-ui-styles` → `styles.md` |
| Re-use `as-*` shortcut tree without Vue | `@atscript/ui-styles` (UnoCSS preset) | `atscript-ui-styles` → `styles.md` |

## Glossary

| Term | One-line definition |
| --- | --- |
| **FormDef** | `{ type, rootField, fields, flatMap }` — flattened form layout from a `.as` type. Built once by `createFormDef(type)`. (`packages/ui/src/form/types.ts:50`) |
| **FormFieldDef** | `{ path, prop, type, customType?, phantom, name, allStatic }` — single-field pointer into a FormDef. Subtypes: `FormArrayFieldDef`, `FormObjectFieldDef`, `FormUnionFieldDef`, `FormTupleFieldDef`. |
| **FormUnionVariant** | One branch of a union — `{ label, type, def?, itemField?, designType? }`. |
| **TableDef** | `{ type, columns, flatMap, primaryKeys, preferredId, crud, canRemove, actions, searchable, ... }` — built from a moost-db `/meta` response via `createTableDef(meta)`. |
| **ColumnDef** | Single column descriptor — path, label, type, sortable, filterable, visible, width, valueHelpInfo, currencyCode/Ref, unitCode/Ref, precisionScale, fixed. |
| **FieldResolver** | Pluggable interface `{ resolveFieldProp, resolveFormProp, hasComputedAnnotations }`. `StaticFieldResolver` reads static metadata only; `DynamicFieldResolver` (from `@atscript/ui-fns`) compiles `@ui.fn.*` via `new Function`. |
| **FilterCondition** | `{ type: FilterConditionType, value: (string \| number \| boolean)[] }` — one filter clause; 13 types: eq, ne, gt, gte, lt, lte, contains, starts, ends, bw, null, notNull, regex. |
| **FieldFilters** | `Record<path, FilterCondition[]>` — applied filter conditions keyed by field path. |
| **PresetSnapshot** | In-memory `{ columns?, filters?, filterOps?, sorters?, itemsPerPage? }` — per-aspect opt-in container for table preset persistence. Wire form is `PresetSnapshotWire`. |
| **PresetAspect** | One of `'columns' \| 'filters' \| 'filterOps' \| 'sorters' \| 'itemsPerPage'` — derived from snapshot top-level keys. |
| **TFnScope** | Scope passed to compiled fn strings: `{ v?, data, context, entry?, action? }`. |
| **AsWfStore** | Server-side workflow state store; honours `@wf.store.fromContext` to mirror context values into top-level columns. |
| **AsPresetEntry** | Server-side row type (from `@atscript/moost-ui-presets`) holding `preset` / `userConf` / `appConf` data. |
| **MetaResponse** | Shape of moost-db `/meta` endpoint response — `{ searchable, primaryKeys, preferredId, crud, actions, relations, fields, type }`. |
| **ValueHelpInfo** | `{ url, targetField }` — minimal sync probe for FK columns; consumed lazily by `resolveValueHelp(url)`. |
| **ResolvedValueHelp** | Resolved value-help target — adds `tableDef` to `ValueHelpInfo` after fetching the target's `/meta`. |
| **TFormAction** | Form action descriptor `{ id, label }` collected from `@ui.form.action` / `@ui.form.submit.*`. |
| **TableStateData / TableStateMethods** | Framework-agnostic contract a Vue/React wrapper must satisfy; covers reactive arrays + mutators. (`packages/ui-table/src/state/table-state-types.ts`) |

## Cross-skill routing

| If the question is about... | Load skill |
| --- | --- |
| `.as` syntax, generics, refs, `@meta.*`, `@expect.*`, primitives | `atscript` |
| `asc` CLI, `atscript.config.ts` shape, plugin authoring, VSCode LSP | `atscript` |
| `@db.*` annotations, DbSpace setup, adapters, query DSL, FK/index | `atscript-db` |
| `@atscript/moost-db` REST endpoints, declarative actions, `@InputForm`, browser `Client` / `client.action()` | `atscript-db` |
| vunor palette tokens, `c8-*` / `i8-*` / `layer-*` / `scope-*` primitives, theme override | `vunor` |
| `@ui.*` / `@wf.*` annotations, FormDef/TableDef, `as-*` shortcuts, vue-form/table/wf, presets, moost-wf | `atscript-ui` (this) |
