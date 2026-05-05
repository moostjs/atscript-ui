// Action @InputForm payloads. One file so the moost-db `getActionForm()`
// endpoint can serialise these schemas alongside the table types.

@meta.label 'Suspend users'
@ui.form.submit.text 'Suspend'
export interface SuspendUsersInput {
    @meta.label 'Reason'
    @ui.form.placeholder 'Why is this account being suspended?'
    @meta.required 'Reason is required'
    @expect.minLength 4, 'At least 4 characters'
    @expect.maxLength 500
    reason: string

    @meta.label 'Notify user by email'
    @meta.default 'true'
    notifyUser?: boolean
}

@meta.label 'Resend invitation'
@ui.form.submit.text 'Send'
export interface ResendInviteInput {
    @meta.label 'Custom message (optional)'
    @ui.form.placeholder 'Add a personal note to the invitation email…'
    @ui.type 'paragraph'
    @expect.maxLength 1000
    customMessage?: string
}

@meta.label 'Cancel orders'
export interface CancelOrdersInput {
    @meta.label 'Reason'
    reason: 'customer-request' | 'payment-failed' | 'fraud' | 'out-of-stock' | 'other'

    @meta.label 'Notes'
    @ui.form.placeholder 'Optional context shown in the audit log'
    @ui.type 'paragraph'
    @expect.maxLength 500
    notes?: string

    @meta.label 'Refund the customer'
    @meta.default 'true'
    refund?: boolean
}
