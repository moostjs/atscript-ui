@meta.label 'Precision capture'
@meta.description 'A whole form wrapped in a padded card. Root-level sections bleed their dividers to the card edges via the --as-inset contract.'
@ui.form.submit.text 'Save'
export interface PrecisionCapture {
    @meta.label 'Sample ID'
    @ui.form.placeholder 'SMP-00042'
    @meta.required 'Sample ID is required'
    @ui.form.grid.colSpan '6'
    sampleId: string

    @meta.label 'Operator'
    @ui.form.placeholder 'jane@acme.com'
    @ui.form.grid.colSpan '6'
    operator: string

    @meta.label 'Audit'
    @meta.description 'Who captured the precision data and when.'
    audit: {
        @meta.label 'Captured by'
        @ui.form.placeholder 'jane@acme.com'
        @meta.required 'Captured by is required'
        capturedBy: string

        @meta.label 'Notes'
        notes?: string

        @meta.label 'Timestamps'
        @meta.description 'Created / updated audit trail.'
        timestamps: {
            @meta.label 'Created at'
            @ui.form.placeholder '2026-06-03T09:00'
            @ui.form.grid.colSpan '6'
            createdAt?: string

            @meta.label 'Updated at'
            @ui.form.placeholder '2026-06-03T10:30'
            @ui.form.grid.colSpan '6'
            updatedAt?: string
        }
    }
}
