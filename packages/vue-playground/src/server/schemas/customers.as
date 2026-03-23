@db.table 'customers'
export interface CustomersTable {
    @meta.id
    @db.default.increment
    id: number

    @meta.label 'First Name'
    firstName: string

    @meta.label 'Last Name'
    lastName: string

    @meta.label 'Email'
    @db.index.unique 'email_idx'
    email: string

    @meta.label 'Phone'
    phone?: string

    @meta.label 'City'
    city?: string

    @meta.label 'Country'
    country?: string

    @meta.label 'Active'
    @db.default 'true'
    active: boolean

    @meta.label 'Joined'
    @db.default.now
    joinedAt: number
}
