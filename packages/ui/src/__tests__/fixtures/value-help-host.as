/// Host references, fills and columns of value-help bindings (since 0.1.190)
@db.http.path '/cities'
export interface City {
    @meta.id
    country: string

    @meta.id
    code: string

    @ui.dict.label
    name: string

    region: string
}

@db.http.path '/countries'
export interface Country {
    @meta.id
    code: string

    @ui.dict.label
    name: string
}

export interface Customer {
    country?: string

    @ui.valueHelp City, 'code', `country = Customer.country and region = 'north'`
    @ui.valueHelp.fill 'cityName', 'name'
    @ui.valueHelp.fill 'country', 'country'
    @ui.valueHelp.fill 'locked', 'name'
    @ui.valueHelp.column 'code'
    @ui.valueHelp.column 'name'
    city?: string

    cityName?: string

    @meta.readonly
    locked?: string

    @db.rel.FK
    @ui.valueHelp.fill 'countryName', 'name'
    @ui.valueHelp.column 'name'
    countryCode?: Country.code

    countryName?: string
}

export interface CustomerExtended extends Customer {
    note?: string
}

/// A chain reference: the binding, its host references and its columns travel; the fills stay home
export interface CustomerView {
    country?: string
    city?: Customer.city
    cityName?: string
}
