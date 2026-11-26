/// A reference field whose picks fill other fields (since 0.1.190). The tests attach
/// the value help (`FormFieldDef.valueHelpInfo`) to the def by hand.
export interface RefFillForm {
    @meta.label 'Country'
    country?: string

    @meta.label 'City'
    @ui.form.type 'ref'
    city: string

    @meta.label 'City name'
    cityName?: string

    @meta.label 'Region'
    region?: string

    @meta.label 'Office'
    @ui.form.type 'ref'
    office: string

    @meta.label 'Office name'
    officeName?: string
}
