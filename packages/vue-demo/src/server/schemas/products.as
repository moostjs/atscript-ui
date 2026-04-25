import { CategoriesTable } from './categories'
import { UsersTable } from './users'

@db.table 'products'
export interface ProductsTable {
    @meta.id
    @db.default.increment
    id: number

    @meta.label 'Name'
    @db.index.fulltext 'products_search'
    name: string

    @meta.label 'Description'
    @db.index.fulltext 'products_search'
    description?: string

    @meta.label 'Category'
    @db.rel.FK
    categoryId: CategoriesTable.id

    @meta.label 'Created By'
    @db.rel.FK
    createdById: UsersTable.id

    @meta.label 'SKU'
    @db.index.unique 'products_sku_idx'
    sku: string

    @meta.label 'Price'
    price: number

    @meta.label 'Tags'
    tags: string[]

    @meta.label 'Published At'
    publishedAt?: number

    @meta.label 'Created'
    @db.default.now
    createdAt: number
}
