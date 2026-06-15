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
