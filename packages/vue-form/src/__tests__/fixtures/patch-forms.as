// Fixtures for the vue-form change-tracking layer (useAsForm({ trackChanges })
// + <AsForm track-changes> + useAsFormPatch). These exercise the wiring of the
// already-tested @atscript/ui `buildFormDiff` engine through the Vue layer:
// scalar edits, keyed-array ops, and the optimistic-concurrency version column.

// ── Plain scalar form ────────────────────────────────────────

/// Drives scalar set / clear + revert-aware dirty tracking.
export interface PatchScalarForm {
    name: string

    age?: number
}

// ── Keyed array of objects ───────────────────────────────────

/// Array item carrying @expect.array.key on `sku` — drives $update / $insert
/// / $remove keyed array ops in the produced patch.
export interface PatchCartLine {
    @expect.array.key
    sku: string

    qty: number

    note?: string
}

export interface PatchArrayForm {
    name: string

    // Default (replace) patch strategy: a `$update` item is the whole item.
    items: PatchCartLine[]
}

// ── Versioned form (optimistic concurrency) ──────────────────

/// Form with a @db.column.version column — $cas auto-lifts the baseline
/// version value as a top-level sibling whenever the patch is non-empty.
export interface PatchVersionedForm {
    name: string

    @db.column.version
    version: number
}

// ── Nested object + keyed array (per-field dirty granularity) ──

/// Nested object container — no change entry at `address` itself, only at its
/// leaves (`address.city`). Drives the object-container-via-prefix dirty case.
export interface PatchAddress {
    city: string

    zip: string
}

/// Combines a scalar (`name`), a nested object (`address`), and a keyed array
/// (`items`) so one form exercises every per-field dirty granularity: scalar
/// leaf, nested leaf, object container (prefix), whole-array (exact), and the
/// array-ITEM leaf (which stays NOT dirty — the array container lights up).
export interface PatchNestedForm {
    name: string

    address: PatchAddress

    items: PatchCartLine[]
}

// ── Inline nested object (real collapsible section) ───────────

/// An INLINE object literal renders as an `AsCollapsible` section, unlike a
/// referenced interface (see `PatchNestedForm.address`) which is inlined into
/// the parent grid. Drives the section-level `data-dirty` hook.
export interface PatchSectionForm {
    name: string

    @meta.label 'Address'
    address: {
        city: string

        zip: string
    }
}

// ── Emptied optional text inputs at every depth ──────────────

export interface PatchContact {
    email: string

    phone?: string
}

/// An optional text leaf at the top level (`remark`), in a nested object
/// (`contact.phone`, merge strategy: the patch carries the changed leaves, a
/// cleared one as `null`) and in a keyed-array row (`items[].note`).
export interface PatchEmptiedTextForm {
    name: string

    remark?: string

    @db.patch.strategy 'merge'
    contact: PatchContact

    items: PatchCartLine[]
}

// ── Composite-key array ──────────────────────────────────────

export interface PatchStockLine {
    @expect.array.key
    warehouse: string

    @expect.array.key
    sku: string

    qty: number
}

export interface PatchStockForm {
    @meta.label 'Stock'
    stock: PatchStockLine[]
}
