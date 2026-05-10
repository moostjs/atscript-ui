@meta.label 'Measurements & dates'
@meta.description 'Amount, measure, date, datetime, and time inputs driven by @db.amount.* / @db.unit.* / number.timestamp annotations.'
@ui.form.submit.text 'Save'
export interface MeasurementsForm {
    // ── Static currency (USD) ────────────────────────────────
    @meta.label 'Price'
    @meta.description 'Static currency code via @db.amount.currency.'
    @db.amount.currency 'USD'
    @db.column.precision 10, 2
    @ui.form.grid.colSpan '6'
    price: decimal

    // ── Cross-row currency ───────────────────────────────────
    @meta.label 'Order currency'
    @meta.description 'Pick the currency this order is settled in.'
    @ui.form.options 'US Dollar', 'USD'
    @ui.form.options 'Euro', 'EUR'
    @ui.form.options 'British Pound', 'GBP'
    @ui.form.options 'Japanese Yen', 'JPY'
    @ui.form.grid.colSpan '6'
    currency: ui.select

    @meta.label 'Order total'
    @meta.description 'Currency follows the picker above (`@db.amount.currency.ref currency`).'
    @db.amount.currency.ref 'currency'
    @db.column.precision 12, 2
    @ui.form.grid.colSpan '6'
    total: decimal

    // ── Static unit ──────────────────────────────────────────
    @meta.label 'Weight'
    @meta.description 'Static unit via @db.unit.'
    @db.unit 'kg'
    @db.column.precision 6, 2
    @ui.form.grid.colSpan '6'
    weight: decimal

    // ── Date / datetime / time ───────────────────────────────
    @meta.label 'Birthday'
    @meta.description 'number.timestamp would map to datetime; this opts into pure date via @ui.form.type.'
    @ui.form.type 'date'
    @ui.form.grid.colSpan '4'
    birthday: string

    @meta.label 'Scheduled at'
    @meta.description 'number.timestamp → automatic datetime input.'
    @ui.form.grid.colSpan '4'
    scheduledAt: number.timestamp

    @meta.label 'Reminder time'
    @meta.description 'Bare HH:mm string via @ui.form.type=time.'
    @ui.form.type 'time'
    @ui.form.grid.colSpan '4'
    reminderTime: string
}
