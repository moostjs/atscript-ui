@meta.label 'Edit Order'
@meta.description 'A pre-loaded order record. Edit the fields below and watch the live @atscript/db patch update on the right.'
@ui.form.submit.text 'Save changes'
export interface ChangeTrackingOrder {
    // ── Scalars ─────────────────────────────────────────────
    @meta.label 'Reference'
    @meta.description 'Human-readable order reference.'
    @ui.form.grid.colSpan 'half'
    reference: string

    @meta.label 'Status'
    @ui.form.options 'Draft', 'draft'
    @ui.form.options 'Confirmed', 'confirmed'
    @ui.form.options 'Shipped', 'shipped'
    @ui.form.options 'Cancelled', 'cancelled'
    @ui.form.grid.colSpan 'half'
    status: 'draft' | 'confirmed' | 'shipped' | 'cancelled'

    @meta.label 'Priority order'
    @meta.description 'Toggle to flip the boolean — produces a single SET in the patch.'
    priority: boolean

    @meta.label 'Notes'
    @ui.form.placeholder 'Anything the warehouse should know…'
    notes?: string

    // ── Merge-strategy nested object ────────────────────────
    // @db.patch.strategy 'merge' → only the changed leaf is emitted, not the
    // whole address sub-object (default strategy would REPLACE the whole thing).
    @meta.label 'Shipping address'
    @db.patch.strategy 'merge'
    address: {
        @meta.label 'Street'
        @ui.form.grid.colSpan 'half'
        street: string

        @meta.label 'City'
        @ui.form.grid.colSpan 'half'
        city: string

        @meta.label 'Postcode'
        @ui.form.grid.colSpan 'half'
        postcode: string
    }

    // ── Keyed array of objects ──────────────────────────────
    // @expect.array.key on `sku` → the diff matches items by sku and emits
    // $update (changed leaves), $insert (new sku) and $remove (dropped sku),
    // instead of replacing the whole array.
    @meta.label 'Line items'
    @meta.description 'Edit a quantity (→ $update), add a row (→ $insert), or remove one (→ $remove). Matched by SKU.'
    @ui.form.label.singular 'line item'
    @expect.minLength 1, 'At least one line item is required'
    items: ChangeTrackingLine[]

    // ── Optimistic concurrency (version column) ─────────────
    // @db.column.version → getPatch() lifts the baseline version into a
    // top-level `$cas: { version: <n> }` sibling and never emits version as a
    // normal SET. Server-managed; we seed it as an int in the baseline.
    @meta.label 'Version'
    @db.column.version
    version: number.int
}

export interface ChangeTrackingLine {
    @meta.label 'SKU'
    @ui.form.placeholder 'SKU-001'
    @meta.required 'SKU is required'
    @ui.form.grid.colSpan '4'
    @expect.array.key
    sku: string

    @meta.label 'Description'
    @ui.form.placeholder 'Widget'
    @ui.form.grid.colSpan '5'
    description: string

    @meta.label 'Qty'
    @ui.form.placeholder '1'
    @ui.form.grid.colSpan '3'
    qty: number.int
}
