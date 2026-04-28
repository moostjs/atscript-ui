import { RolesTable } from '../../schemas/roles'

@meta.label 'Invite User'
@ui.form.submit.text 'Send Invite'
export interface InviteStartForm {
    @meta.label 'Email'
    @ui.form.placeholder 'newbie@example.com'
    @meta.required 'Email is required'
    email: string.email

    @meta.label 'Role'
    @ui.form.placeholder 'Pick a role'
    @db.rel.FK
    roleId: RolesTable.id
}

@wf.context.pass 'email'
@meta.label 'Accept Invitation'
@ui.form.submit.text 'Accept & Sign In'
@ui.form.fn.title '(data, ctx) => `Welcome! Finish your account for ${ctx.email || "your email"}`'
export interface InviteAcceptForm {
    @meta.label 'Username'
    @ui.form.placeholder 'Pick a username'
    @meta.required 'Username is required'
    @expect.minLength 3, 'At least 3 characters'
    username: string

    @meta.label 'Password'
    @ui.type 'password'
    @ui.form.placeholder 'At least 6 characters'
    @meta.required 'Password is required'
    @expect.minLength 6, 'At least 6 characters'
    password: string
}
