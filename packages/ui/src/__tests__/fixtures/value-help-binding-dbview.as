import { AttributeValue } from './value-help-binding-target'

@db.table 'items'
export interface Item {
    @meta.id
    @db.default.increment
    id: number

    @ui.valueHelp AttributeValue, 'value', `attribute = 'color'`
    color: string
}

/// A `@db.view` over the table: its column inherits the binding through the chain ref
@db.view 'items_view'
@db.view.for Item
export interface ItemView {
    @meta.id
    id: Item.id

    color: Item.color
}
