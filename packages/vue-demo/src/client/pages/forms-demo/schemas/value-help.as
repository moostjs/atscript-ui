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
