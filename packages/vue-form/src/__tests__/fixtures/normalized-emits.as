// Fixture for the normalized views: what an action emits, and what a
// `@ui.form.validate` rule reads live (the same data a submit validates).

@ui.form.validate '(v) => v.login !== "admin" || "Reserved login"'
export interface NormalizedSignup {
    @meta.label 'Login'
    @normalize.trim
    @normalize.lowercase
    login: string

    @meta.label 'Repeat login'
    @ui.form.validate '(v, data) => v === data.login || "Logins must match"'
    @normalize.trim
    @normalize.lowercase
    repeat: string

    @ui.form.action 'check', 'Check availability'
    checkAction: ui.action
}
