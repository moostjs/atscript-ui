@meta.label 'Login'
export interface LoginForm {
    @meta.label 'Username'
    username: string

    @meta.label 'Password'
    @ui.type 'password'
    password: string
}
