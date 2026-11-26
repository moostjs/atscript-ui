import { CitiesTable } from './cities'

/// Offices: the city is a code shown with its name (`@ui.valueLabel`); a pick from the
/// city dictionary fills the name.
@db.table 'offices'
export interface OfficesTable {
    @meta.id
    @db.default.increment
    id: number

    @meta.label 'Office'
    name: string

    @meta.label 'City'
    @ui.valueHelp CitiesTable, 'code'
    @ui.valueHelp.fill 'cityName', 'name'
    @ui.valueHelp.column 'code'
    @ui.valueHelp.column 'name'
    @ui.valueHelp.column 'country'
    @ui.valueLabel 'cityName'
    cityCode: string

    /// Fetched with the city for its text; no column of its own
    @meta.label 'City name'
    @ui.table.exclude
    cityName?: string
}
