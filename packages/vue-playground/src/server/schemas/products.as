@db.table 'products'
export interface ProductsTable {
    @meta.id
    @db.default.increment
    id: number

    @meta.label 'Product Name'
    @db.index.fulltext 'products_search'
    name: string

    @meta.label 'Description'
    @db.index.fulltext 'products_search'
    description?: string

    @meta.label 'Price'
    price: number

    @meta.label 'In Stock'
    @db.default 'true'
    inStock: boolean

    @meta.label 'Category'
    @db.index.plain 'category_idx'
    category: 'electronics' | 'clothing' | 'food' | 'books' | 'toys' | 'other'

    @meta.label 'SKU'
    @db.index.unique 'sku_idx'
    sku: string

    @meta.label 'Created'
    @db.default.now
    createdAt: number
}
