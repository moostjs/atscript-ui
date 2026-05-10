@meta.label 'Email contact'
type CustomerEmailContact = {
    @meta.label 'Email'
    @meta.required 'Email is required'
    email: string

    @meta.label 'HTML newsletter'
    htmlNewsletter?: boolean
}

@meta.label 'Phone contact'
type CustomerPhoneContact = {
    @meta.label 'Phone'
    @meta.required 'Phone is required'
    phone: string
}

@meta.label 'Postal contact'
type CustomerPostalContact = {
    @meta.label 'Street'
    @meta.required 'Street is required'
    street: string

    @meta.label 'City'
    @meta.required 'City is required'
    city: string
}

@db.table 'customers'
export interface CustomersTable {
    @meta.id
    @db.default.increment
    id: number

    @meta.label 'Name'
    @db.index.fulltext 'customers_search'
    @ui.form.grid.colSpan 'half'
    name: string

    @meta.label 'Email'
    @db.index.unique 'customers_email_idx'
    @ui.form.grid.colSpan 'half'
    email: string

    @meta.label 'Address'
    @db.json
    address: {
        street: string

        @ui.form.grid.colSpan 'third'
        city: string

        @ui.form.grid.colSpan 'third'
        state: string

        @ui.form.grid.colSpan 'third'
        zip: string

        country: string
    }

    @meta.label 'Preferences'
    @db.json
    preferences: {
        newsletter: boolean
        channel: 'email' | 'sms' | 'none'
    }

    @meta.label 'Primary contact'
    @meta.description 'Optional fingerprint union — variant detected by required-prop set.'
    @db.json
    @ui.table.hidden
    primaryContact?: CustomerEmailContact | CustomerPhoneContact | CustomerPostalContact

    @meta.label 'Created'
    @db.default.now
    createdAt: number.timestamp
}
