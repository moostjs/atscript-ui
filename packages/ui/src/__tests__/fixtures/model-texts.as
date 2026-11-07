/// Fixtures for the render-time translation of a model's own texts

@meta.label 'Order'
@meta.description 'An order of the shop'
@ui.form.submit.text 'Place order'
@ui.nav.group 'Sales'
@db.table 'orders'
export interface TxOrder {
    @meta.id
    id: number

    @meta.label 'Name'
    @meta.description 'As on your passport'
    @ui.form.hint 'Full legal name'
    @ui.form.placeholder 'Your name'
    name: string

    @ui.form.options 'Red'
    @ui.form.options 'Dark blue', 'blue'
    color: string

    @ui.literalLabel 'open', 'Open'
    status: 'open' | 'closed'

    @ui.form.prefix 'EUR'
    @ui.form.suffix 'per month'
    price: number

    @ui.form.label.singular 'phone number'
    phones: string[]

    @meta.label 'Payment'
    pay: TxByCard | TxByIban
}

@meta.label 'Card number'
export interface TxByCard {
    number: string
}

@meta.label 'IBAN'
export interface TxByIban {
    iban: string
}
