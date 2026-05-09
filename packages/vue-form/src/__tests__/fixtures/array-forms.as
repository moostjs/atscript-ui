export interface MaxLengthArrayForm {
    @expect.maxLength 2
    items: string[]
}

export interface MinLengthArrayForm {
    @expect.minLength 2
    items: string[]
}

export interface CustomAddLabelArray {
    @ui.array.add.label 'Add tag'
    items: string[]
}

export interface SingularLabelArray {
    @ui.form.label.singular 'tag'
    items: string[]
}

export interface RequiredArrayForm {
    @expect.minLength 1, 'At least one item required'
    items: string[]
}

export interface OptionalLabelArrayForm {
    @meta.label 'Tags'
    @ui.form.label.singular 'tag'
    items?: string[]
}

export interface PhoneItem {
    @expect.minLength 1, 'Label is required'
    label: string
    @expect.minLength 1, 'Number is required'
    number: string
}

export interface PhonesArrayForm {
    @expect.minLength 1, 'At least one phone required'
    items: PhoneItem[]
}
