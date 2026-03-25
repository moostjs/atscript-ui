/// Value-help target types for FK ref demo.
/// These mirror the playground server schemas with @db.http.path
/// and @ui.dict.* annotations for value-help resolution.

@db.http.path '/db/tables/products'
export interface Product {
    @meta.id
    id: number

    @ui.dict.label
    name: string

    @ui.dict.descr
    description: string

    @ui.dict.attr
    category: string

    @ui.dict.attr
    sku: string

    price: number
}

@db.http.path '/db/tables/customers'
export interface Customer {
    @meta.id
    id: number

    @ui.dict.label
    firstName: string

    @ui.dict.descr
    email: string

    @ui.dict.attr
    city: string

    @ui.dict.attr
    country: string
}
