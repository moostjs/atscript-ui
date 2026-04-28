@meta.label 'Company Profile'
@ui.form.submit.text 'Save Profile'
export interface NestedForm {
    @meta.label 'Company Name'
    @ui.form.placeholder 'Acme Corp'
    @ui.type 'text'
    @meta.required 'Company name is required'
    @ui.form.order 1
    companyName: string

    @meta.label 'Headquarters'
    @ui.form.order 2
    address: {
        @meta.label 'Street'
        @ui.form.placeholder '123 Main St'
        @ui.type 'text'
        @meta.required 'Street is required'
        @ui.form.order 3
        street: string

        @meta.label 'City'
        @ui.form.placeholder 'New York'
        @ui.type 'text'
        @meta.required 'City is required'
        @ui.form.order 4
        city: string

        @meta.label 'ZIP Code'
        @ui.form.placeholder '10001'
        @ui.type 'text'
        @meta.required 'ZIP code is required'
        @ui.form.order 5
        zip: string

        @ui.form.order 6
        country: {
            @meta.label 'Country Name'
            @ui.form.placeholder 'United States'
            @ui.type 'text'
            @meta.required 'Country name is required'
            @ui.form.order 7
            name: string

            @meta.label 'Country Code'
            @ui.form.placeholder 'US'
            @ui.type 'text'
            @ui.form.fn.hint '(v) => v && v.length !== 2 ? "Use a 2-letter ISO code" : ""'
            @meta.required 'Country code is required'
            @ui.form.order 8
            code: string
        }
    }

    @ui.form.order 10
    contact: {
        @meta.label 'Contact First Name'
        @ui.form.placeholder 'Jane'
        @ui.type 'text'
        @meta.required 'First name is required'
        @ui.form.order 11
        firstName: string

        @meta.label 'Contact Last Name'
        @ui.form.placeholder 'Doe'
        @ui.type 'text'
        @ui.form.order 12
        lastName?: string

        @meta.label 'Contact Email'
        @ui.form.placeholder 'jane@acme.com'
        @ui.type 'text'
        @ui.form.fn.description '(v, data) => data.contact?.firstName ? "Email for " + data.contact.firstName : "Contact email address"'
        @ui.form.order 13
        email?: string.email

        @ui.form.order 14
        department: {
            @meta.label 'Department Name'
            @ui.form.placeholder 'Engineering'
            @ui.type 'text'
            @ui.form.order 15
            name?: string

            @meta.label 'Floor'
            @ui.type 'number'
            @ui.form.order 16
            @expect.min 1, 'Floor must be at least 1'
            @expect.max 100, 'Floor must be at most 100'
            floor?: number

            @meta.label 'Room'
            @ui.form.placeholder 'A-101'
            @ui.type 'text'
            @ui.form.fn.hidden '(v, data) => !data.contact?.department?.floor'
            @ui.form.order 17
            room?: string
        }
    }
}
