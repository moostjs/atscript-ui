@meta.label 'Error Dismissal Demo'
@ui.form.submit.text 'Save'
export interface ErrorDismissalForm {
    @meta.label 'Email'
    @meta.description 'Type to auto-dismiss the injected leaf error (no blur needed).'
    @ui.form.placeholder 'me@example.com'
    @meta.required 'Email is required'
    email: string

    @meta.label 'Name'
    @ui.form.placeholder 'Jane'
    name?: string
}
