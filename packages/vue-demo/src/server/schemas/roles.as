@db.table 'roles'
export interface RolesTable {
    @meta.id
    @db.default.increment
    id: number

    @meta.label 'Name'
    @db.index.unique 'roles_name_idx'
    name: 'admin' | 'manager' | 'viewer'

    @meta.label 'Description'
    description?: string
}
