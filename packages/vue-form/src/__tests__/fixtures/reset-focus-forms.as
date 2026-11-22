/// A checkbox is the first field: a reset that removed the focused input
/// hands focus to it (since 0.1.178).
export interface ResetFocusCheckboxFirst {
    @meta.label 'Agree'
    agree: boolean

    @meta.label 'Name'
    name: string
}

/// Only radio and checkbox fields: the first radio takes focus after a reset.
export interface ResetFocusChoicesOnly {
    @meta.label 'Size'
    @ui.form.type 'radio'
    @ui.form.options 'Small', 'small'
    @ui.form.options 'Large', 'large'
    size: string

    @meta.label 'Gift wrap'
    wrap: boolean
}
