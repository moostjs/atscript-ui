@ui.form.fn.title '(data) => "User " + (data.firstName || "<unknown>")'
@ui.form.submit.text 'Register'
@ui.form.fn.submit.disabled '(data) => !data.firstName || !data.lastName'
export interface DynamicForm {
    // Paragraph with computed value
    @meta.label 'Welcome'
    @meta.default 'Please fill out this form'
    @ui.form.order 0
    info: ui.paragraph

    @meta.label 'First Name'
    @meta.description 'Your given name'
    @ui.form.placeholder 'John'
    @ui.type 'text'
    @meta.required 'First name is required'
    @ui.form.order 1
    firstName: string

    @meta.label 'Last Name'
    @ui.form.hint 'Real last name please'
    @ui.form.fn.placeholder '(v, data) => data.firstName ? "Same as " + data.firstName + "?" : "Doe"'
    @ui.type 'text'
    @meta.required 'Last name is required'
    @ui.form.order 2
    lastName: string

    // Computed label + description
    @ui.form.fn.label '(v, data) => data.firstName ? data.firstName + "s Email" : "Email"'
    @ui.form.fn.description '(v, data) => data.firstName ? "We will contact " + data.firstName + " here" : "Your email address"'
    @ui.type 'text'
    @ui.form.order 3
    email?: string.email

    // Computed hint
    @meta.label 'Nickname'
    @ui.form.fn.hint '(v, data) => v ? "Nice nickname, " + (data.firstName || "stranger") + "!" : "Choose a cool nickname"'
    @ui.type 'text'
    @ui.form.order 4
    nickname?: string

    // Computed disabled
    @meta.label 'Password'
    @ui.form.placeholder 'Enter password'
    @ui.type 'password'
    @ui.form.fn.disabled '(v, data) => !data.firstName || !data.lastName'
    @meta.required 'Password is required'
    @ui.form.order 5
    password: string

    // Computed hidden
    @meta.label 'Secret Code'
    @ui.type 'text'
    @ui.form.fn.hidden '(v, data) => !data.password'
    @ui.form.order 6
    secretCode?: string

    // Computed classes
    @meta.label 'Styled Field'
    @ui.type 'text'
    @ui.form.fn.classes '(v) => v ? "has-value" : "empty-value"'
    @ui.form.order 7
    styledField?: string

    // Context-driven field
    @ui.form.fn.label '(v, data, ctx) => ctx.labels?.contextLabel || "Fallback Label"'
    @ui.form.fn.description '(v, data, ctx) => ctx.descriptions?.contextDescription || "Fallback description"'
    @ui.type 'text'
    @ui.form.order 8
    contextDrivenField?: string

    // Computed paragraph
    @meta.label 'Summary'
    @ui.form.fn.value '(v, data) => data.firstName && data.lastName ? "Hello, " + data.firstName + " " + data.lastName + "!" : "Fill out your info above to see a summary."'
    @ui.form.order 9
    summary: ui.paragraph
}
