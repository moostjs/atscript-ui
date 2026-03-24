@meta.label 'Edit Profile'
@ui.submit.text 'Save Profile'
@wf.context.pass 'draftSaved'
export interface ProfileForm {
    @meta.label 'Full Name'
    @ui.placeholder 'Jane Doe'
    @meta.required 'Name is required'
    @expect.minLength 2, 'At least 2 characters'
    name: string

    @meta.label 'Email'
    @ui.placeholder 'jane@example.com'
    @meta.required 'Email is required'
    email: string.email

    @meta.label 'Bio'
    @ui.type 'textarea'
    @ui.placeholder 'Tell us about yourself...'
    @expect.maxLength 500, 'Max 500 characters'
    bio?: string

    @meta.label 'Save Draft'
    @wf.action.withData 'save-draft'
    saveDraftAction: ui.action
}
