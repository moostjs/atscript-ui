@ui.fn.title '(data) => "User " + (data.firstName || "<unknown>")'
@ui.submit.text 'Register'
@ui.fn.submit.disabled '(data) => !data.firstName || !data.lastName'
export interface DynamicForm {
    // Paragraph with computed value
    @meta.label 'Welcome'
    @meta.default 'Please fill out this form'
    @ui.order 0
    info: ui.paragraph

    @meta.label 'First Name'
    @meta.description 'Your given name'
    @ui.placeholder 'John'
    @ui.type 'text'
    @meta.required 'First name is required'
    @ui.order 1
    firstName: string

    @meta.label 'Last Name'
    @ui.hint 'Real last name please'
    @ui.fn.placeholder '(v, data) => data.firstName ? "Same as " + data.firstName + "?" : "Doe"'
    @ui.type 'text'
    @meta.required 'Last name is required'
    @ui.order 2
    lastName: string

    // Computed label + description
    @ui.fn.label '(v, data) => data.firstName ? data.firstName + "s Email" : "Email"'
    @ui.fn.description '(v, data) => data.firstName ? "We will contact " + data.firstName + " here" : "Your email address"'
    @ui.type 'text'
    @ui.order 3
    email?: string.email

    // Computed hint
    @meta.label 'Nickname'
    @ui.fn.hint '(v, data) => v ? "Nice nickname, " + (data.firstName || "stranger") + "!" : "Choose a cool nickname"'
    @ui.type 'text'
    @ui.order 4
    nickname?: string

    // Computed disabled
    @meta.label 'Password'
    @ui.placeholder 'Enter password'
    @ui.type 'password'
    @ui.fn.disabled '(v, data) => !data.firstName || !data.lastName'
    @meta.required 'Password is required'
    @ui.order 5
    password: string

    // Computed hidden
    @meta.label 'Secret Code'
    @ui.type 'text'
    @ui.fn.hidden '(v, data) => !data.password'
    @ui.order 6
    secretCode?: string

    // Computed classes
    @meta.label 'Styled Field'
    @ui.type 'text'
    @ui.fn.classes '(v) => v ? "has-value" : "empty-value"'
    @ui.order 7
    styledField?: string

    // Context-driven field
    @ui.fn.label '(v, data, ctx) => ctx.labels?.contextLabel || "Fallback Label"'
    @ui.fn.description '(v, data, ctx) => ctx.descriptions?.contextDescription || "Fallback description"'
    @ui.type 'text'
    @ui.order 8
    contextDrivenField?: string

    // Computed paragraph
    @meta.label 'Summary'
    @ui.fn.value '(v, data) => data.firstName && data.lastName ? "Hello, " + data.firstName + " " + data.lastName + "!" : "Fill out your info above to see a summary."'
    @ui.order 9
    summary: ui.paragraph
}
