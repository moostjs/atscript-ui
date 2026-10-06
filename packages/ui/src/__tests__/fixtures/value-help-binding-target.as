/// Composite-key dictionary (attribute, value) — no FK possible, `@ui.valueHelp` binds a column
@db.http.path '/attribute-values'
export interface AttributeValue {
    @meta.id
    attribute: string

    @meta.id
    value: string

    @ui.dict.label
    label: string

    active: boolean
}

/// Unique non-PK value field
@db.http.path '/currencies'
export interface Currency {
    @meta.id
    id: number

    @db.index.unique
    code: string

    @ui.dict.label
    name: string
}

/// Dictionary without a controller path
export interface Unserved {
    @meta.id
    code: number
}
