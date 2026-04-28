@meta.label 'Basic Form'
@ui.form.submit.text 'Submit'
export interface BasicForm {
    @meta.label 'First Name'
    @meta.description 'Your given name'
    @ui.form.placeholder 'John'
    @ui.type 'text'
    @meta.required 'First name is required'
    @ui.form.order 1
    firstName: string

    @meta.label 'Last Name'
    @ui.form.hint 'Real last name please'
    @ui.form.placeholder 'Doe'
    @ui.type 'text'
    @meta.required 'Last name is required'
    @ui.form.order 2
    lastName: string

    @meta.label 'Age'
    @ui.type 'number'
    @meta.default '25'
    @ui.form.order 3
    @expect.min 18, 'Must be 18 or older'
    age: number

    @meta.label 'Email'
    @ui.type 'text'
    @ui.form.placeholder 'john@example.com'
    @ui.form.order 4
    email?: string.email

    @meta.label 'Password'
    @ui.form.placeholder 'Enter password'
    @ui.type 'password'
    @meta.required 'Password is required'
    @ui.form.order 5
    password: string

    @meta.label 'Hidden Field'
    @ui.type 'text'
    @ui.form.hidden
    @ui.form.order 6
    hiddenField?: string

    @meta.label 'Disabled Field'
    @ui.type 'text'
    @ui.form.disabled
    @meta.default 'cannot edit'
    @ui.form.order 7
    disabledField?: string

    @meta.label 'Read-only Field'
    @ui.type 'text'
    @meta.readonly
    @meta.default 'read only value'
    @ui.form.order 8
    readonlyField?: string
}
