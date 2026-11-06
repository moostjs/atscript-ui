@meta.label 'Order'
@ui.form.submit.text 'Place order'
@ui.form.fn.title '(data) => data.id ? "Edit order" : "New order"'
@ui.nav.group 'Sales'
export interface ServedTexts {
    @meta.label 'Name'
    @ui.form.placeholder 'Your name'
    @ui.form.hint 'As on your passport'
    @ui.form.fn.label '(v) => v ? "Name (set)" : "Name"'
    @ui.form.validate '(v) => v !== "x" || "Not x"'
    @ui.form.fn.classes '(v) => v ? "is-set" : "is-empty"'
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
    @ui.array.add.label 'Add phone'
    @ui.array.remove.label 'Remove phone'
    phones: string[]

    @ui.form.action 'resend', 'Resend code'
    resend: ui.action

    @ui.form.fn.value '(v, data, ctx, entry, t) => ctx.recipient ? t("Code sent to {recipient}.", { recipient: ctx.recipient }) : "Request a code"'
    sent: ui.paragraph
}
