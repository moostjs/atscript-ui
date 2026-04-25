import { RolesTable } from './roles'

@db.table 'users'
export interface UsersTable {
    @meta.id
    @db.default.increment
    id: number

    @meta.label 'Username'
    @db.index.unique 'users_username_idx'
    @db.index.fulltext 'users_search'
    username: string

    @meta.label 'Email'
    @db.index.unique 'users_email_idx'
    @db.index.fulltext 'users_search'
    email: string

    @meta.label 'Role'
    @db.rel.FK
    roleId: RolesTable.id

    @meta.label 'Status'
    @db.index.plain 'users_status_idx'
    @db.default 'pending'
    status: 'active' | 'suspended' | 'pending' | 'invited'

    @meta.label 'MFA Enabled'
    @db.default 'false'
    mfaEnabled: boolean

    @meta.label 'Last Login'
    lastLoginAt?: number

    // filled by P6 workflows; empty until then
    password?: string
    salt?: string

    @meta.label 'Created'
    @db.default.now
    createdAt: number
}
