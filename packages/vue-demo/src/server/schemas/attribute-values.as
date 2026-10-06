/// Attribute dictionary with a composite key (attribute, value). A foreign key cannot
/// reference one column of it, so columns bind to it with `@ui.valueHelp` instead.
@db.table 'attribute_values'
export interface AttributeValuesTable {
    @meta.id
    @meta.label 'Attribute'
    attribute: string

    @meta.id
    @meta.label 'Value'
    value: string

    @meta.label 'Label'
    @ui.dict.label
    label: string

    @meta.label 'Active'
    active: boolean
}
