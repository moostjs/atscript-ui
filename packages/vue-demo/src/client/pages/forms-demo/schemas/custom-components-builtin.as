@meta.label 'Built-in Type Override'
@meta.description 'These two string fields use a custom GrowingTextarea instead of the default <input>. Same field, different default — swapping the `text` key in the types map cascades to every string field on the form.'
@ui.form.submit.text 'Save'
export interface BuiltinOverrideForm {
    @meta.label 'Display Name'
    @ui.form.grid.colSpan '12'
    displayName: string

    @meta.label 'Short Bio'
    @ui.form.placeholder 'Write a few sentences about yourself...'
    @ui.form.grid.colSpan '12'
    bio: string
}
