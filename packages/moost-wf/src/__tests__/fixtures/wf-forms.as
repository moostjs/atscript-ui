@wf.context.pass 'email'
@wf.context.pass 'passwordRules'
export interface ContextPassForm {
    name: string
}

@wf.context.pass 'token'
export interface SingleContextForm {
    name: string
}

@wf.context.pass 'missing'
export interface MissingContextForm {
    name: string
}

export interface NoContextForm {
    name: string
}

export interface ActionForm {
    code: string

    @ui.form.action 'resend', 'Resend Code'
    resendAction: ui.action

    @ui.form.action 'switchMethod'
    switchAction: ui.action
}

export interface WithDataForm {
    code: string

    @wf.action.withData 'saveDraft'
    saveDraft: ui.action
}

export interface MixedActionForm {
    code: string

    @ui.form.action 'resend'
    resendAction: ui.action

    @wf.action.withData 'saveDraft'
    saveDraft: ui.action
}

export interface NoActionsForm {
    name: string
    email: string
}

@meta.label 'Login'
export interface LoginForm {
    @meta.label 'Username'
    @meta.required 'Username is required'
    username: string

    @meta.label 'Password'
    @ui.type 'password'
    password: string
}

@wf.context.pass 'email'
@wf.context.pass 'token'
export interface ContextStripForm {
    @meta.label 'Name'
    @ui.placeholder 'Enter name'
    name: string
}

@db.table 'roles'
@db.http.path '/api/db/tables/roles'
export interface RolesTableFixture {
    @meta.id
    id: number

    @meta.label 'Name'
    name: string
}

@meta.label 'Invite User'
export interface InviteStartFormFixture {
    @meta.label 'Email'
    @ui.placeholder 'newbie@example.com'
    email: string.email

    @meta.label 'Role'
    @ui.placeholder 'Pick a role'
    roleId: RolesTableFixture.id
}
