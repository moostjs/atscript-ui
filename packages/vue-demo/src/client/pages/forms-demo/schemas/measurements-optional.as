@meta.label 'Optional numeric inputs — placeholder-init regression'
@meta.description 'Every adornment shape from the measurements showcase, marked optional. Clicking the AsFieldShell empty-state placeholder must reveal an editable input chrome on every field — the regression cited the decimal cases.'
@ui.form.submit.text 'Save'
export interface MeasurementsOptionalForm {
    // ── Pickers for the dynamic-currency / dynamic-unit examples ──
    @meta.label 'Currency'
    @ui.form.options 'US Dollar', 'USD'
    @ui.form.options 'Euro', 'EUR'
    @ui.form.options 'Japanese Yen', 'JPY'
    @ui.form.options 'Bahraini Dinar', 'BHD'
    @ui.form.grid.colSpan '6'
    currency: ui.select

    @meta.label 'Unit'
    @ui.form.options 'Kilograms', 'kg'
    @ui.form.options 'Pounds', 'lb'
    @ui.form.options 'Ounces', 'oz'
    @ui.form.options 'Grams', 'g'
    @ui.form.grid.colSpan '6'
    unit: ui.select

    // ── 10-case matrix — same shapes as /measurements but all optional. ──
    @meta.label 'Hourly rate (number + static prefix + suffix)'
    @ui.form.prefix '+1'
    @ui.form.suffix '/hr'
    @ui.form.grid.colSpan '6'
    rate?: number

    @meta.label 'Score (decimal + static prefix + suffix)'
    @ui.form.prefix '#'
    @ui.form.suffix '/100'
    @db.column.precision 5, 2
    @ui.form.grid.colSpan '6'
    score?: decimal

    @meta.label 'Simple fee (decimal + static USD)'
    @db.amount.currency 'USD'
    @db.column.precision 12, 2
    @ui.form.grid.colSpan '6'
    simpleFee?: decimal

    @meta.label 'Order total (decimal + static EUR)'
    @db.amount.currency 'EUR'
    @db.column.precision 10, 2
    @ui.form.grid.colSpan '6'
    orderTotal?: decimal

    @meta.label 'Weight (number + kg)'
    @db.unit 'kg'
    @ui.form.grid.colSpan '6'
    weight?: number

    @meta.label 'Temperature (decimal + °C)'
    @db.unit '°C'
    @db.column.precision 5, 1
    @ui.form.grid.colSpan '6'
    temperature?: decimal

    @meta.label 'Quantity (number + dynamic unit)'
    @db.unit.ref 'unit'
    @ui.form.grid.colSpan '6'
    quantity?: number

    @meta.label 'Measurement (decimal + dynamic unit)'
    @db.unit.ref 'unit'
    @db.column.precision 10, 3
    @ui.form.grid.colSpan '6'
    measurement?: decimal

    @meta.label 'Tip amount (decimal + dynamic prefix via @ui.form.prefix.ref)'
    @db.column.precision 10, 2
    @ui.form.prefix.ref 'currency'
    @ui.form.grid.colSpan '6'
    tip?: decimal

    @meta.label 'Invoice total (decimal + dynamic currency)'
    @db.amount.currency.ref 'currency'
    @db.column.precision 14, 3
    @ui.form.grid.colSpan '6'
    invoiceTotal?: decimal
}
