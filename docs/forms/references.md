# References (FK)

A foreign-key field — a customer id on an order, a category id on a product —
renders as a **value-help picker**: a searchable combobox backed by the target
table's own metadata. atscript-ui resolves everything from two annotations on
the field plus a couple of dictionary hints on the target type.

## The annotations

The shape comes from `.as` schemas (see
[atscript-db relations](https://db.atscript.dev/relations)).

```atscript
import { CustomersTable } from './Customer'
import { ProductsTable } from './Product'

@db.table 'orders'
export interface OrdersTable {
    @meta.id
    @db.default.increment
    id: number

    @meta.label 'Customer'
    @db.rel.FK
    customerId: CustomersTable.id

    @meta.label 'Product'
    @db.rel.FK
    productId: ProductsTable.id

    @meta.label 'Quantity'
    quantity: number
}
```

- `@db.rel.FK` plus `CustomersTable.id` declares the foreign-key relationship.
- The target type (`CustomersTable`) carries `@db.http.path '/api/customers'`
  in its own definition so the form knows where to query.

When `<AsField>` resolves to a FK field it routes through the `ref` entry in
your types map — by default `AsRef`, a Reka-ui Combobox driven by a
[`ValueHelpClient`](/api/ui#valuehelpclient).

## Reference chains

A field does not have to point straight at the dictionary. A view field is
often declared against an intermediate table — `errorCode: Issue.errorCode`,
where `Issue.errorCode: ErrorCode.code` is the link that actually carries
`@db.rel.FK`:

```atscript
@db.view
export interface IssueView {
    /// No `@db.rel.FK` here — the FK lives one hop down, on `Issue.errorCode`.
    errorCode: Issue.errorCode
}
```

_Since 0.1.134_ the UI follows such chains: `extractValueHelp(prop)` walks
`prop.ref` → the referenced field → its own `ref` until it finds a link that
carries `@db.rel.FK` **and** whose target declares `@db.http.path`, so the
picker targets the dictionary (`ErrorCode`) rather than losing its value help.
The walk is depth-bounded and cycle-safe; a chain that never reaches an FK link
simply yields no value help.

The server does the same on its side: since `@atscript/db` 0.1.128 `/meta` and
`/meta/form/:name` serialize such a view field with `ref` pointing at the
**terminal** field and `db.rel.FK: true` lifted onto the field. So a form built
from a compiled `.as` type and one built from `/meta` resolve to the same
dictionary.

## How the picker resolves the target

`ValueHelpClient` is a thin wrapper around a `Client` from `@atscript/db-client`
that:

1. Fetches the target type's `@db.http.path` metadata once and caches it.
2. Queries the target with `$select` scoped to PK + label + (optional) descr —
   plus the committed field, the binding's [columns](#dialog-columns-ui-valuehelp-column)
   and [fill targets](#a-pick-fills-other-fields-ui-valuehelp-fill) (_since
   0.1.190_: one select rule for every value-help read, `valueHelpSelect`).
3. On search, sends `$search` to a `@db.index.fulltext` target, or builds an
   `$or` regex filter for non-searchable targets, plus an exact-PK match.
4. Honours `$limit` (default 20).
5. Shares identical searches on the same client (_since 0.1.151_): pickers
   mounting together send one request, and a result is reused for 5 s. Tune
   with `setValueHelpCacheTtl(ms)`; after writing a dictionary outside
   `<AsTable>` actions, call `invalidateValueHelpCache()` so pickers refetch at
   once. See the [API reference](/api/ui#setvaluehelpcachettl-ms-invalidatevaluehelpcache-client).

The client is created lazily and shared by every ref field in the form — pass
`<AsForm>`'s [`clientFactory`](/api/vue-form#asform) prop to build it your way.

## Binding without a foreign key: `@ui.valueHelp`

_Since 0.1.148._ A foreign key is a real constraint, and it needs a unique target
column. A dictionary keyed by `(attribute, value)` has none, and a view field
cannot point its `@db.rel.FK` at a second table without changing its column
source. `@ui.valueHelp` binds a field to a dictionary for the picker alone:
**no constraint, no query semantics, presentation only.**

```atscript
import { AttributeValue } from './attribute-value'

@db.view 'ticket_overview'
@db.view.for Ticket
export interface TicketOverview {
    @ui.valueHelp AttributeValue, 'value', `attribute = 'color'`
    color: Ticket.color

    @ui.valueHelp AttributeValue, 'value', `attribute = 'size' and active = true`
    size?: Ticket.size

    @ui.valueHelp Country, 'code'
    countryCode: Ticket.countryCode
}
```

| Argument | Meaning                                                                                                               |
| -------- | --------------------------------------------------------------------------------------------------------------------- |
| target   | The dictionary interface (a `@db.alias` is refused). Served by a moost-db controller; the controller stamps its path. |
| `field`  | A top-level scalar field of the target. The picker stores this field's value, and it must have the host field's type. |
| `filter` | Optional static scope, field-to-literal comparisons of the target only. AND'd into **every** picker query.            |

- **It wins over `@db.rel.FK`** on the field or on its chain, and it travels
  through chain refs and `extends` (the field's own annotation wins, nearest
  first). A binding whose target arrives without a path (an interface that is neither a
  `@db.table` / `@db.view` nor declares `@db.http.path`) is ignored and the FK
  walk runs. A `@db.table` / `@db.view` target needs no literal `@db.http.path`:
  its controller stamps the path at runtime.
- **Pinned fields are hidden.** A field the filter pins with `=`
  (`attribute = 'color'`) is constant inside the picker, so the table pickers
  drop its column and filter input.
- **The committed value is `field`**, never the label or the key head. The
  picker also fetches it when it is a unique non-key field, and the exact-match
  search runs on it.
- The same binding drives the form picker, the table's filter dialog and inline
  filter field, and workflow forms (the server sends the target's path with the
  form schema).
- The compiler checks the binding — target kind (a warning when the target is
  neither a `@db.table` / `@db.view` nor has `@db.http.path`), field
  existence and type, the filter's scope, repeating values and a
  manual-filterable target whose filter fields lack `@db.column.filterable`
  (the last two are warnings) — and the editor completes the target, the field
  and the filter. On `@ui.literalLabel` it completes the union's literals (`'true'` /
  `'false'` on a boolean) for the value and jumps from the value to the literal
  it names.

A custom picker that builds its own query passes `info.filter` and selects
`info.targetField` — see the [API reference](/api/ui#valuehelpinfo). In a form,
it passes `valueHelpScope(info, read).filter` instead, so the
[values of the form](#values-of-the-form-narrow-the-picker) apply too, and
`info` to `ValueHelpClient.search`, which then selects the columns and fill
targets as well.

## Values of the form narrow the picker

_Since 0.1.190._ A condition `targetField = Host.field` in the binding's filter
names a field of the form: `Host` is the interface that declares the bound
field (in an `annotate Host { … }` block, the annotated interface). The picker
filters the dictionary by that field's current value.

```atscript
export interface Customer {
    country?: string

    @ui.valueHelp City, 'id', `country = Customer.country and active = true`
    city?: string
}
```

- **Empty leaves it out.** While `country` is empty (`undefined`, `null`, `""`)
  the condition is dropped and the picker lists every active city. The value is
  sent as the form holds it.
- **A change re-scopes.** An open picker searches again at once (also for
  unchanged search text); a closed one on its next open. A value already picked
  that the new scope excludes stays until it is changed.
- **By name, wherever the binding goes.** The reference reads the sibling named
  `country` in every form the binding reaches — the declaring interface, an
  `extends`, a chain reference (`city: Customer.city`), a view column. A form
  without that sibling gets the wider picker.
- **Forms only.** The table's filter bar shows the unscoped list: table
  filters never read host values. `ValueHelpInfo.filter` holds only the
  literal comparisons; the host references are in `ValueHelpInfo.hostFilter`.

The compiler accepts a host reference only as a **top-level `and` condition
`targetField = Host.field`** whose `field` is an existing scalar field of the
host (declared or inherited; not an object, an array, `@db.json` or a
navigation) of the same type as `targetField`, and not the bound field
itself. A host reference under `or` / `not`, with another operator, on the
left side, on a field of an inline structure, or in an `annotate … as` copy is
a compile error. The editor offers the host interface after the operator and
its fields after `Host.`, and go-to-definition and hover work on them. A
dictionary bound from its own interface (`manager` of `Employee` picking from
`Employee`) works: the right-hand side is the host.

A composite-key member a host reference pins (`country` of a city keyed by
`country` + `id`) is pinned only while the host field has a value: an empty
one lists the ids of every country. So the compiler keeps its "values may
repeat" warning unless a fill writes the host field back from the picked row
(`@ui.valueHelp.fill 'country', 'country'`). While it has a value, the
scope lists it in `pinned` (`useAsValueHelp().scope`), so a custom picker can
hide it.

## A pick fills other fields: `@ui.valueHelp.fill`

_Since 0.1.190._ `@ui.valueHelp.fill 'local', 'targetField'` writes the picked
row's `targetField` into the sibling field `local`. Repeat it per field.

```atscript
export interface Customer {
    country?: string

    @ui.valueHelp City, 'id', `country = Customer.country`
    @ui.valueHelp.fill 'cityName', 'name'
    @ui.valueHelp.fill 'country', 'country'
    city?: string

    cityName?: string
}
```

- Each write is an edit, as if the user had typed it: change tracking sees
  it, the field validates, and `<AsForm>` emits `change`. A value the field
  already holds is not written again.
- Fills apply to the field's **own** binding — its `@ui.valueHelp`, else its
  `@db.rel.FK` help. A binding the field only gets through its type or a chain
  reference takes no fills (the names are siblings of the declaring
  interface), and fills are not passed through references. `extends` keeps
  them.
- A fill whose field the form does not have, or holds as derived, read-only
  or a navigation, is skipped (the compiler warns for the last three).
- A filled field that has fills of its own does not pick again: fills do not
  cascade.
- A field can be both a host value and a fill target (`country` above): an
  empty country lists every city, and a pick sets it.

The compiler checks that `local` is a top-level scalar field of the host (not
the bound field), that `targetField` is a top-level scalar field of the
dictionary, and that their types match. An `annotate` entry that replaces the
binding re-checks the field's fills and columns against the new dictionary.
Fills are refused on a field of an inline structure and in an `annotate … as`
copy. The editor completes `local` with the host's fields and `targetField`
with the dictionary's.

### Clearing filled fields

The picker's × (and the empty option of a [dropdown](#a-dropdown-from-a-dictionary))
also clears the fields this field's **last pick** filled — each only while it
still holds what that pick wrote, and never one the binding reads as a host
value. Clearing writes `undefined`. A field the user changed since keeps its
value; resets, loaded records and other fields' fills clear nothing.

## Dialog columns: `@ui.valueHelp.column`

_Since 0.1.190._ `@ui.valueHelp.column 'field'` (repeat per column) sets the
columns of the binding's picker dialogs — the table's filter dialog — to
exactly these dictionary fields, in this order, instead of the dictionary's
key / label / description view. The combobox and the dropdown keep key, label
and description. Like fills, columns belong to the field's own binding (or FK
help); unlike fills, they travel with the binding through references.

```atscript
@ui.valueHelp City, 'id'
@ui.valueHelp.column 'id'
@ui.valueHelp.column 'name'
@ui.valueHelp.column 'region'
city?: string
```

## A dropdown from a dictionary

_Since 0.1.190._ `@ui.form.type 'select'` (or `'radio'`, or `@ui.type`) on a
bound field with no options of its own lists the dictionary's values instead
of a search picker: one read in the binding's scope (host values included),
with the usual select. Each option shows the label (the key when it has none)
and the description; the stored value is the committed field. Use it for small
dictionaries.

```atscript
@ui.form.type 'select'
@ui.valueHelp AttributeValue, 'value', `attribute = 'color'`
@ui.valueHelp.fill 'colorLabel', 'label'
color?: string
```

- A choice goes through the same pick path as the picker, so fills apply.
- The dropdown starts with an empty option; choosing it empties the field as
  the picker's × does and clears what the last choice filled.
- A changed host value reads the list again.
- More than 200 values (`VALUE_HELP_OPTIONS_CAP`) is too many for a dropdown:
  the field falls back to the search picker (the `ref` entry of the types
  map), with one warning in development.
- A value the list does not hold stays and shows as it is stored.

In the table's filter bar, a dictionary column with `@ui.type 'select'` picks
from a checklist of the dictionary's values instead of the dictionary table —
see [Value-help filters](/tables/filtering#value-help-filters).

For union labels see [Union labels](/tables/filtering#union-labels); for
distinct-value filters, [Distinct values](/tables/filtering#distinct-values).

## Controlling display with `@ui.dict.*`

The target type's dictionary annotations decide what the picker shows for each
row.

```atscript
@db.table 'customers'
@db.http.path '/api/customers'
export interface CustomersTable {
    @meta.id
    id: number

    @ui.dict.label
    @db.index.fulltext 'customers_search'
    name: string

    @ui.dict.descr
    email: string

    @ui.dict.attr
    region: string

    @ui.dict.attr
    tier: 'gold' | 'silver' | 'bronze'
}
```

| Annotation            | Picker behaviour                                                |
| --------------------- | --------------------------------------------------------------- |
| `@ui.dict.label`      | Primary text shown for each row                                 |
| `@ui.dict.descr`      | Secondary text under the label                                  |
| `@ui.dict.attr`       | Extra columns shown in the expanded mini-table view             |
| `@ui.dict.searchable` | Forces the picker to send `$search` even without fulltext index |
| `@ui.dict.filterable` | Field appears in the picker's filter dialog                     |
| `@ui.dict.sortable`   | Field appears in the picker's sort options                      |

Without `@ui.dict.label`, the picker falls back to the primary-key column —
useable but not pretty.

See [atscript-db queries](https://db.atscript.dev/api/queries) for the server
side of `$search`, `$select`, `$limit`, and `$or` filter syntax.

## Authenticated fetches: `clientFactory`

The default `clientFactory` builds a plain `Client(url)` — no auth headers. To
inject a session token (or any other transport concern) pass a `clientFactory`
prop to `<AsForm>` (or `<AsWfForm>`):

```vue
<script setup lang="ts">
import { AsForm, type ClientFactory } from "@atscript/vue-form";
import { Client } from "@atscript/db-client";

const clientFactory: ClientFactory = (url, options) =>
  new Client(url, {
    ...options,
    fetch: (req) => fetch(req, { headers: { Authorization: `Bearer ${getToken()}` } }),
  });
</script>

<template>
  <AsForm :def="def" :form-data="formData" :types="types" :client-factory="clientFactory" />
</template>
```

For an app-wide default, call `setDefaultClientFactory` once at startup:

```typescript
import { setDefaultClientFactory } from "@atscript/vue-form";

setDefaultClientFactory(
  (url, options) =>
    new Client(url, {
      ...options,
      /* auth */
    }),
);
```

Per-form `clientFactory` props override the default. Both fall back to the
built-in `new Client(url, options)` factory when unset. Spread the second
argument into the `Client` options (since 0.1.153): it carries the
library's `metaKey` / `metaStore` requests — see
[Client factory](/api/ui#client-factory).

## Picker UX

The default `AsRef` component is a Reka-ui Combobox with:

- Inline text search (debounced; `$search` for fulltext targets, `$or` regex
  fallback for non-searchable ones).
- Keyboard-navigable list of results (`data-highlighted` / `data-state` driven
  by Reka).
- Display of `@ui.dict.label` plus a faint secondary `@ui.dict.descr` line.
- A clear button (×) that clears the field's value and the search text —
  shown while the field has a value or search text, never on a disabled or
  read-only field. Focus returns to the input. It also clears what the last
  pick [filled](#clearing-filled-fields).
- One pick path: a pick commits the value, writes the binding's fills and
  validates the field (`selectItem`).
- Loading and empty-state slots.

For deeper customisation (column layout, filters, mini-tables) swap the `ref`
entry in the types map — see [Customization](/forms/customization).

### Clearing a reference

The × empties the field as emptying an input does
([Emptied inputs](/forms/validation#emptied-inputs)):

- **Optional reference** — unset (`undefined`). The input stays while focus
  is in it; once focus leaves, the field shows its "Not set" placeholder.
  With [change tracking](/forms/change-tracking), clearing a stored value is
  a change (the patch sends `null`), and clearing a value the stored row
  never had leaves the form clean.
- **Required reference** — `""` for a string key, `null` for any other key
  (a number id, say). Never its `@meta.default`: the field stays empty. A
  `@meta.required` string key shows its required error, a number key its
  type error, by the field's usual
  [validation timing](/forms/validation#when-does-validation-fire) — and
  the form cannot be submitted until a reference is picked.

::: warning Changed in 0.1.177
Before 0.1.177 the × only emptied the search text; the selected reference
stayed in the form data.
:::

::: warning Changed in 0.1.190
A pick now validates the field and marks it touched at once (the form emits
`change` for it), not on the next blur. Before 0.1.190 the combobox wrote the
value straight into the model and the field validated when focus left.
:::

## Cross-references

- Server-side relation metadata — [db.atscript.dev/relations](https://db.atscript.dev/relations)
- Query controls (`$search`, `$select`, `$limit`, filters) —
  [db.atscript.dev/api/queries](https://db.atscript.dev/api/queries)
- Building the target's REST controller — [db.atscript.dev/moost-db](https://db.atscript.dev/moost-db)

## Next steps

- [Customization](/forms/customization) — swap `AsRef` for your own picker
- [Validation](/forms/validation) — error messages for required FKs
- [Locale & currency](/forms/locale) — formatting nearby decimal columns
