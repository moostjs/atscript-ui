@meta.label 'Sign Up'
export interface SignUpForm {
    @meta.label 'Email'
    email: string

    @meta.label 'Password'
    password: string

    @ui.form.pushDown
    @ui.form.attr 'text', 'Already have an account?'
    @ui.form.attr 'align', 'center'
    @ui.form.action 'signin', 'Sign in'
    signinAction: ui.action
}

@meta.label 'Plain Action Form'
export interface PlainActionForm {
    @meta.label 'Email'
    email: string

    @ui.form.action 'help', 'Need help?'
    helpAction: ui.action
}
