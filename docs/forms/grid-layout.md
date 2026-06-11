# Grid Layout

Every `AsObject` is a 12-column CSS grid. By default every field takes the full
row (`col-span-12`). Two annotations override that:

- `@ui.form.grid.colSpan` — column footprint
- `@ui.form.grid.rowSpan` — row footprint

Layouts are container-query driven: the grid container declares
`container-name: as-grid`, and a built-in `as-narrow:` variant kicks in when the
container measures `<= 480px` wide. Fields collapse to full-width on a narrow
container regardless of their desktop span.

## Quick example

```atscript
export interface AddressForm {
    @meta.label 'First name'
    @ui.form.grid.colSpan '6'
    firstName: string

    @meta.label 'Last name'
    @ui.form.grid.colSpan '6'
    lastName: string

    @meta.label 'City'
    @ui.form.grid.colSpan '4'
    city: string

    @meta.label 'State'
    @ui.form.grid.colSpan '4'
    state: string

    @meta.label 'ZIP'
    @ui.form.grid.colSpan '4'
    zip: string
}
```

Renders as two rows: half/half on the first, third/third/third on the second.
Drop the container below 480px and every field stacks vertically.

## Accepted values

`colSpan` accepts numeric strings `'1'`..`'12'` plus three aliases:

| Alias     | Columns |
| --------- | ------- |
| `'full'`  | 12      |
| `'half'`  | 6       |
| `'third'` | 4       |

`rowSpan` accepts positive numeric strings (`'1'`, `'2'`, `'3'`, …). There are
no aliases for rows.

Invalid values (`'0'`, negatives, decimals, unknown aliases) silently fall back
to the default. See `packages/ui/src/form/grid.ts` for the parser.

## Responsive override

Both annotations take an optional second argument for the narrow breakpoint:

```atscript
@meta.label 'Discount %'
@ui.form.grid.colSpan '4', '6'
discount: number
```

- `'4'` = one-third on desktop (4 of 12 columns, so 3 fields per row).
- `'6'` = half-width on narrow containers.

If the narrow argument is omitted, narrow defaults to `'12'` (full-width). You
do not need to write `'6', '12'` — the auto-stack already handles that case.

## Row span

Stretches a field across multiple grid rows so neighbours flow into the freed
slots instead of wrapping below:

```atscript
@meta.label 'Bio'
@ui.type 'textarea'
@ui.form.grid.colSpan '6'
@ui.form.grid.rowSpan '2'
bio: string

@meta.label 'Nickname'
@ui.form.grid.colSpan '6'
nickname: string

@meta.label 'Website'
@ui.form.grid.colSpan '6'
website: string
```

`bio` occupies the left half over two rows; `nickname` and `website` stack into
the right half of those rows.

## Container queries, not viewport queries

The `as-narrow:` variant compiles to:

```css
@container as-grid (max-width: 480px) { ... }
```

The grid container is registered via the `as-form-grid` shortcut. This means a
nested `AsObject` inside a half-width parent re-checks its own width — an
optional struct at `colSpan '6'` whose inner grid contains a `colSpan '6'`
child will auto-stack on a desktop viewport, because its own container is
narrower than 480px:

```atscript
@meta.label 'Address'
@ui.form.grid.colSpan '6'
address?: {
    @meta.label 'Street'
    street: string

    @meta.label 'City'
    @ui.form.grid.colSpan '6'
    city: string

    @meta.label 'ZIP'
    @ui.form.grid.colSpan '6'
    zip: string
}
```

The outer half is still side-by-side with another field; the inner `city/zip`
pair stacks because their container is narrow enough.

## How spans translate to classes

`packages/ui/src/form/grid.ts:buildGridClasses` emits a UnoCSS class string per
field:

| Desktop span | Narrow span | Generated classes                                |
| ------------ | ----------- | ------------------------------------------------ |
| `'6'`        | (default)   | `col-span-6` (narrow falls back to full)         |
| `'4'`        | `'6'`       | `col-span-4 as-narrow:col-span-6`                |
| `'6'`        | `'12'`      | `col-span-6` (no narrow class — `12` is default) |

`col-span-1`..`col-span-12` and `row-span-1`..`row-span-6` are pre-safelisted by
`@atscript/ui-styles`, so adding arbitrary spans never requires preset edits.

## Real-world annotations

A typical `Product.as` table schema:

```atscript
@db.table 'products'
export interface ProductsTable {
    @meta.label 'Name'
    @ui.form.grid.colSpan 'half'
    name: string

    @meta.label 'SKU'
    @ui.form.grid.colSpan 'half'
    sku: string

    @meta.label 'Category'
    @db.rel.FK
    @ui.form.grid.colSpan 'half'
    categoryId: CategoriesTable.id

    @meta.label 'Price'
    @db.amount.currency 'USD'
    @db.column.precision 10, 2
    @ui.form.grid.colSpan 'half'
    price: decimal
}
```

And a nested-grid example from `Customer.as`:

```atscript
@db.table 'customers'
export interface CustomersTable {
    @meta.label 'Address'
    @db.json
    address: {
        street: string

        @ui.form.grid.colSpan 'third'
        city: string

        @ui.form.grid.colSpan 'third'
        state: string

        @ui.form.grid.colSpan 'third'
        zip: string

        country: string
    }
}
```

`street` and `country` get default full rows; `city`/`state`/`zip` form a
three-column band in between.

## Combining with `@ui.form.hidden`

Hidden fields render with `display: none` — the grid cell is released and
following fields reflow into the gap. The field stays mounted and keeps its
value in the form data; hiding never clears anything.

To swap fields in and out without disturbing a balanced band, toggle a pair of
fields with matching spans via `@ui.form.fn.hidden` (see
[Dynamic fields](/forms/dynamic-fields)) — one shows while the other hides, so
the band's total span stays constant.

## Next steps

- [Nested objects](/forms/nested-objects) — every nested struct is its own grid
- [Arrays](/forms/arrays) — array items use the item's own field-level grid
- [Dynamic fields](/forms/dynamic-fields) — combine grid with `@ui.form.fn.hidden`
