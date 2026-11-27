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
- **Next to the field.** A bound field of a
  [namespace](/forms/nested-objects#section-or-namespace) object
  (`shipping: Address`, rendered inline) reads its host value from its own
  sibling: `Address.country` is `shipping.country` there, not the form's
  `country`. Its fills land next to it too.
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
(`@ui.valueHelp.fill 'country', 'country'`), or the member is one of the
binding's [columns](#columns-tell-rows-apart) — and on a dropdown
(`@ui.form.type 'select'` or `'radio'`) in any case, since it commits a value,
not a row. While it has a value, the
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
- A fill whose field the form does not have (a view without it, a field the
  served type leaves out), or holds as derived or a navigation, is skipped:
  no key is written. The compiler warns for the last two.
- A read-only field is written (since 0.1.191). This is the usual text next
  to a code: a `customerName` the server computes next to `customerId` shows
  the picked row's name. The user still cannot edit it. The form's patch
  sends it like any value the app sets, and a backend that computes the
  field ignores or drops it.
- A filled field that has fills of its own does not pick again: fills do not
  cascade.
- A field can be both a host value and a fill target (`country` above): an
  empty country lists every city, and a pick sets it.
- In the combobox and the picker dialog, the fills come from the row the user
  picked, also where the committed value repeats (a city keyed by `country` +
  `id`: two countries may have the same `id`). Picking another row with the
  value the field already holds is a pick too, and writes that row's fields
  (since 0.1.191). A dropdown lists values, not rows: a value several rows
  hold is committed without fills (see
  [A dropdown from a dictionary](#a-dropdown-from-a-dictionary)).

The compiler checks that `local` is a top-level scalar field of the host (not
the bound field), that `targetField` is a top-level scalar field of the
dictionary, and that their types match. An `annotate` entry that replaces the
binding re-checks the field's fills and columns against the new dictionary.
Fills are refused on a field of an inline structure and in an `annotate … as`
copy. The editor completes `local` with the host's fields and `targetField`
with the dictionary's.

::: warning Changed in 0.1.191
A pick writes a `@meta.readonly` fill target, and the compiler no longer
warns about one. Before 0.1.191 the pick skipped it, so a read-only text next
to the code went stale. A `@db.column.derived` target is still never written.
:::

### Clearing filled fields

The picker's × (and the empty option of a [dropdown](#a-dropdown-from-a-dictionary))
also clears the fields this field's **last pick** filled — each only while it
still holds what that pick wrote, and never one the binding reads as a host
value. Clearing writes `undefined`. A field the user changed since keeps its
value; resets, loaded records and other fields' fills clear nothing.

## Dialog columns: `@ui.valueHelp.column`

_Since 0.1.190._ `@ui.valueHelp.column 'field'` (repeat per column) sets the
columns of the binding's picker dialogs — the table's filter dialog and the
form's [picker dialog](#a-picker-dialog-asrefpicker) — to exactly these
dictionary fields, in this order, instead of the dictionary's key / label /
description view. The combobox and the dropdown keep key, label
and description; the combobox also shows the key members listed as columns
next to each key (see [Columns tell rows apart](#columns-tell-rows-apart)).
Like fills, columns belong to the field's own binding (or FK
help); unlike fills, they travel with the binding through references.

```atscript
@ui.valueHelp City, 'id'
@ui.valueHelp.column 'id'
@ui.valueHelp.column 'name'
@ui.valueHelp.column 'region'
city?: string
```

A column the served dictionary does not have (a field hidden from the
caller) is left out of the dialog.

### Columns tell rows apart

_Since 0.1.191._ When the committed field is one member of a composite key,
the compiler warns that values may repeat in the picker unless the other
members are pinned. A member listed as a column of the binding counts too:
the picker shows it, so the user can tell the rows apart. The picker dialog
shows it as a column, and the combobox shows its value next to each row's
key (`1000 · A1`, `1000 · B2`). Columns that are no key members stay in the
dialog.

```atscript
export interface Order {
    @ui.valueHelp CostCenter, 'id'
    @ui.valueHelp.column 'controllingArea'
    @ui.valueHelp.column 'id'
    @ui.valueHelp.column 'name'
    costCenter?: string
}
```

Here `CostCenter` is keyed by `controllingArea` + `id`. Two controlling areas
may use the same `id`, and the `controllingArea` column tells their rows
apart. A pick commits from the row picked, and fills from it too. The
column makes the pick unambiguous, not the stored record: only the committed
field is stored, so a reopened list marks no row unless a fill or a host
reference writes the other member back. A dropdown
(`@ui.form.type 'select'` or `'radio'`) shows no columns, so it keeps the
warning. Other ways to satisfy the rule are a literal pin in the filter and
a [host field a fill writes back](#values-of-the-form-narrow-the-picker).

::: warning Changed in 0.1.191
A composite-key member listed as a `@ui.valueHelp.column` no longer draws the
"values may repeat" warning, and the combobox shows its value next to each
row's key. Before 0.1.191 only a literal pin or a host field a fill writes
back from the picked row satisfied the rule, and the combobox showed the
committed value alone.
:::

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
- A value several rows hold (a dictionary keyed by more fields than the
  committed one) is committed without fills: an option is a value, not a row.
  What the previous choice filled is cleared as the × clears it, so no stale
  text stays next to the new value.
- A field with options of its own (a literal union, `@ui.form.options`) lists
  those, with its placeholder, not the dictionary.

In the table's filter bar, a dictionary column with `@ui.type 'select'` picks
from a checklist of the dictionary's values instead of the dictionary table —
see [Value-help filters](/tables/filtering#value-help-filters).

For union labels see [Union labels](/tables/filtering#union-labels); for
distinct-value filters, [Distinct values](/tables/filtering#distinct-values).

## A picker dialog: `AsRefPicker`

_Since 0.1.190._ For a dictionary too large to browse in a list, register
`AsRefPicker` from `@atscript/vue-table` for the `ref` type. It is the
reference field plus a button after the input and a **See all** entry under
its list; both open `AsValueHelpDialog`, the dictionary as a table.

```ts
import { createDefaultTypes } from "@atscript/vue-form";
import { AsRefPicker } from "@atscript/vue-table";

const types = { ...createDefaultTypes(), ref: AsRefPicker };
```

- **The field's binding.** The dialog shows the binding's
  [columns](#dialog-columns-ui-valuehelp-column) as declared (else the
  dictionary's key, label and description, without a key member a host value
  pins while it has a value), in the field's scope — the filter with the
  form's [host values](#values-of-the-form-narrow-the-picker). Its query selects what every
  value-help read selects (the committed field, the columns, the fill
  targets). Search, filters, sorting and paging work as in any table.
- **One pick path.** Enter or a double-click picks a row: the dialog hands it
  to the field's `selectItem`, so the value is committed, the
  [fills](#a-pick-fills-other-fields-ui-valuehelp-fill) are written from that
  row and the field validates — as for a pick from the list. The dialog
  closes.
- **See all** carries the typed text into the dialog's search. It shows
  however many rows match (no count is asked for). Limitation: a dictionary
  without full-text search has no search box in the dialog, so the text is
  not carried; its filters are.
- A disabled or read-only field shows neither the button nor the entry.

The dialog is a component of its own: a custom picker opens it with the
field's `selectItem`, `scope` and client factory, which `AsRef`'s `trailing`
slot (after the input) and `list-end` slot (under the list) hand over —
see the [vue-table API](/api/vue-table#asvaluehelpdialog).

## A code with its text: `@ui.valueLabel`

_Since 0.1.190._ `@ui.valueLabel 'field'` shows the field's value — a code —
together with its text, read from a string field of the same interface.

```atscript
export interface Office {
    @ui.valueHelp City, 'code'
    @ui.valueHelp.fill 'cityName', 'name'
    @ui.valueLabel 'cityName'
    city?: string

    cityName?: string
}
```

| Arrangement (2nd argument) | Shows          |
| -------------------------- | -------------- |
| `'textKey'` (default)      | `Berlin (BER)` |
| `'keyText'`                | `BER (Berlin)` |
| `'text'`                   | `Berlin`       |

- **Where.** Table cells, [export](/tables/export#cell-values), read-only form
  fields, and the reference field while it is not focused — focused, it shows
  the code, to search from. An empty text shows the code alone.
- **The value stays the code.** Sorting and filtering use the code; filter
  chips show the code.
- **Keep the text current.** On a bound field, let the pick fill the text
  (`@ui.valueHelp.fill`): the compiler warns when no fill writes it, since the
  text would go stale after a pick. A `@meta.readonly` text, one the server
  computes, is filled too (since 0.1.191), so the label shows the picked text
  at once.
- The text field is a sibling in the declaring interface, so the annotation is
  not passed through references.

The compiler checks that the text field exists, is a string and is not the
field itself, and refuses `@ui.valueLabel` next to `@ui.literalLabel`. The
editor completes the text field with the string fields of the interface
(inherited ones included) and jumps to it.

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
  validates the field (`selectItem`) — with the row picked, never one looked
  up by its value. The list marks the row picked (`data-state="checked"`),
  not every row that holds its value (since 0.1.191).
- A read-only reference field opens no list (since 0.1.190).
- Loading and empty-state slots; since 0.1.190 a `trailing` slot after the
  input and a `list-end` slot under the list (`AsRefPicker` fills them).

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

The picker's root (`as-ref-root`) is a flex row — the input, then what the
`trailing` slot adds — instead of a block; a style override that set
`display` on it, or on `as-ref-anchor`, may need a look.
:::

## Cross-references

- Server-side relation metadata — [db.atscript.dev/relations](https://db.atscript.dev/relations)
- Query controls (`$search`, `$select`, `$limit`, filters) —
  [db.atscript.dev/api/queries](https://db.atscript.dev/api/queries)
- Building the target's REST controller — [db.atscript.dev/moost-db](https://db.atscript.dev/moost-db)

## Next steps

- [Customization](/forms/customization) — swap `AsRef` for your own picker,
  or for `AsRefPicker` (a picker dialog)
- [Validation](/forms/validation) — error messages for required FKs
- [Locale & currency](/forms/locale) — formatting nearby decimal columns
