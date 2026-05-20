@meta.label 'Sign In'
@ui.form.submit.text 'Sign In'
export interface LoginForm {
    @meta.label 'Username'
    @ui.form.placeholder 'admin, manager, viewer, alice or bob'
    @meta.required 'Username is required'
    @expect.minLength 2, 'At least 2 characters'
    username: string

    @meta.label 'Password'
    @ui.type 'password'
    @ui.form.placeholder 'demo-password'
    @ui.form.action 'forgot-password', 'Forgot password?'
    @meta.required 'Password is required'
    @expect.minLength 6, 'At least 6 characters'
    password: string
}

@wf.context.pass 'email'
@meta.label 'Verify Identity'
@ui.form.submit.text 'Verify Code'
@ui.form.fn.title '(data, ctx) => `Enter the code sent to ${ctx.email || "your email"}`'
export interface MfaPincodeForm {
    @meta.label 'Verification Code'
    @ui.form.placeholder '000000'
    @meta.required 'Code is required'
    @expect.minLength 6, '6 digits expected'
    @expect.maxLength 6, '6 digits expected'
    code: string
}

@meta.label 'Recover Password'
@ui.form.submit.text 'Send recovery email'
@ui.form.fn.title '() => "Enter the email associated with your account"'
export interface RecoveryForm {
    @meta.label 'Email'
    @ui.form.placeholder 'you@example.com'
    @meta.required 'Email is required'
    email: string.email
}
