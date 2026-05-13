import { CustomersTable } from './customers'
import { UsersTable } from './users'
import { ProductsTable } from './products'

@meta.label 'Credit card'
type OrderPaymentCard = {
    @meta.label 'kind'
    @ui.form.hidden
    kind: 'card'

    @meta.label 'Last 4'
    @meta.required 'Last-4 digits required'
    last4: string
}

@meta.label 'Bank transfer'
type OrderPaymentBank = {
    @meta.label 'kind'
    @ui.form.hidden
    kind: 'bank'

    @meta.label 'IBAN'
    @meta.required 'IBAN required'
    iban: string
}

@meta.label 'Invoice'
type OrderPaymentInvoice = {
    @meta.label 'kind'
    @ui.form.hidden
    kind: 'invoice'

    @meta.label 'Invoice #'
    @meta.required 'Invoice number required'
    invoiceNumber: string

    @meta.label 'Net days'
    netDays?: number
}

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

    @meta.label 'Payment method'
    @meta.description 'Optional discriminated union — `kind` selects the variant.'
    @db.json
    @ui.table.hidden
    paymentMethod?: OrderPaymentCard | OrderPaymentBank | OrderPaymentInvoice

    @meta.label 'Note'
    @meta.description 'Mixed-shape union — string[] or { author, body }. Demonstrates per-row cell dispatch.'
    @db.json
    @ui.form.hidden
    note?: string[] | {
        @meta.label 'Author'
        author: string

        @meta.label 'Body'
        body: string
    }

    @meta.label 'Created'
    @db.default.now
    createdAt: number.timestamp
}
