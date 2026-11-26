/// The demo's attribute dictionary (composite key attribute + value), as its
/// controller serves it. A client-side model names the path itself: the server
/// stamps it on the served table, not on a type compiled in the browser.
@db.http.path '/api/db/tables/attribute-values'
export interface AttributeDict {
    @meta.id
    attribute: string

    @meta.id
    value: string

    @ui.dict.label
    label: string

    active: boolean
}

@meta.label 'Product variant'
export interface VariantPickerForm {
    @meta.label 'Attribute'
    @ui.form.grid.colSpan 'half'
    attribute?: 'color' | 'size' | 'team'

    /// Values of the form narrow the picker: only the chosen attribute's active values.
    /// A pick fills the label and the attribute.
    @meta.label 'Value'
    @ui.valueHelp AttributeDict, 'value', `attribute = VariantPickerForm.attribute and active = true`
    @ui.valueHelp.fill 'valueLabel', 'label'
    @ui.valueHelp.fill 'attribute', 'attribute'
    @ui.valueHelp.column 'value'
    @ui.valueHelp.column 'label'
    @ui.form.grid.colSpan 'half'
    value?: string

    @meta.label 'Value label'
    valueLabel?: string

    /// A dropdown: the colours are few, so the field lists them.
    @meta.label 'Color'
    @ui.form.type 'select'
    @ui.valueHelp AttributeDict, 'value', `attribute = 'color'`
    @ui.valueHelp.fill 'colorLabel', 'label'
    @ui.form.grid.colSpan 'half'
    color?: string

    @meta.label 'Color label'
    @ui.form.grid.colSpan 'half'
    colorLabel?: string
}

/// The demo's city dictionary, as its controller serves it.
@db.http.path '/api/db/tables/cities'
export interface CityDict {
    @meta.id
    code: string

    @ui.dict.label
    name: string

    country: string

    region: string
}

@meta.label 'Office'
export interface OfficePickerForm {
    @meta.label 'Country'
    @ui.form.grid.colSpan 'half'
    country?: 'DE' | 'FR' | 'IT' | 'ES'

    /// A picker dialog: the button after the input, or "See all" under its list, shows
    /// the country's cities as a table. The city reads with its name while not edited.
    @meta.label 'City'
    @ui.valueHelp CityDict, 'code', `country = OfficePickerForm.country`
    @ui.valueHelp.fill 'cityName', 'name'
    @ui.valueHelp.fill 'country', 'country'
    @ui.valueHelp.column 'code'
    @ui.valueHelp.column 'name'
    @ui.valueHelp.column 'country'
    @ui.valueHelp.column 'region'
    @ui.valueLabel 'cityName'
    @ui.form.grid.colSpan 'half'
    city?: string

    @meta.label 'City name'
    cityName?: string

    /// Read-only: the code with its name, code first.
    @meta.label 'Head office'
    @meta.readonly
    @ui.valueLabel 'headOfficeName', 'keyText'
    headOffice?: string

    @ui.form.hidden
    headOfficeName?: string
}
