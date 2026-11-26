/// City dictionary behind the offices' picker dialog: more cities than a picker list
/// shows, searchable by name.
@db.table 'cities'
export interface CitiesTable {
    @meta.id
    @meta.label 'Code'
    code: string

    @meta.label 'Name'
    @ui.dict.label
    @db.index.fulltext 'cities_search'
    name: string

    @meta.label 'Country'
    country: string

    @meta.label 'Region'
    region: string
}
