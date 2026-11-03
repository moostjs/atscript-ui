export interface Product {
    @meta.id
    id: number

    @meta.label 'Name'
    @expect.minLength 1
    name: string

    price: number

    tags?: string[]
}
