@meta.label 'Enter your email'
@ui.form.submit.text 'Submit'
export interface EmailDemoForm {
    @meta.label 'Email'
    @ui.form.placeholder 'you@yourdomain.com'
    @meta.required 'Email is required'
    email: string.email
}
