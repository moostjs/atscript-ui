export interface LabeledForm {
    @meta.label 'First Name'
    firstName: string

    @meta.label 'Last Name'
    lastName: string
}

export interface RequiredForm {
    @meta.required 'Name is required'
    name: string
}

@ui.form.submit.text 'Save'
export interface SubmitTextForm {
    name: string
}

@meta.label 'Static Root Title'
@meta.description 'Static root description'
export interface StaticTitleForm {
    name: string
}

@ui.form.fn.title '(data, ctx) => "Code sent to " + (ctx.email || "nobody")'
@ui.form.fn.description '(data, ctx) => "We emailed " + (ctx.email || "nobody")'
export interface FnTitleContextForm {
    email: string
}

@ui.form.fn.title '(data) => data.firstName ? "Hello " + data.firstName : "Anonymous"'
export interface FnTitleDataForm {
    firstName: string
}
