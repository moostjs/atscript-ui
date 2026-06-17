---
outline: deep
---

# Annotations Reference

Every visual, behavioural and capability decision the table makes is
driven by an annotation on the underlying `.as` type. This page is the
authoritative list of what each one does, where to put it, and which
component reads it.

Annotations cluster into five namespaces:

- **`@ui.table.*`** — static, table-only.
- **`@ui.table.fn.*`** — dynamic (runtime JS expressions) — requires
  `@atscript/ui-fns`.
- **`@ui.dict.*`** — value-help / dictionary display + capabilities.
  Read both by the table (FK target columns) and by the value-help
  picker UI.
- **`@ui.type`** — cross-cutting renderer override (applies wherever
  there's no surface-specific override).
- **`@meta.*`** / **`@expect.*`** — generic atscript metadata read by
  the table (labels, IDs, max length, nullability).
- **`@db.*`** — DB-layer annotations read indirectly via the moost-db
  `/meta` response (relations, search indexes, currency/units) or
  directly off the type (FK info, JSON, precision).

## `@ui.table.*` — static column annotations

| Annotation                       | Arg(s)                     | Where                       | Controls                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------- | -------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@ui.table.type "type"`          | built-in renderer id       | `prop`, `type`              | Flips the built-in cell renderer. Built-in ids: `text`, `number`, `boolean`, `date`, `datetime`, `relative`, `array`, `object`, `union`, `enum`, `ref`. Reserved for built-ins — for custom cells use `@ui.table.component`. Wins over `@ui.type`.                                                                                                                                                                                                                                      |
| `@ui.table.component "name"`     | component name             | `prop`, `type`, `interface` | Named component override for custom cells — looked up in the `:components` map passed to `<AsTableRoot>`. The dedicated mechanism for hand-rolled renderers. Wins over `@ui.table.type` when both resolve.                                                                                                                                                                                                                                                                              |
| `@ui.table.selectWith "field"`   | sibling leaf field path    | `prop`, `type`              | Extra sibling leaf field a custom cell needs, fetched into `$select` whenever this column is visible. Never a column itself. Repeatable; see [Custom Cells](/tables/custom-cells).                                                                                                                                                                                                                                                                                                      |
| `@ui.table.width "240px"`        | CSS width string           | `prop`, `type`              | Default column width. Double-clicking the resize handle auto-fits to content; the column menu's _Reset width_ entry restores this value.                                                                                                                                                                                                                                                                                                                                                |
| `@ui.table.exclude`              | —                          | `prop`, `type`              | Completely removes the field from the table: it never becomes a column, is not displayable/filterable/sortable, and does not appear in the config dialog (users cannot add it). The field stays in the type — readable/writable in forms — and remains a valid `@ui.table.selectWith` target, so its data can still ride in the row payload to feed a custom cell. Trade-off: the field can never be shown as its own column. Default column visibility is controlled by table presets. |
| `@ui.table.order N`              | `number`                   | `prop`, `type`              | Initial column ordering. Lower values appear first. User-driven reorder still mutates `state.columnNames` and is preserved per-preset / per-URL-state.                                                                                                                                                                                                                                                                                                                                  |
| `@ui.table.attr "name", "value"` | name, value                | `prop`, `type`              | Custom attribute or component prop applied to the rendered `<td>`. Repeatable.                                                                                                                                                                                                                                                                                                                                                                                                          |
| `@ui.table.classes "names"`      | space-separated class list | `prop`, `type`, `interface` | CSS classes appended to every `<td>` in this column. Repeatable. Use `as-*` shortcuts or vunor primitives — see [Customization](/tables/customization).                                                                                                                                                                                                                                                                                                                                 |
| `@ui.table.styles "css"`         | inline CSS                 | `prop`, `type`, `interface` | Inline styles appended to the rendered `<td>`. Repeatable.                                                                                                                                                                                                                                                                                                                                                                                                                              |

```atscript
@ui.table.width "12em"
@ui.table.order 1
@ui.table.classes "font-mono"
sku: string

@ui.table.component 'identity'
@ui.table.selectWith 'firstName'
@ui.table.selectWith 'lastName'
username: string
```

## `@ui.table.fn.*` — dynamic column annotations

These require `@atscript/ui-fns` (installed alongside `@atscript/ui`).
The argument is a JavaScript expression evaluated per-row with the row
data in scope — use sparingly, this opts into `new Function()`.

| Annotation                         | Arg(s)              | Controls                                                                        |
| ---------------------------------- | ------------------- | ------------------------------------------------------------------------------- |
| `@ui.table.fn.attr "name", "expr"` | name, JS expression | Per-row attribute/prop on the `<td>`. Repeatable; each evaluated for every row. |
| `@ui.table.fn.classes "expr"`      | JS expression       | Per-row class list on the `<td>`. Repeatable.                                   |
| `@ui.table.fn.styles "expr"`       | JS expression       | Per-row inline style on the `<td>`. Repeatable.                                 |

```atscript
@ui.table.fn.classes "inStock ? 'text-success' : 'text-error'"
inStock: boolean
```

::: warning Dynamic expressions
`@ui.table.fn.*` expressions are JS evaluated at runtime — keep them
short, side-effect free, and never let untrusted content flow into the
`.as` source.
:::

## `@ui.dict.*` — value-help (FK target) annotations

When a table column is a foreign-key reference (`@db.rel.FK`), the
table doesn't show the raw ID — it shows a label resolved from the
referenced row. The referenced interface declares which fields play
which role with the `@ui.dict.*` family:

| Annotation            | Node                | Purpose                                                                                                           |
| --------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `@ui.dict.label`      | `prop`              | Primary display field for value-help and `ref`-type cells.                                                        |
| `@ui.dict.descr`      | `prop`              | Secondary description in the value-help picker.                                                                   |
| `@ui.dict.attr`       | `prop`              | Additional attribute column in table-mode value-help. Repeatable.                                                 |
| `@ui.dict.filterable` | `prop`              | Filterable in the picker UI (surfaced via `meta.fields[name].filterable`).                                        |
| `@ui.dict.sortable`   | `prop`              | Sortable in the picker UI.                                                                                        |
| `@ui.dict.searchable` | `prop`, `interface` | Participates in `$search` inside the value-help picker. On an interface, marks every `string` prop as searchable. |

```atscript
@db.table 'categories'
export interface Category {
    @meta.id
    @db.default.increment
    id: number

    @ui.dict.label
    name: string

    @ui.dict.descr
    description?: string
}
```

When the parent table references `Category`, its `categoryId` column
renders the category's `name`, and the filter dialog's value-help
typeahead searches against `name` / `description`.

::: tip Read server-side
`@ui.dict.filterable` / `@ui.dict.sortable` / `@ui.dict.searchable` are
parsed by moost-db's `AsValueHelpController` and emitted into the
`/meta` response. No additional client wiring is needed.
:::

## `@ui.type` — shared renderer override

`@ui.type "name"` flips the renderer type wherever the surface-specific
override (`@ui.form.type` / `@ui.table.type`) is missing. The value
must be one of the **built-in** type ids the form/cell type maps know
how to dispatch — `@ui.type` and `@ui.{form,table}.type` are reserved
for built-in renderers.

```atscript
@ui.type 'textarea'
notes: string                  // form renders textarea; table cell stays text
```

For **custom** renderers shared between forms and tables (currency,
status badge, rating, …), use `@ui.form.component` on the form side
and `@ui.table.component` on the table side. Both annotations look up
in their own `:components` map and are the dedicated mechanism for
hand-rolled widgets.

## `@meta.*` and `@expect.*` — read by the table

These come from atscript core; the table reads a small subset.

| Annotation                        | Effect on the table                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `@meta.id`                        | Marks the primary key. Surfaces in `tableDef.primaryKeys`; drives action POSTs, `__remove` and row addressing.            |
| `@meta.label "..."`               | Column header text. Falls back to a humanised path when absent.                                                           |
| `@meta.description "..."`         | Tooltip text on the header cell.                                                                                          |
| `@expect.maxLength N`             | Used to derive the default column width when `@ui.table.width` is absent. The longer the max, the wider the column.       |
| `optional` (atscript syntax `?:`) | Sets `ColumnDef.nullable = true`. The filter dialog's operator picker shows `null` / `notNull` only for nullable columns. |

```atscript
@meta.id
@db.default.increment
id: number

@meta.label 'Product Name'
@expect.maxLength 80
name: string

description?: string
```

See [atscript.dev annotations](https://atscript.dev/packages/typescript/annotations)
for the full `@meta.*` / `@expect.*` reference.

## `@db.*` — read indirectly (and a couple directly)

Most `@db.*` annotations belong to the [atscript-db skill](https://db.atscript.dev),
but several flow back into the table either through the `/meta`
response or by direct introspection of the column's atscript type.

| Annotation                      | Read by                       | What it does for the table                                                                                                                           |
| ------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@db.table 'name'`              | server (`/meta`)              | Makes the interface a DB table; required for moost-db to serve it.                                                                                   |
| `@db.http.path '/...'`          | server                        | Mounts the moost-db controllers under a custom HTTP path — `<AsTableRoot url="..."`> points here.                                                    |
| `@db.index.fulltext 'name'`     | server (`/meta`)              | Adds a full-text search index. `tableDef.searchable` becomes `true`; the search box drives `controls.$search`.                                       |
| `@db.index.plain 'name'`        | server (`/meta`)              | Surfaces the column as filterable / sortable (in combination with `@db.column.*` / `@db.table.*` flags). Powers the column menu's _Sort_ / _Filter_. |
| `@db.index.unique 'name'`       | server (`/meta`)              | Same as above; also flagged in relation metadata.                                                                                                    |
| `@db.rel.FK`                    | client (`extractValueHelp`)   | Marks a column as a foreign key. Cell type becomes `ref`; the filter dialog opens a value-help picker against the referenced table.                  |
| `@db.json`                      | server                        | Stores the field as opaque JSON. Sub-paths are NOT auto-flattened into columns — the cell shows the JSON via `AsCellJson`.                           |
| `@db.amount.currency 'EUR'`     | client (`extractMeasurement`) | Literal currency code; `AsCellNumber` formats with `Intl.NumberFormat` for that currency.                                                            |
| `@db.amount.currency.ref 'fld'` | client                        | Sibling-field reference — currency comes from another column on the same row.                                                                        |
| `@db.unit 'kg'`                 | client                        | Literal unit-of-measure suffix on numeric cells.                                                                                                     |
| `@db.unit.ref 'fld'`            | client                        | Sibling-field unit reference.                                                                                                                        |
| `@db.column.precision p, s`     | client                        | Decimal precision/scale — `AsCellNumber` honours the second arg as fraction-digit count.                                                             |

::: info Where to learn more

- The DB / table / column / index / relation annotations:
  [db.atscript.dev/api/tables](https://db.atscript.dev/api/tables) and
  [db.atscript.dev/relations](https://db.atscript.dev/relations).
- The `/meta` HTTP response shape:
  [db.atscript.dev/http/crud](https://db.atscript.dev/http/crud).
  :::

## Putting it together

A realistic column annotated for the table:

```atscript
@db.table 'invoices'
export interface InvoicesTable {
    @meta.id
    @db.default.increment
    id: number

    @meta.label 'Invoice #'
    @ui.table.order 1
    @ui.table.width "8em"
    @db.index.unique 'invoice_no_idx'
    number: string

    @meta.label 'Customer'
    @ui.table.order 2
    @db.rel.FK
    customerId: Customer.id

    @meta.label 'Status'
    @ui.table.order 3
    @ui.table.fn.classes "status === 'paid' ? 'text-success' : ''"
    status: 'draft' | 'sent' | 'paid' | 'overdue'

    @meta.label 'Amount'
    @ui.table.order 4
    @db.column.precision 12, 2
    @db.amount.currency.ref 'currency'
    amount: number

    currency: 'USD' | 'EUR' | 'GBP'

    @meta.label 'Issued'
    @ui.table.type 'date'
    @db.default.now
    issuedAt: number
}
```

That single declaration drives:

- Column order (`@ui.table.order`), labels (`@meta.label`).
- A fixed-width `Invoice #` column (`@ui.table.width`).
- A FK lookup against `Customer` rendering the customer's
  `@ui.dict.label` (`@db.rel.FK`).
- A coloured status badge per row (`@ui.table.fn.classes`).
- A currency-formatted amount that reads the currency from a sibling
  cell (`@db.amount.currency.ref` + `@db.column.precision`).
- A date renderer for `issuedAt` (`@ui.table.type 'date'`).

## Next steps

- [Query Function](/tables/query-function) — how `/meta` and CRUD wire
  up, and how to bring your own data fetcher.
- [Filtering](/tables/filtering) — the filter model that consumes
  `filterable` / `nullable` / `options` / `valueHelpInfo`.
- [Cells](/tables/cells) — the default cell components and how to plug
  in your own.
