import { Product, Customer } from './ref-target'

/// Order form with FK ref fields pointing to Products and Customers tables
@meta.label 'New Order'
@ui.form.submit.text 'Create Order'
export interface OrderForm {
    @meta.label 'Order Title'
    @meta.required 'Title is required'
    @ui.form.placeholder 'e.g. Office supplies Q1'
    @ui.form.order 1
    title: string

    @meta.label 'Customer'
    @ui.form.placeholder 'Search customers...'
    @ui.form.order 2
    @db.rel.FK
    customerId?: Customer.id

    @meta.label 'Product'
    @ui.form.placeholder 'Search products...'
    @ui.form.order 3
    @db.rel.FK
    productId?: Product.id

    @meta.label 'Quantity'
    @meta.default '1'
    @expect.min 1
    @ui.form.order 4
    quantity: number

    @meta.label 'Notes'
    @ui.type 'textarea'
    @ui.form.placeholder 'Optional order notes...'
    @ui.form.order 5
    notes?: string
}
