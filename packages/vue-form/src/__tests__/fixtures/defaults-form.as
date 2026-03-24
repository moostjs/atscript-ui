export interface DefaultsForm {
    @meta.default 'Alice'
    name: string
}

export interface MultiFieldForm {
    name: string
    age: number
}
