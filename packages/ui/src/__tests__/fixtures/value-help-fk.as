import { Author, Category, Orphan, NumericOnly } from './value-help-target'

/// Form with FK field pointing to Author (full dict annotations)
export interface BookForm {
    title: string
    @db.rel.FK
    authorId: Author.id
}

/// Form with FK field pointing to Category (auto-inferred label)
export interface ArticleForm {
    name: string
    @db.rel.FK
    categoryId: Category.id
}

/// Form with FK field pointing to Orphan (no @db.http.path)
export interface OrphanRefForm {
    @db.rel.FK
    orphanId: Orphan.id
}

/// Form with FK field pointing to NumericOnly (no string field for label)
export interface NumericRefForm {
    @db.rel.FK
    codeId: NumericOnly.code
}

/// Form with FK field + @ui.type override
export interface OverriddenForm {
    @db.rel.FK
    @ui.type 'text'
    authorId: Author.id
}

/// Form with a ref but NO @db.rel.FK — probe must return undefined
export interface UnannotatedRefForm {
    authorId: Author.id
}
