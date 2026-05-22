import { CategoriesTable } from './categories'
import { UsersTable } from './users'

@db.table 'products'
@db.table.preferredId.uniqueIndex 'products_sku_idx'
export interface ProductsTable {
    @meta.id
    @db.default.increment
    id: number

    @meta.label 'Name'
    @db.index.fulltext 'products_search'
    @ui.form.grid.colSpan 'half'
    name: string

    @meta.label 'SKU'
    @db.index.unique 'products_sku_idx'
    @ui.form.grid.colSpan 'half'
    sku: string

    @meta.label 'Description'
    @db.index.fulltext 'products_search'
    description?: string

    @meta.label 'Category'
    @db.rel.FK
    @ui.form.grid.colSpan 'half'
    categoryId: CategoriesTable.id

    @meta.label 'Created By'
    @db.rel.FK
    @ui.form.grid.colSpan 'half'
    createdById: UsersTable.id

    @meta.label 'Price'
    @db.amount.currency 'USD'
    @db.column.precision 10, 2
    @db.column.measure
    @db.index.plain 'products_price_idx'
    @ui.form.grid.colSpan 'half'
    price: decimal

    @meta.label 'Weight'
    @db.unit 'kg'
    @db.column.precision 6, 2
    @ui.form.grid.colSpan 'half'
    weight?: decimal

    @meta.label 'Tags'
    @ui.form.label.singular 'tag'
    tags: string[]

    @meta.label 'Published At'
    publishedAt?: number.timestamp

    @meta.label 'Created'
    @db.default.now
    createdAt: number.timestamp

    @meta.label 'Version'
    @db.column.version
    version: number.int
}
