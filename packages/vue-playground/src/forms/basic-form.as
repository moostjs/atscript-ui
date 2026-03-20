@meta.label 'Basic Form'
@ui.submit.text 'Submit'
export interface BasicForm {
    @meta.label 'First Name'
    @meta.description 'Your given name'
    @ui.placeholder 'John'
    @ui.type 'text'
    @meta.required 'First name is required'
    @ui.order 1
    firstName: string

    @meta.label 'Last Name'
    @ui.hint 'Real last name please'
    @ui.placeholder 'Doe'
    @ui.type 'text'
    @meta.required 'Last name is required'
    @ui.order 2
    lastName: string

    @meta.label 'Age'
    @ui.type 'number'
    @meta.default '25'
    @ui.order 3
    @expect.min 18, 'Must be 18 or older'
    age: number

    @meta.label 'Email'
    @ui.type 'text'
    @ui.placeholder 'john@example.com'
    @ui.order 4
    email?: string.email

    @meta.label 'Password'
    @ui.placeholder 'Enter password'
    @ui.type 'password'
    @meta.required 'Password is required'
    @ui.order 5
    password: string

    @meta.label 'Hidden Field'
    @ui.type 'text'
    @ui.hidden
    @ui.order 6
    hiddenField?: string

    @meta.label 'Disabled Field'
    @ui.type 'text'
    @ui.disabled
    @meta.default 'cannot edit'
    @ui.order 7
    disabledField?: string

    @meta.label 'Read-only Field'
    @ui.type 'text'
    @meta.readonly
    @meta.default 'read only value'
    @ui.order 8
    readonlyField?: string
}
