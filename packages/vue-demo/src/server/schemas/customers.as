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

    @meta.label 'Created'
    @db.default.now
    createdAt: number.timestamp
}
