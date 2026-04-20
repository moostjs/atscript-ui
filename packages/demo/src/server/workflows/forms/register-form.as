@meta.label 'Create Account'
@ui.submit.text 'Register'
export interface RegisterForm {
    @meta.label 'Username'
    @ui.placeholder 'Pick a username'
    @meta.required 'Username is required'
    @expect.minLength 3, 'At least 3 characters'
    username: string

    @meta.label 'Email'
    @ui.placeholder 'you@example.com'
    @meta.required 'Email is required'
    email: string.email

    @meta.label 'Password'
    @ui.type 'password'
    @ui.placeholder 'At least 6 characters'
    @meta.required 'Password is required'
    @expect.minLength 6, 'At least 6 characters'
    password: string
}

@wf.context.pass 'email'
@meta.label 'Verify Your Email'
@ui.submit.text 'Verify Code'
@ui.fn.title '(data, ctx) => `Enter the code sent to ${ctx.email || "your email"}`'
export interface OtpForm {
    @meta.label 'Verification Code'
    @ui.placeholder '000000'
    @meta.required 'Code is required'
    @expect.minLength 6, '6 digits expected'
    @expect.maxLength 6, '6 digits expected'
    code: string
}
