// Fixtures for the optional-leaf empty-state click → init flow.
//
// Covers every primitive design type AsField/AsFieldShell paints the
// AsNoData placeholder for: when the user clicks the placeholder,
// `toggleOptional(true)` runs and must commit a value that is NOT
// `undefined`, otherwise AsFieldShell stays stuck in the placeholder
// state (the input chrome never appears).
//
// `decimal` is the regression: atscript's `finalDefault` table doesn't
// enumerate it, so `createFormData` returned `undefined` until the
// fallback in `createFormData` landed.

export interface OptionalDecimalField {
    @meta.label 'Amount'
    amount?: decimal
}

export interface OptionalNumberField {
    @meta.label 'Count'
    count?: number
}

export interface OptionalStringField {
    @meta.label 'Note'
    note?: string
}

export interface OptionalDecimalWithAdornments {
    @meta.label 'Price'
    @ui.form.prefix '$'
    @ui.form.suffix 'USD'
    price?: decimal
}
