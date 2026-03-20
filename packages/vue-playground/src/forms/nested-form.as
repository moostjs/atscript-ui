@meta.label 'Company Profile'
@ui.submit.text 'Save Profile'
export interface NestedForm {
    @meta.label 'Company Name'
    @ui.placeholder 'Acme Corp'
    @ui.type 'text'
    @meta.required 'Company name is required'
    @ui.order 1
    companyName: string

    @meta.label 'Headquarters'
    @ui.order 2
    address: {
        @meta.label 'Street'
        @ui.placeholder '123 Main St'
        @ui.type 'text'
        @meta.required 'Street is required'
        @ui.order 3
        street: string

        @meta.label 'City'
        @ui.placeholder 'New York'
        @ui.type 'text'
        @meta.required 'City is required'
        @ui.order 4
        city: string

        @meta.label 'ZIP Code'
        @ui.placeholder '10001'
        @ui.type 'text'
        @meta.required 'ZIP code is required'
        @ui.order 5
        zip: string

        @ui.order 6
        country: {
            @meta.label 'Country Name'
            @ui.placeholder 'United States'
            @ui.type 'text'
            @meta.required 'Country name is required'
            @ui.order 7
            name: string

            @meta.label 'Country Code'
            @ui.placeholder 'US'
            @ui.type 'text'
            @ui.fn.hint '(v) => v && v.length !== 2 ? "Use a 2-letter ISO code" : ""'
            @meta.required 'Country code is required'
            @ui.order 8
            code: string
        }
    }

    @ui.order 10
    contact: {
        @meta.label 'Contact First Name'
        @ui.placeholder 'Jane'
        @ui.type 'text'
        @meta.required 'First name is required'
        @ui.order 11
        firstName: string

        @meta.label 'Contact Last Name'
        @ui.placeholder 'Doe'
        @ui.type 'text'
        @ui.order 12
        lastName?: string

        @meta.label 'Contact Email'
        @ui.placeholder 'jane@acme.com'
        @ui.type 'text'
        @ui.fn.description '(v, data) => data.contact?.firstName ? "Email for " + data.contact.firstName : "Contact email address"'
        @ui.order 13
        email?: string.email

        @ui.order 14
        department: {
            @meta.label 'Department Name'
            @ui.placeholder 'Engineering'
            @ui.type 'text'
            @ui.order 15
            name?: string

            @meta.label 'Floor'
            @ui.type 'number'
            @ui.order 16
            @expect.min 1, 'Floor must be at least 1'
            @expect.max 100, 'Floor must be at most 100'
            floor?: number

            @meta.label 'Room'
            @ui.placeholder 'A-101'
            @ui.type 'text'
            @ui.fn.hidden '(v, data) => !data.contact?.department?.floor'
            @ui.order 17
            room?: string
        }
    }
}
