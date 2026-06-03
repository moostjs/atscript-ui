@meta.label 'Submit or cancel'
@ui.form.submit.text 'Submit'
export interface AbortableDemoForm {
    @meta.label 'Your name'
    @ui.form.placeholder 'Anything goes'
    @meta.required 'Name is required'
    @expect.minLength 1, 'At least 1 character'
    name: string

    // Pushed below the Submit button, centered, with a text prefix — exercises
    // @ui.form.pushDown + @ui.form.attr 'text'/'align' inside an AsWfForm. The
    // action id stays 'cancel', so the workflow's abort path is unchanged.
    @meta.label 'Cancel'
    @ui.form.pushDown
    @ui.form.attr 'text', 'Changed your mind?'
    @ui.form.attr 'align', 'center'
    @ui.form.action 'cancel', 'Cancel'
    cancelAction: ui.action
}
