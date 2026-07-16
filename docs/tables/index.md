---
outline: deep
---

# Tables

`@atscript/vue-table` renders smart, server-driven tables straight from an
annotated `.as` type. Sorting, filtering, pagination, virtual scrolling,
column resize/reorder, row selection and contextual actions all flow from
the same metadata you already wrote for your DB layer — no schema
duplication, no hand-wired column definitions, no per-cell glue.

## Mental model

The pipeline is three short steps:

```text
.as type + /meta  →  TableDef  →  <AsTable> / <AsWindowTable>
   (source)          (parsed)        (rendered)
```

1. **`.as` type.** A normal atscript interface, usually the same one that
   describes your DB table — decorated with `@db.*` (for the server),
   `@meta.*`, `@expect.*`, `@ui.table.*` and `@ui.dict.*`. Optional
   dynamic annotations come from `@atscript/ui-fns`.

2. **`createTableDef(meta, type)`** in `@atscript/ui` combines the server's
   `/meta` response (capabilities, CRUD permissions, actions, search
   indexes) with the deserialised type to produce a framework-agnostic
   `TableDef` — a list of `ColumnDef`s plus action and CRUD descriptors.
   `<AsTableRoot>` calls this for you; consumers rarely invoke it
   directly.

3. **`<AsTableRoot url=".." :types :controls>`** owns state. It fetches
   `/meta`, builds `TableDef`, manages reactive query state
   (`filters`, `sorters`, `searchTerm`, `pagination`, `columnNames`),
   dispatches queries and exposes everything via a `v-slot`. A child
   `<AsTable>` (paginated) or `<AsWindowTable>` (virtualised) consumes
   that context and renders rows.

## Component tiers

Every `vue-table` component lives in one of three tiers (see
`CLAUDE.md`):

- **Tier 1 — Primary.** What users tag in templates: `AsTableRoot`,
  `AsTable`, `AsWindowTable`, `AsTableActions`, `AsFilters`,
  `AsPresetPicker`. Auto-resolved by `AsResolver()`.
- **Tier 2 — Defaults.** Swappable cells and dialogs: `AsCellArray`,
  `AsCellDate`, `AsCellJson`, `AsCellNumber`, `AsCellUnion`,
  `AsTableCellValue`, `AsConfigDialog`, `AsFilterDialog`,
  `AsPresetDialog`, `AsConfirmDialog`, `AsActionFormDialog`,
  `AsTableHeaderCell`, `AsRowActions`, `AsColumnMenu`,
  `AsFilterField`, `AsFilterInput`. Composed via `:types` /
  `:controls` / `:components` prop maps.
- **Tier 3 — Internals.** `AsTableBase`, `AsTableVirtualizer`,
  `AsFilterValueHelp`, `AsOrderableList`, … — not exported.

## Paginated vs windowed

Two renderers consume the same root context:

- **`<AsTable>`** — classic paginated table. Pair with a pagination
  control bound to `state.pagination`. Best for stable, smaller
  result sets and CRUD-heavy admin screens.
- **`<AsWindowTable>`** — virtualised, block-aligned fetcher. Renders
  only the visible window of rows and streams blocks of size `:limit`
  as the user scrolls. Best for 10k+ row datasets or infinite-scroll
  feels.

See [Pagination & Virtualization](/tables/pagination) for the trade-offs
and tuning knobs.

## Model-driven state

Table state is the contract. Call sites — dialogs, toolbars, external
`v-model`, devtools, custom toolbars — only mutate the model arrays
(`filterFields`, `filters`, `columnNames`, `sorters`, `searchTerm`,
`pagination`). Reactions (re-query, pagination reset, `mustRefresh`)
live in a single root-level watcher, so any writer triggers identical
behaviour. **Mutators are pure** — each touches exactly one entity. In
particular, `filterFields` (which filter inputs are shown) and `filters`
(applied conditions) are independent: hiding an input does not clear
its value, clearing a value does not hide its input.

`state.query()` is reserved for user-initiated refreshes (refresh
button, pull-to-refresh). Never call it to "apply" a state change —
that path is the watcher's job.

The one sanctioned direct call beyond user-initiated refresh is
`state.query({ silent: true })` — a live refresh that re-runs the current
query on a timer without loading affordances. See
[Silent live refresh](/tables/pagination#silent-live-refresh).

## Where to go next

- [Hello World](/tables/hello-world) — a full working table in 25 lines.
- [Annotations Reference](/tables/annotations) — every `@ui.table.*`,
  `@ui.dict.*`, `@meta.*`, `@expect.*` and `@db.*` key the table reads.
- [Query Function](/tables/query-function) — moost-db wiring AND the
  custom `queryFn` escape hatch.
- [Filtering](/tables/filtering) — the filter model, value-help, and
  how UI state translates to Uniquery.
- [Sorting](/tables/sorting) — multi-sort, force sorters, header
  interactions.
- [Pagination & Virtualization](/tables/pagination) — choosing between
  `<AsTable>` and `<AsWindowTable>`, tuning block size.
- [Model Routes & Nav](/tables/model-routes) — generate router entries
  and side-nav items for every DB model with `buildModelRoutes`.

::: tip Related ecosystem docs
The `.as` language, `asc` CLI and the core `@meta.*` / `@expect.*`
families live in the [atscript core docs](https://atscript.dev). The
`@db.*` annotations and the moost-db HTTP surface (`/meta`, `/q`,
relations, search indexes) are documented in the
[atscript-db docs](https://db.atscript.dev).
:::
