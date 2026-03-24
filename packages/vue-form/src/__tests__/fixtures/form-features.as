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

@ui.submit.text 'Save'
export interface SubmitTextForm {
    name: string
}
