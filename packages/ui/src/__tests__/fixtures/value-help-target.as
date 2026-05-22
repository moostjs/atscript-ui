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

/// Target shape where `version` is BOTH `@meta.id` AND `@ui.dict.attr` — backs
/// the resolver's "drops versionColumn from primaryKeys/filter/sort/attr lists"
/// test. The version field would otherwise leak into all four output arrays;
/// the meta also marks it filterable + sortable so both walk-loops in
/// `resolve.ts` get exercised.
@db.http.path '/versioned'
export interface VersionedTarget {
    @meta.id
    id: number

    name: string

    @meta.id
    @ui.dict.attr
    version: number
}
