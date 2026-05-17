@meta.label 'Trigger finish-screen demo'
@ui.form.submit.text 'Run workflow'
export interface FinishDemoForm {
    @meta.label 'Note'
    @ui.form.placeholder 'Anything — the demo only needs one round-trip'
    @meta.required 'Provide a value to advance'
    @expect.minLength 1, 'At least 1 character'
    note: string
}
