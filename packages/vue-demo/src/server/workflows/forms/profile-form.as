@wf.context.pass 'currentUsername'
@wf.context.pass 'currentEmail'
@meta.label 'Edit Profile'
@ui.form.submit.text 'Save Profile'
export interface ProfileForm {
    @meta.label 'Username'
    @ui.form.placeholder 'username'
    @meta.required 'Username is required'
    @expect.minLength 2, 'At least 2 characters'
    @ui.form.grid.colSpan 'half'
    username: string

    @meta.label 'Email'
    @ui.form.placeholder 'you@example.com'
    @meta.required 'Email is required'
    @ui.form.grid.colSpan 'half'
    email: string.email
}

@meta.label 'Verify Current Password'
@ui.form.submit.text 'Update Password'
export interface VerifyPasswordForm {
    @meta.label 'Current Password'
    @ui.type 'password'
    @ui.form.placeholder 'Current password'
    @meta.required 'Current password is required'
    oldPassword: string
}

@meta.label 'Set New Password'
@ui.form.submit.text 'Update Password'
export interface SetNewPasswordForm {
    @meta.label 'New Password'
    @ui.type 'password'
    @ui.form.placeholder 'At least 6 characters'
    @meta.required 'New password is required'
    @expect.minLength 6, 'At least 6 characters'
    newPassword: string
}
