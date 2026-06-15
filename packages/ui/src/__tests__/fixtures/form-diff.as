// Fixtures for the form-diff engine (buildFormDiff).
//
// Covers: scalars (set/clear), inlined flat nested objects, structured
// (@meta.label) nested objects (default replace strategy), merge-strategy
// nested objects, 2-level nesting, keyed arrays (@expect.array.key), composite
// keyed arrays, primitive arrays, uniqueItems primitive arrays, union + tuple
// fields, and an optimistic-concurrency version column (@db.column.version).

// ── Scalars + clear ──────────────────────────────────────────

/// Plain scalar object — drives scalar set / clear branches.
export interface ScalarForm {
    name: string

    age?: number

    active: boolean
}

// ── Inlined flat nested object (default replace strategy) ─────

/// Inner object with NO @meta.label / @ui.form.component — createFormDef
/// inlines its leaves as `address.street` / `address.city`. With the DEFAULT
/// (replace) patch strategy the diff engine emits the WHOLE sub-object.
export interface InlineNestedForm {
    name: string

    address: {
        street: string
        city: string
    }
}

// ── Structured (labeled) nested object (default replace) ──────

@meta.label 'Address'
type LabeledAddr = {
    street: string
    city: string
}

/// Inner object WITH @meta.label — createFormDef keeps it as a structured
/// FormObjectFieldDef and the engine recurses into objectDef. Default replace
/// strategy → whole sub-object emitted.
export interface StructNestedForm {
    name: string

    address: LabeledAddr
}

// ── Inlined object with merge strategy ───────────────────────

/// Inlined (unlabelled) object tagged @db.patch.strategy 'merge' on the prop.
/// createFormDef still dissolves it into `address.*` dot-paths, but the diff
/// engine must read the prop's merge strategy via flatMap and emit a partial.
export interface InlineMergeForm {
    name: string

    @db.patch.strategy 'merge'
    address: {
        street: string
        city: string
    }
}

// ── Merge-strategy nested object ─────────────────────────────

@meta.label 'Profile'
type MergeProfile = {
    bio: string
    nick: string
}

/// Inner object tagged @db.patch.strategy 'merge' — the engine emits a
/// changed-leaves-only nested partial.
export interface MergeNestedForm {
    name: string

    @db.patch.strategy 'merge'
    profile: MergeProfile
}

/// Optional merge-strategy object — drives the wholesale-clear (obj: null) path.
export interface OptionalMergeForm {
    name: string

    @db.patch.strategy 'merge'
    profile?: MergeProfile
}

// ── Two-level nested object ──────────────────────────────────

@meta.label 'Geo'
type Geo = {
    lat: number
    lng: number
}

@meta.label 'Location'
type Location = {
    label: string
    geo: Geo
}

/// 2-level nesting (object inside object), both default replace. Changing a
/// leaf inside `geo` must emit the whole `location` (replace), which in turn
/// carries the whole `geo` sub-object.
export interface DeepNestedForm {
    name: string

    location: Location
}

// ── Keyed array of objects ───────────────────────────────────

/// Array item carrying a @expect.array.key on `sku` — drives $update / $insert
/// / $remove diffing keyed by sku.
export interface CartLine {
    @expect.array.key
    sku: string

    qty: number

    note?: string
}

export interface KeyedArrayForm {
    items: CartLine[]
}

// ── Composite-key array of objects ───────────────────────────

/// Array item carrying TWO @expect.array.key props — drives composite-key
/// matching (warehouse + sku).
export interface StockLine {
    @expect.array.key
    warehouse: string

    @expect.array.key
    sku: string

    qty: number
}

export interface CompositeKeyArrayForm {
    stock: StockLine[]
}

// ── Primitive array (unkeyed) ────────────────────────────────

/// Plain string array — unkeyed, drives $replace.
export interface PrimitiveArrayForm {
    tags: string[]
}

// ── Primitive array with uniqueItems ─────────────────────────

/// String array tagged @expect.array.uniqueItems — drives by-value
/// $insert/$remove path.
export interface UniqueArrayForm {
    @expect.array.uniqueItems
    tags: string[]
}

// ── Union + tuple fields ─────────────────────────────────────

/// Form with a multi-variant union and a tuple — both diffed as whole-value
/// 'set'.
export interface UnionTupleForm {
    name: string

    pick: string | number

    pair: [number, number]
}

// ── Versioned form (optimistic concurrency) ──────────────────

/// Form with a @db.column.version column — $cas auto-lifts the baseline
/// version value as a top-level sibling. (Type is `number`; the `int`
/// resolution constraint is a db schema-sync concern, not a parser one.)
export interface VersionedForm {
    name: string

    @db.column.version
    version: number
}

// ── Combined: scalar + nested + keyed array + version ─────────

/// Kitchen-sink form exercising every branch in a single diff. `address` is a
/// merge-strategy object so its diff stays a partial.
export interface ComboForm {
    title: string

    @db.patch.strategy 'merge'
    address: LabeledAddr

    lines: CartLine[]

    @db.column.version
    version: number
}
