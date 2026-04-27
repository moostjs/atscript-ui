import { Product, Customer } from './ref-target'

/// Order form with FK ref fields pointing to Products and Customers tables
@meta.label 'New Order'
@ui.submit.text 'Create Order'
export interface OrderForm {
    @meta.label 'Order Title'
    @meta.required 'Title is required'
    @ui.placeholder 'e.g. Office supplies Q1'
    @ui.order 1
    title: string

    @meta.label 'Customer'
    @ui.placeholder 'Search customers...'
    @ui.order 2
    @db.rel.FK
    customerId?: Customer.id

    @meta.label 'Product'
    @ui.placeholder 'Search products...'
    @ui.order 3
    @db.rel.FK
    productId?: Product.id

    @meta.label 'Quantity'
    @meta.default '1'
    @expect.min 1
    @ui.order 4
    quantity: number

    @meta.label 'Notes'
    @ui.type 'textarea'
    @ui.placeholder 'Optional order notes...'
    @ui.order 5
    notes?: string
}
