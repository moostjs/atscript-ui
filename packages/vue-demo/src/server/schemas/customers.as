@db.table 'customers'
export interface CustomersTable {
    @meta.id
    @db.default.increment
    id: number

    @meta.label 'Name'
    @db.index.fulltext 'customers_search'
    name: string

    @meta.label 'Email'
    @db.index.unique 'customers_email_idx'
    email: string

    @meta.label 'Address'
    @db.json
    address: {
        street: string
        city: string
        state: string
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
    createdAt: number
}
