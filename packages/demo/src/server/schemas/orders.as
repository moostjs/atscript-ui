import { CustomersTable } from './customers'
import { UsersTable } from './users'
import { ProductsTable } from './products'

@db.table 'orders'
export interface OrdersTable {
    @meta.id
    @db.default.increment
    id: number

    @meta.label 'Customer'
    @db.rel.FK
    customerId: CustomersTable.id

    @meta.label 'Assignee'
    @db.rel.FK
    assigneeId?: UsersTable.id

    @meta.label 'Status'
    @db.index.plain 'orders_status_idx'
    @db.default 'pending'
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

    @meta.label 'Lines'
    @db.json
    lines: {
        productId: ProductsTable.id
        quantity: number
        priceAtTime: number
    }[]

    @meta.label 'Total'
    total: number

    @meta.label 'Shipped At'
    shippedAt?: number

    @meta.label 'Created'
    @db.default.now
    createdAt: number
}
