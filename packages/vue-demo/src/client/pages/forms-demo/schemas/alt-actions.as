@meta.label 'Create your account'
@ui.form.submit.text 'Create account'
export interface AltActionsForm {
    @meta.label 'Email'
    @ui.form.placeholder 'you@example.com'
    @meta.required 'Email is required'
    @expect.minLength 3, 'At least 3 characters'
    email: string

    @meta.label 'Password'
    @ui.type 'password'
    @ui.form.placeholder '••••••••'
    @meta.required 'Password is required'
    // Inline field-footer action — rendered in the password field's footer row,
    // the original alt-action placement (above submit, beside the hint/error).
    @ui.form.action 'forgot-password', 'Forgot password?'
    password: string

    // ── Pushed below the submit button (new @ui.form.pushDown) ──────────────

    // Centered, with a `text` prefix → "Already have an account? Sign in".
    @ui.form.pushDown
    @ui.form.attr 'text', 'Already have an account?'
    @ui.form.attr 'align', 'center'
    @ui.form.action 'sign-in', 'Sign in'
    signinAction: ui.action

    // Left-aligned, with a longer prefix → wraps on narrow widths.
    @ui.form.pushDown
    @ui.form.attr 'text', 'By continuing you accept our'
    @ui.form.attr 'align', 'left'
    @ui.form.action 'terms', 'Terms of Service'
    termsAction: ui.action

    // Right-aligned, no prefix.
    @ui.form.pushDown
    @ui.form.attr 'align', 'right'
    @ui.form.action 'sso', 'Use single sign-on instead'
    ssoAction: ui.action
}
