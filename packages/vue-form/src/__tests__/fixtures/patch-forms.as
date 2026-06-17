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
}

export interface PatchArrayForm {
    name: string

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
