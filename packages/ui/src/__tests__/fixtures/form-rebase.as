// Fixtures for the 3-way form-rebase engine (buildFormRebase) and the
// change-apply engine (applyFormChanges).
//
// Covers: scalars, an optional nested object (default replace — drives the
// ancestor-clear path when upstream nulls the whole object), a keyed array, and
// a discriminated union.

// ── Scalars ──────────────────────────────────────────────────

/// Two independent scalars — drives local-only X + upstream-only Y both
/// surviving a rebase.
export interface RebaseScalarForm {
    name: string

    nick?: string

    age?: number
}

// ── Optional nested object (default replace) ─────────────────

@meta.label 'Address'
type RebaseAddr = {
    street: string
    city: string
}

/// Optional structured object. With the DEFAULT (replace) strategy and an
/// optional prop, upstream can clear the whole object to null — driving the
/// ancestor-clear conflict when local edited a leaf under it.
export interface RebaseNestedForm {
    name: string

    address?: RebaseAddr
}

// ── Keyed array ──────────────────────────────────────────────

/// Array item with a @expect.array.key on `sku`.
export interface RebaseLine {
    @expect.array.key
    sku: string

    qty: number
}

export interface RebaseArrayForm {
    items: RebaseLine[]
}

// ── Combined scalar + nested + array ─────────────────────────

/// Two nested leaves under one object — proves leaf granularity (local edits
/// one leaf, upstream edits the sibling leaf, both survive).
@meta.label 'Profile'
type RebaseProfile = {
    bio: string
    nick: string
}

export interface RebaseComboForm {
    name: string

    profile: RebaseProfile
}
