import { Author, Category, Orphan, NumericOnly } from './value-help-target'

/// Form with FK field pointing to Author (full dict annotations)
export interface BookForm {
    title: string
    authorId: Author.id
}

/// Form with FK field pointing to Category (auto-inferred label)
export interface ArticleForm {
    name: string
    categoryId: Category.id
}

/// Form with FK field pointing to Orphan (no @db.http.path)
export interface OrphanRefForm {
    orphanId: Orphan.id
}

/// Form with FK field pointing to NumericOnly (no string field for label)
export interface NumericRefForm {
    codeId: NumericOnly.code
}

/// Form with FK field + @ui.type override
export interface OverriddenForm {
    @ui.type 'text'
    authorId: Author.id
}
