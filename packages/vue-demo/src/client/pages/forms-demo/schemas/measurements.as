@meta.label 'Numeric inputs showcase'
@meta.description 'AsDecimal + AsNumber + AsInput adornments across the prefix/suffix/currency/unit matrix.'
@ui.form.submit.text 'Save'
export interface MeasurementsForm {
    // ── Picker for the dynamic-currency / dynamic-unit examples ──
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

    // ── 1. number with static prefix + suffix + prefix.icon (non-currency, non-unit) ──
    @meta.label 'Hourly rate (number + static prefix + suffix)'
    @ui.form.prefix.icon 'i-as-star-filled'
    @ui.form.prefix '+1'
    @ui.form.suffix '/hr'
    @ui.form.grid.colSpan '6'
    rate: number

    // ── 2. decimal with static prefix + suffix (non-currency, non-unit) ──
    @meta.label 'Score (decimal + static prefix + suffix)'
    @ui.form.prefix '#'
    @ui.form.suffix '/100'
    @db.column.precision 5, 2
    @ui.form.grid.colSpan '6'
    score: decimal

    // ── 3. amount as DECIMAL with static currency (USD) ──
    @meta.label 'Simple fee (decimal + static USD)'
    @db.amount.currency 'USD'
    @db.column.precision 12, 2
    @ui.form.grid.colSpan '6'
    simpleFee: decimal

    // ── 4. amount as DECIMAL with static currency (EUR) ──
    @meta.label 'Order total (decimal + static EUR)'
    @db.amount.currency 'EUR'
    @db.column.precision 10, 2
    @ui.form.grid.colSpan '6'
    orderTotal: decimal

    // ── 5. number with static unit + suffix.icon ──
    @meta.label 'Weight (number + kg)'
    @db.unit 'kg'
    @ui.form.suffix.icon 'i-as-pin-filled'
    @ui.form.grid.colSpan '6'
    weight: number

    // ── 6. decimal with static unit ──
    @meta.label 'Temperature (decimal + °C)'
    @db.unit '°C'
    @db.column.precision 5, 1
    @ui.form.grid.colSpan '6'
    temperature: decimal

    // ── 7. number with DYNAMIC unit (sibling-ref) ──
    @meta.label 'Quantity (number + dynamic unit)'
    @db.unit.ref 'unit'
    @ui.form.grid.colSpan '6'
    quantity: number

    // ── 8. decimal with DYNAMIC unit (sibling-ref) ──
    @meta.label 'Measurement (decimal + dynamic unit)'
    @db.unit.ref 'unit'
    @db.column.precision 10, 3
    @ui.form.grid.colSpan '6'
    measurement: decimal

    // ── 9. DECIMAL with @ui.form.prefix.ref (sibling-fed) ──
    @meta.label 'Tip amount (decimal + dynamic prefix via @ui.form.prefix.ref)'
    @db.column.precision 10, 2
    @ui.form.prefix.ref 'currency'
    @ui.form.grid.colSpan '6'
    tip: decimal

    // ── 10. amount as DECIMAL with DYNAMIC currency + db precision ──
    @meta.label 'Invoice total (decimal + dynamic currency)'
    @meta.description 'db scale=3 caps storage; effective scale follows the currency (USD=2, EUR=2, JPY=0, BHD=3). Switching narrower re-rounds the model.'
    @db.amount.currency.ref 'currency'
    @db.column.precision 14, 3
    @ui.form.grid.colSpan '6'
    invoiceTotal: decimal
}
