@meta.label 'Email contact'
type ResetEmail = {
    @meta.label 'Email'
    email: string
}

@meta.label 'Phone contact'
type ResetPhone = {
    @meta.label 'Phone'
    phone: string
}

/// Every field kind a form reset returns to its empty-form value (since 0.1.177).
export interface ResetForm {
    @meta.label 'Count'
    @expect.max 100
    count: number

    @meta.label 'Active'
    active: boolean

    @meta.label 'Status'
    @ui.form.options 'Draft', 'draft'
    @ui.form.options 'Done', 'done'
    status: 'draft' | 'done'

    @meta.label 'Priority'
    @ui.form.type 'radio'
    @ui.form.options 'Low', 'low'
    @ui.form.options 'High', 'high'
    priority: string

    @meta.label 'Due'
    @ui.form.type 'date'
    due: string

    @meta.label 'Title'
    title: string

    @meta.label 'Optional count'
    optCount?: number

    @meta.label 'Optional active'
    optActive?: boolean

    @meta.label 'Optional status'
    @ui.form.options 'Draft', 'draft'
    @ui.form.options 'Done', 'done'
    optStatus?: 'draft' | 'done'

    @meta.label 'Optional due'
    @ui.form.type 'date'
    optDue?: string

    @meta.label 'Optional title'
    optTitle?: string

    @meta.label 'Name'
    @meta.default 'Untitled'
    name: string

    @meta.label 'Seats'
    @meta.default '4'
    seats: number

    @meta.label 'Greeting'
    @meta.default 'Hello'
    greeting?: string

    @meta.label 'Address'
    address: {
        @meta.label 'Street'
        street: string

        @meta.label 'Zip'
        zip: number
    }

    @meta.label 'Extra'
    extra?: {
        @meta.label 'Note'
        note: string
    }

    @meta.label 'Lines'
    @ui.form.label.singular 'line'
    lines: {
        @meta.label 'SKU'
        sku: string

        @meta.label 'Qty'
        qty: number
    }[]

    @meta.label 'Point'
    point: [number, number]

    @meta.label 'Contact'
    contact?: ResetEmail | ResetPhone
}

export interface ResetChild {
    title: string
}

/// A stored row in an edit form: the version column and the navigation field
/// are not form fields, so a reset leaves them as they are.
export interface ResetStoredRow {
    @meta.label 'Name'
    name: string

    @db.column.version
    version: number

    @db.rel.from
    children?: ResetChild[]
}

/// Custom components registering a `resetValue` inside an array row and an
/// optional object — fields a reset removes.
export interface ResetCustomForm {
    @meta.label 'Lines'
    lines: {
        @meta.label 'SKU'
        @ui.form.component 'resetting'
        sku: string
    }[]

    @meta.label 'Extra'
    extra?: {
        @meta.label 'Note'
        @ui.form.component 'resetting'
        note: string
    }
}
