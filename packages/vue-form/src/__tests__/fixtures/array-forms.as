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

export interface RequiredArrayForm {
    @expect.minLength 1, 'At least one item required'
    items: string[]
}
