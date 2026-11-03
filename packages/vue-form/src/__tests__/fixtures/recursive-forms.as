/// A self-recursive tree: an optional parent and an array of children.
export interface TreeForm {
    name: string
    parent?: TreeForm
    children?: TreeForm[]
}

/// A two-way navigation pair.
export interface ShelfForm {
    name: string

    @db.rel.from
    items?: ShelfItemForm[]
}

export interface ShelfItemForm {
    title: string

    @db.rel.to
    shelf?: ShelfForm
}
