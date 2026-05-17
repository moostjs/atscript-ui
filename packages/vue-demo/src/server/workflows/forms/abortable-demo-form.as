@meta.label 'Submit or cancel'
@ui.form.submit.text 'Submit'
export interface AbortableDemoForm {
    @meta.label 'Your name'
    @ui.form.placeholder 'Anything goes'
    @meta.required 'Name is required'
    @expect.minLength 1, 'At least 1 character'
    name: string

    @meta.label 'Cancel'
    @ui.form.action 'cancel', 'Cancel'
    cancelAction: ui.action
}
