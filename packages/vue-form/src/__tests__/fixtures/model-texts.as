// A form type compiled into the client: the texts it declares are translated at render time.

@meta.label 'By card'
type MtByCard = {
    @meta.label 'Card number'
    number: string
}

@meta.label 'By transfer'
type MtByTransfer = {
    @meta.label 'IBAN'
    iban: string
}

@meta.label 'Order'
@meta.description 'An order of the shop'
@ui.form.submit.text 'Place order'
export interface MtOrder {
    @meta.label 'Name'
    @meta.description 'As on your passport'
    @ui.form.hint 'Full legal name'
    @ui.form.placeholder 'Your name'
    name: string

    @meta.label 'Colour'
    @ui.form.type 'select'
    @ui.form.options 'Red'
    @ui.form.options 'Dark blue', 'blue'
    color: string

    @meta.label 'Status'
    @ui.literalLabel 'open', 'Open'
    status: 'open' | 'closed'

    @meta.label 'Price'
    @ui.form.prefix 'EUR'
    @ui.form.suffix 'per month'
    price: number

    @meta.label 'Phones'
    @ui.form.label.singular 'phone number'
    phones: string[]

    @meta.label 'Payment'
    pay: MtByCard | MtByTransfer

    // Expression results and validator messages are translated by their own paths
    @meta.label 'Code'
    @ui.form.fn.label '(v) => "Alpha"'
    @ui.form.validate '(v) => v !== "x" || "Nope"'
    code: string

    // A custom `@expect` message: a translated text of a served type
    @meta.label 'Tag'
    @expect.minLength 3, 'Too short'
    tag: string
}
