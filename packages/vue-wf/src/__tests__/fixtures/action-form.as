@meta.label 'Action Form'
export interface ActionForm {
    @meta.label 'Username'
    username: string

    @meta.label 'Resend Code'
    @ui.form.action 'resend', 'Resend'
    resendAction: ui.action
}

@meta.label 'Data Action Form'
export interface DataActionForm {
    @meta.label 'Username'
    username: string

    @meta.label 'Save Draft'
    @wf.action.withData 'saveDraft'
    saveAction: ui.action
}
