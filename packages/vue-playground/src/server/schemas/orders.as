import { Product, Customer } from '../../forms/ref-target'

@db.table 'orders'
export interface OrdersTable {
    @meta.id
    @db.default.increment
    id: number

    @meta.label 'Customer'
    @db.rel.FK
    customerId: Customer.id

    @meta.label 'Product'
    @db.rel.FK
    productId: Product.id

    @meta.label 'Quantity'
    @db.default '1'
    quantity: number

    @meta.label 'Total'
    total: number

    @meta.label 'Status'
    status: 'pending' | 'shipped' | 'delivered' | 'cancelled'

    @meta.label 'Created'
    @db.default.now
    createdAt: number
}
