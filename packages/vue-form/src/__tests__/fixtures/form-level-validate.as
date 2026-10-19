// Fixture for interface-level `@ui.form.validate` (a container-level rule).
// On the form's root interface the rule is form-level (`__form` banner); used
// as a nested object prop it reports at that prop's path.

@ui.form.validate '(v) => v.password === v.confirm || "Passwords must match"'
export interface SignupForm {
    @meta.label 'Password'
    @meta.required 'Password is required'
    password: string

    @meta.label 'Confirm'
    confirm: string
}

export interface AccountHost {
    @meta.label 'Title'
    @meta.required 'Title is required'
    title: string

    @meta.label 'Signup'
    signup: SignupForm
}
