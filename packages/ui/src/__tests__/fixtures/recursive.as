// ── Recursive types (cycle-safe walkers) ─────────────────────

/// Self-recursive tree: an optional child and an array of children.
export interface TreeNode {
    name: string
    parent?: TreeNode
    children?: TreeNode[]
}

/// Mutual recursion through plain (non-db) objects.
export interface MutualA {
    title: string
    b?: MutualB
}

export interface MutualB {
    count: number
    a?: MutualA
}

/// A union that contains the type itself.
export interface UnionNode {
    label: string
    next?: UnionNode | string
}

/// Two-way navigation pair: `RecShelf.items` (`@db.rel.from`) back to
/// `RecItem.shelf` (`@db.rel.to`).
@db.table 'rec_shelves'
export interface RecShelf {
    @meta.id
    id: number

    name: string

    @db.rel.from
    items?: RecItem[]
}

@db.table 'rec_items'
export interface RecItem {
    @meta.id
    id: number

    title: string

    @db.rel.FK
    shelfId: RecShelf.id

    @db.rel.to
    shelf?: RecShelf
}

/// Self-referencing table: a parent FK and both nav directions.
@db.table 'rec_categories'
export interface RecCategory {
    @meta.id
    id: number

    name: string

    @db.rel.FK
    parentId?: RecCategory.id

    @db.rel.to
    parent?: RecCategory

    @db.rel.from
    children?: RecCategory[]
}

/// A nav field opted into the form by an explicit `@ui.form.*` annotation.
@db.table 'rec_shelves_ui'
export interface RecShelfWithItems {
    @meta.id
    id: number

    name: string

    @db.rel.from
    @ui.form.order 5
    items?: RecItemOfUiShelf[]
}

@db.table 'rec_items_ui'
export interface RecItemOfUiShelf {
    @meta.id
    id: number

    title: string

    @db.rel.FK
    shelfId: RecShelfWithItems.id

    @db.rel.to
    shelf?: RecShelfWithItems
}

/// A recursive alias without an object in between.
export type RecJson = string | number | RecJson[]

export interface JsonHolder {
    data?: RecJson
}

/// Recursion back to the same array prop through an object inlined into the
/// item: `W.m` is a namespace, so `M.kids` sits at `m.kids` inside a W item.
export interface RecM {
    title: string
    kids?: RecW[]
}

export interface RecW {
    label: string
    m: RecM
}

/// The same through a union.
export interface RecMU {
    title: string
    x?: RecWU | string
}

export interface RecWU {
    label: string
    m: RecMU
}

/// A recursive tuple alias.
export type RecTuple = [string, RecTuple | null]

export interface TupleHolder {
    t?: RecTuple
}

/// Both sides of a navigation pair opted in with a placement key only.
@db.table 'rec_both_shelves'
export interface RecBothShelf {
    @meta.id
    id: number

    name: string

    @db.rel.from
    @ui.form.order 3
    items?: RecBothItem[]
}

@db.table 'rec_both_items'
export interface RecBothItem {
    @meta.id
    id: number

    title: string

    @db.rel.FK
    shelfId: RecBothShelf.id

    @db.rel.to
    @ui.form.order 2
    shelf?: RecBothShelf
}
