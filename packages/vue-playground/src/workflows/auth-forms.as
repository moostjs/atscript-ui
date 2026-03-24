@meta.label 'Sign In'
@ui.submit.text 'Sign In'
export interface LoginForm {
    @meta.label 'Username'
    @ui.placeholder 'Enter your username'
    @meta.required 'Username is required'
    @expect.minLength 3, 'At least 3 characters'
    username: string

    @meta.label 'Password'
    @ui.type 'password'
    @ui.placeholder 'Enter your password'
    @meta.required 'Password is required'
    password: string

    @meta.label 'Forgot Password'
    @ui.form.action 'forgot-password'
    forgotAction: ui.action
}

@wf.context.pass 'email'
@wf.context.pass 'pinTimeout'
@meta.label 'Verify Identity'
@ui.submit.text 'Verify Code'
@ui.fn.title '(data, ctx) => `Enter the code sent to ${ctx.email || "your email"}`'
export interface MfaPincodeForm {
    @meta.label 'Verification Code'
    @ui.placeholder '000000'
    @meta.required 'Code is required'
    @expect.pattern '^\d{6}$'
    code: string

    @meta.label 'Resend Code'
    @ui.form.action 'resend'
    resendAction: ui.action

    @meta.label 'Use Different Method'
    @ui.form.action 'switch-method'
    switchAction: ui.action
}

@meta.label 'Reset Password'
@ui.submit.text 'Send Reset Link'
export interface ForgotPasswordForm {
    @meta.label 'Email Address'
    @ui.placeholder 'you@example.com'
    @meta.required 'Email is required'
    email: string.email
}
