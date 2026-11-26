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

/// A dropdown and radios bound to a dictionary: their options come from it (since 0.1.190)
export interface SelectFillForm {
    @meta.label 'Country'
    country?: string

    @meta.label 'City'
    @ui.form.type 'select'
    city?: string

    @meta.label 'City name'
    cityName?: string

    @meta.label 'Size'
    @ui.form.type 'radio'
    size?: string

    @meta.label 'Grade'
    @ui.form.type 'select'
    grade: 'low' | 'high'
}

@db.http.path '/cities'
export interface FillCity {
    @meta.id
    code: string

    @ui.dict.label
    name: string

    country: string
}

/// A bound field of an interface used as a namespace object (since 0.1.190): the form
/// renders `shipping` inline, so the binding's host field and fill are `shipping.*`
export interface FillAddress {
    @meta.label 'Shipping country'
    country?: string

    @meta.label 'Shipping city'
    @ui.valueHelp FillCity, 'code', `country = FillAddress.country`
    @ui.valueHelp.fill 'cityName', 'name'
    city: string

    @meta.label 'Shipping city name'
    cityName?: string
}

export interface ShipmentForm {
    @meta.label 'Country'
    country?: string

    shipping: FillAddress
}

/// Codes shown with their text (`@ui.valueLabel`, since 0.1.190). The tests attach the
/// city's value help by hand.
export interface ValueLabelForm {
    @meta.label 'City'
    @ui.form.type 'ref'
    @ui.valueLabel 'cityName'
    city?: string

    @meta.label 'City name'
    cityName?: string

    @meta.label 'Home'
    @meta.readonly
    @ui.valueLabel 'homeName', 'keyText'
    home?: string

    homeName?: string

    @meta.label 'Zone'
    @meta.readonly
    @ui.valueLabel 'zoneName', 'text'
    zone?: string

    zoneName?: string

    @meta.label 'Note'
    @ui.valueLabel 'noteText'
    note?: string

    noteText?: string

    @meta.label 'Origin'
    @ui.form.type 'ref'
    @meta.readonly
    @ui.valueLabel 'originName'
    origin?: string

    originName?: string
}

/// A code with its text in a namespace object: the text is its sibling there (since 0.1.190)
export interface ValueLabelShipment {
    shipping: {
        @meta.label 'Ship to'
        @meta.readonly
        @ui.valueLabel 'cityName'
        city?: string

        cityName?: string
    }

    cityName?: string
}
