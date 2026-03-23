@meta.label 'Array Examples'
@ui.submit.text 'Save'
export interface ArrayForm {
    @meta.default 'Manage your project arrays below.'
    @ui.order 0
    instructions: ui.paragraph

    @meta.label 'Name'
    @ui.placeholder 'Project name'
    @ui.type 'text'
    @meta.required 'Name is required'
    @ui.order 1
    name: string

    // Simple string array
    @meta.label 'Tags'
    @ui.order 2
    @ui.array.add.label 'Add tag'
    @ui.array.remove.label 'x'
    @expect.maxLength 5, 'Maximum 5 tags'
    tags: string[]

    // Simple number array
    @meta.label 'Scores'
    @ui.order 3
    @ui.array.add.label 'Add score'
    @expect.minLength 1, 'At least one score required'
    @expect.maxLength 10, 'Maximum 10 scores'
    scores: number[]

    // Object array
    @meta.label 'Addresses'
    @ui.order 4
    @ui.array.add.label 'Add address'
    @ui.array.remove.label 'Remove address'
    addresses: Address[]

    // Grouped nested object (not an array)
    @meta.label 'Settings'
    @ui.order 5
    settings: {
        @meta.label 'Notify by email'
        @ui.order 1
        emailNotify: ui.checkbox

        @meta.label 'Max items per page'
        @ui.type 'number'
        @ui.order 2
        @expect.min 1, 'At least 1'
        @expect.max 100, 'At most 100'
        pageSize?: number
    }

    // Union array (mixed types)
    @meta.label 'Contacts'
    @ui.order 6
    @ui.array.add.label 'Add contact'
    contacts: ({
        @meta.label 'Full Name'
        @ui.placeholder 'Jane Doe'
        @ui.type 'text'
        @meta.required 'Name is required'
        fullName: string

        @meta.label 'Email'
        @ui.placeholder 'jane@example.com'
        @ui.type 'text'
        email?: string.email

        @meta.label 'Phone'
        @ui.placeholder '+1 555 0123'
        @ui.type 'text'
        phone?: string
    } | string)[]

    // Action button
    @meta.label 'Clear All Arrays'
    @ui.form.action 'clear-arrays'
    @ui.order 9
    clearAction: ui.action
}

@meta.label 'Address'
interface Address {
    @meta.label 'Street'
    @ui.placeholder '123 Main St'
    @ui.type 'text'
    @meta.required 'Street is required'
    street: string

    @meta.label 'City'
    @ui.placeholder 'New York'
    @ui.type 'text'
    @meta.required 'City is required'
    city: string

    @meta.label 'ZIP'
    @ui.placeholder '10001'
    @ui.type 'text'
    zip?: string
}
