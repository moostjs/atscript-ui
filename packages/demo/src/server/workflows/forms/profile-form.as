@wf.context.pass 'currentUsername'
@wf.context.pass 'currentEmail'
@meta.label 'Edit Profile'
@ui.submit.text 'Save Profile'
export interface ProfileForm {
    @meta.label 'Username'
    @ui.placeholder 'username'
    @meta.required 'Username is required'
    @expect.minLength 2, 'At least 2 characters'
    username: string

    @meta.label 'Email'
    @ui.placeholder 'you@example.com'
    @meta.required 'Email is required'
    @expect.minLength 3, 'Email is required'
    email: string
}

@meta.label 'Change Password'
@ui.submit.text 'Update Password'
export interface ChangePasswordForm {
    @meta.label 'Current Password'
    @ui.type 'password'
    @ui.placeholder 'Current password'
    @meta.required 'Current password is required'
    oldPassword: string

    @meta.label 'New Password'
    @ui.type 'password'
    @ui.placeholder 'At least 6 characters'
    @meta.required 'New password is required'
    @expect.minLength 6, 'At least 6 characters'
    newPassword: string
}
