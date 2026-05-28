@wf.context.pass 'totpUri'
@wf.context.pass 'magicLink'
@meta.label 'Activate TOTP & share invite link'
@ui.form.submit.text 'Continue'
export interface QrCopyDemoForm {
    @meta.label 'Scan with your authenticator app'
    @meta.description 'Open Google Authenticator / 1Password / Authy and scan this code. The secret below is the manual fallback.'
    @ui.form.fn.value '(v, data, ctx) => ctx.totpUri'
    @ui.form.component 'qr-code'
    totpUri: ui.paragraph

    @meta.label 'Magic link'
    @meta.description 'Send this link to the invitee. Click Copy and paste it into your email tool.'
    @ui.form.fn.value '(v, data, ctx) => ctx.magicLink'
    @ui.form.component 'copy'
    magicLink: ui.paragraph
}
