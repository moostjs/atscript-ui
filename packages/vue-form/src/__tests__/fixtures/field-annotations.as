export interface LabeledField {
    @meta.label 'Full Name'
    name: string
}

export interface HiddenField {
    @ui.form.hidden
    secret: string
}

export interface DisabledField {
    @ui.form.disabled
    locked: string
}

export interface PlaceholderField {
    @ui.form.placeholder 'you@example.com'
    email: string
}

export interface HintField {
    @ui.form.hint 'At least 8 characters'
    password: string
}

export interface DescriptionField {
    @meta.description 'Tell us about yourself'
    bio: string
}

export interface IconField {
    @ui.form.icon 'mail'
    email: string
}
