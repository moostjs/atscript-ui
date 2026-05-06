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
    @ui.table.component 'status-badge'
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

    @meta.label 'Currency'
    @db.column.dimension
    currency: db.currencyCode

    @meta.label 'Lines'
    @db.json
    lines: {
        productId: ProductsTable.id
        quantity: number
        priceAtTime: decimal
    }[]

    @meta.label 'Total'
    @db.amount.currency.ref 'currency'
    @db.column.precision 10, 2
    @db.column.measure
    @db.index.plain 'orders_total_idx'
    total: decimal

    @meta.label 'Shipped At'
    shippedAt?: number.timestamp

    @meta.label 'Created'
    @db.default.now
    createdAt: number.timestamp
}
