export interface LabeledField {
    @meta.label 'Full Name'
    name: string
}

export interface HiddenField {
    @ui.hidden
    secret: string
}

export interface DisabledField {
    @ui.disabled
    locked: string
}

export interface PlaceholderField {
    @ui.placeholder 'you@example.com'
    email: string
}

export interface HintField {
    @ui.hint 'At least 8 characters'
    password: string
}

export interface DescriptionField {
    @meta.description 'Tell us about yourself'
    bio: string
}
