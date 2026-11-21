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

// ── Emptied inputs (atscript >= 0.1.103) ─────────────────────
// An emptied optional field commits `undefined`, never `null` — `null` on an
// optional `@meta.required` field is a validation error since 0.1.103.
export interface EmptiedInputs {
    @meta.label 'Due'
    @meta.required
    @ui.form.type 'date'
    due?: string

    @meta.label 'Start'
    @ui.form.type 'date'
    start: string

    @meta.label 'Qty'
    @ui.form.suffix 'pcs'
    qty?: number
}

/// Emptied text inputs (since 0.1.176): an optional one commits `undefined`
/// like the inputs above, a required one keeps `""`; the plain number input
/// (no adornment) follows the number rule.
export interface EmptiedTextInputs {
    @meta.label 'Nickname'
    @meta.required
    @expect.minLength 3
    nickname?: string

    @meta.label 'Bio'
    @ui.form.type 'textarea'
    bio?: string

    @meta.label 'Secret'
    @ui.form.type 'password'
    secret?: string

    @meta.label 'Title'
    title: string

    @meta.label 'Count'
    count?: number

    @meta.label 'Total'
    total: number
}

/// A reference input without value help renders its plain-text fallback.
export interface EmptiedRefInputs {
    @meta.label 'Owner'
    @ui.form.type 'ref'
    owner?: string

    @meta.label 'Assignee'
    @ui.form.type 'ref'
    assignee: string
}

/// Two inputs in one row (decimal: integer + fraction).
export interface EmptiedDecimalInput {
    @meta.label 'Fee'
    fee?: decimal
}
