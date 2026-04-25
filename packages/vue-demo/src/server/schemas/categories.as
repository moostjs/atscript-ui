@db.table 'categories'
export interface CategoriesTable {
    @meta.id
    @db.default.increment
    id: number

    @meta.label 'Name'
    @db.index.fulltext 'categories_search'
    name: string

    @meta.label 'Parent'
    @db.rel.FK
    parentId?: CategoriesTable.id

    @meta.label 'Slug'
    @db.index.unique 'categories_slug_idx'
    slug: string

    @meta.label 'Created'
    @db.default.now
    createdAt: number
}
