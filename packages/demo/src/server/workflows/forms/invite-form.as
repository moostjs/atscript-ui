import { RolesTable } from '../../schemas/roles'

@meta.label 'Invite User'
@ui.submit.text 'Send Invite'
export interface InviteStartForm {
    @meta.label 'Email'
    @ui.placeholder 'newbie@example.com'
    @meta.required 'Email is required'
    email: string.email

    @meta.label 'Role'
    @ui.placeholder 'Pick a role'
    roleId: RolesTable.id
}

@wf.context.pass 'email'
@meta.label 'Accept Invitation'
@ui.submit.text 'Accept & Sign In'
@ui.fn.title '(data, ctx) => `Welcome! Finish your account for ${ctx.email || "your email"}`'
export interface InviteAcceptForm {
    @meta.label 'Username'
    @ui.placeholder 'Pick a username'
    @meta.required 'Username is required'
    @expect.minLength 3, 'At least 3 characters'
    username: string

    @meta.label 'Password'
    @ui.type 'password'
    @ui.placeholder 'At least 6 characters'
    @meta.required 'Password is required'
    @expect.minLength 6, 'At least 6 characters'
    password: string
}
