/// Reference fields cleared with the picker's "×" (since 0.1.177). The tests
/// attach the value help (`FormFieldDef.valueHelpInfo`) to the def by hand.
export interface RefClearForm {
    @meta.label 'Owner'
    @ui.form.type 'ref'
    owner?: string

    @meta.label 'Assignee'
    @meta.required 'Assignee is required'
    @ui.form.type 'ref'
    assignee: string

    @meta.label 'Checker'
    @ui.form.type 'ref'
    checker: string

    @meta.label 'Category'
    @ui.form.type 'ref'
    categoryId: number

    @meta.label 'Approver'
    @meta.default 'u1'
    @ui.form.type 'ref'
    approver: string

    @meta.label 'Locked'
    @ui.form.disabled
    @ui.form.type 'ref'
    locked?: string

    @meta.label 'Fixed'
    @meta.readonly
    @ui.form.type 'ref'
    fixed?: string
}
