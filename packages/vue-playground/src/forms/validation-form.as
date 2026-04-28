@meta.label 'Validation Demo'
@ui.form.submit.text 'Validate & Submit'
export interface ValidationForm {
    @meta.label 'Username'
    @ui.form.placeholder 'Enter username'
    @ui.type 'text'
    @meta.required 'Username is required'
    @expect.minLength 3, 'Must be at least 3 characters'
    @expect.maxLength 20, 'Must be at most 20 characters'
    @ui.form.order 1
    username: string

    @meta.label 'Email'
    @ui.form.placeholder 'user@example.com'
    @ui.type 'text'
    @meta.required 'Email is required'
    @ui.form.order 2
    email: string.email

    @meta.label 'Age'
    @ui.type 'number'
    @ui.form.validate '(v) => !!v || "Age is required"'
    @expect.min 18, 'Must be 18 or older'
    @expect.max 120, 'Must be 120 or younger'
    @ui.form.order 3
    age?: number

    @meta.label 'Website'
    @ui.form.placeholder 'https://example.com'
    @ui.type 'text'
    @ui.form.order 4
    website?: string.url

    @meta.label 'Bio'
    @ui.form.placeholder 'Tell us about yourself'
    @ui.type 'text'
    @expect.maxLength 200, 'Bio must be 200 characters or less'
    @ui.form.order 5
    bio?: string

    @meta.label 'Password'
    @ui.type 'password'
    @meta.required 'Password is required'
    @expect.minLength 8, 'Password must be at least 8 characters'
    @ui.form.validate '(v) => /[A-Z]/.test(v) || "Must contain an uppercase letter"'
    @ui.form.order 6
    password: string

    @meta.label 'I agree to terms'
    @ui.form.order 7
    @ui.form.validate '(v) => !!v || "You must agree to terms"'
    agreeToTerms: ui.checkbox

    @meta.label 'Tags'
    @ui.form.order 8
    @ui.array.add.label 'Add tag'
    @expect.minLength 1, 'At least one tag required'
    @expect.maxLength 5, 'Maximum 5 tags'
    tags: string[]
}
