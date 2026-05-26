@meta.label 'Consent Review'
@meta.description 'Toggle the pending consents below. The list is supplied by the backend via @ui.form.fn.attr; required items block submission with a per-consent message.'
@ui.form.submit.text 'Accept & continue'
export interface ConsentReviewForm {
    @ui.form.component 'AsConsentArray'
    @ui.form.fn.attr 'pendingConsents', '() => [{ id: "tos", text: "I accept the [Terms of Service](https://example.com/terms)", required: "You must accept the Terms of Service to continue" }, { id: "privacy", text: "I accept the [Privacy Policy](https://example.com/privacy)", required: "Privacy Policy acceptance is mandatory" }, { id: "marketing", text: "Send me product updates and offers" }, { id: "research", text: "Allow my anonymised usage to improve the product" }]'
    @ui.form.grid.colSpan '12'
    consents: string[]
}

@meta.label 'Set your password'
@meta.description 'A standard set-password form with live policy fulfillment. Policies are normally backend-supplied via workflow context; here they are inlined via @ui.form.fn.attr for the demo.'
@ui.form.submit.text 'Save password'
export interface SetPasswordForm {
    @meta.label 'New password'
    @ui.form.placeholder 'Type a new password...'
    @ui.form.attr 'type', 'password'
    @ui.form.grid.colSpan '12'
    newPassword: string

    @meta.label 'Confirm password'
    @ui.form.placeholder 'Repeat the new password'
    @ui.form.attr 'type', 'password'
    @ui.form.validate '(v, data) => v === data.newPassword || "Passwords must match"'
    @ui.form.grid.colSpan '12'
    confirmPassword: string

    @meta.label 'Password requirements'
    @ui.form.component 'AsPasswordRules'
    @ui.form.fn.attr 'policies', '() => [{ rule: "(p) => p.length >= 8", description: "At least 8 characters" }, { rule: "(p) => /[A-Z]/.test(p)", description: "At least one uppercase letter" }, { rule: "(p) => /[a-z]/.test(p)", description: "At least one lowercase letter" }, { rule: "(p) => /\\d/.test(p)", description: "At least one digit" }, { rule: "(p) => /[^A-Za-z0-9]/.test(p)", description: "At least one special character" }]'
    @ui.form.fn.attr 'password', '(_, data) => data.newPassword'
    @ui.form.grid.colSpan '12'
    rules: ui.paragraph
}
