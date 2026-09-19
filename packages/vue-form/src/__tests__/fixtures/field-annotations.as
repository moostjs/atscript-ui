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
    @ui.form.prefix.icon 'mail'
    email: string
}

export interface NumberAdornedField {
    @meta.label 'Hourly rate'
    @ui.form.prefix '+1'
    @ui.form.suffix '/hr'
    rate: number
}

/// A hidden nested STRUCT — the whole object, children included, must go.
export interface HiddenObjectField {
    @ui.form.hidden
    credentials: {
        token: string
    }

    visible: string
}

/// Same struct without the annotation — the namespace inlines its children.
export interface PlainObjectField {
    credentials: {
        token: string
    }

    visible: string
}
