/// Target table with full dict annotations for value-help tests

@db.http.path '/authors'
export interface Author {
    @meta.id
    id: number

    @ui.dict.label
    name: string

    @ui.dict.descr
    bio: string

    @ui.dict.attr
    email: string

    @ui.dict.attr
    country: string
}

/// Target table with no dict annotations — label should be auto-inferred
@db.http.path '/categories'
export interface Category {
    @meta.id
    id: number

    /// First non-PK string field, should be auto-inferred as label
    title: string

    description: string
}

/// Target table with no @db.http.path — value-help should be undefined
export interface Orphan {
    @meta.id
    id: number

    name: string
}

/// Target table with only numeric fields — no label can be inferred
@db.http.path '/codes'
export interface NumericOnly {
    @meta.id
    code: number

    value: number
}
