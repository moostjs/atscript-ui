# References (FK)

A foreign-key field — a customer id on an order, a category id on a product —
renders as a **value-help picker**: a searchable combobox backed by the target
table's own metadata. atscript-ui resolves everything from two annotations on
the field plus a couple of dictionary hints on the target type.

## The annotations

The shape comes from `.as` schemas (see
[atscript-db relations](https://db.atscript.dev/relations)).

```atscript
import { CustomersTable } from './Customer.as'
import { ProductsTable } from './Product.as'

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
`ValueHelpClient` (`packages/ui/src/value-help/value-help-client.ts`).

## How the picker resolves the target

`ValueHelpClient` is a thin wrapper around a `Client` from `@atscript/db-client`
that:

1. Fetches the target type's `@db.http.path` metadata once and caches it.
2. Queries the target with `$select` scoped to PK + label + (optional) descr.
3. On search, sends `$search` to a `@db.index.fulltext` target, or builds an
   `$or` regex filter for non-searchable targets, plus an exact-PK match.
4. Honours `$limit` (default 20).

The client is created lazily and shared by every ref field in the form — see
the `clientFactory` provide in `packages/vue-form/src/components/as-form.vue`.

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

const clientFactory: ClientFactory = (url) =>
  new Client(url, {
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
  (url) =>
    new Client(url, {
      /* auth */
    }),
);
```

Per-form `clientFactory` props override the default. Both fall back to the
built-in `new Client(url)` factory when unset.

## Picker UX

The default `AsRef` component is a Reka-ui Combobox with:

- Inline text search (debounced; `$search` for fulltext targets, `$or` regex
  fallback for non-searchable ones).
- Keyboard-navigable list of results (`data-highlighted` / `data-state` driven
  by Reka).
- Display of `@ui.dict.label` plus a faint secondary `@ui.dict.descr` line.
- Clear button to reset the FK to `null`.
- Loading and empty-state slots.

For deeper customisation (column layout, filters, mini-tables) swap the `ref`
entry in the types map — see [Customization](/forms/customization).

## Cross-references

- Server-side relation metadata — [db.atscript.dev/relations](https://db.atscript.dev/relations)
- Query controls (`$search`, `$select`, `$limit`, filters) —
  [db.atscript.dev/api/queries](https://db.atscript.dev/api/queries)
- Building the target's REST controller — [db.atscript.dev/moost-db](https://db.atscript.dev/moost-db)

## Next steps

- [Customization](/forms/customization) — swap `AsRef` for your own picker
- [Validation](/forms/validation) — error messages for required FKs
- [Locale & currency](/forms/locale) — formatting nearby decimal columns
