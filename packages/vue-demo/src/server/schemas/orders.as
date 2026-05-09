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
    @ui.form.grid.colSpan 'half'
    customerId: CustomersTable.id

    @meta.label 'Assignee'
    @db.rel.FK
    @ui.form.grid.colSpan 'half'
    assigneeId?: UsersTable.id

    @meta.label 'Status'
    @db.index.plain 'orders_status_idx'
    @db.default 'pending'
    @ui.table.component 'status-badge'
    @ui.form.grid.colSpan 'half'
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

    @meta.label 'Currency'
    @db.column.dimension
    @ui.form.grid.colSpan 'half'
    currency: db.currencyCode

    @meta.label 'Lines'
    @ui.form.label.singular 'line'
    @db.json
    lines: {
        @ui.form.grid.colSpan '6'
        productId: ProductsTable.id

        @ui.form.grid.colSpan '3'
        quantity: number

        @ui.form.grid.colSpan '3'
        priceAtTime: decimal
    }[]

    @meta.label 'Total'
    @db.amount.currency.ref 'currency'
    @db.column.precision 10, 2
    @db.column.measure
    @db.index.plain 'orders_total_idx'
    @ui.form.grid.colSpan 'half'
    total: decimal

    @meta.label 'Shipped At'
    @ui.form.grid.colSpan 'half'
    shippedAt?: number.timestamp

    @meta.label 'Created'
    @db.default.now
    createdAt: number.timestamp
}
