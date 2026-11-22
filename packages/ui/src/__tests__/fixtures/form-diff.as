// Fixtures for the form-diff engine (buildFormDiff).
//
// Covers: scalars (set/clear), inlined flat nested objects, structured
// (@meta.label) nested objects (default replace strategy), merge-strategy
// nested objects, 2-level nesting, keyed arrays (@expect.array.key) under the
// default and the merge patch strategy, composite keyed arrays, primitive
// arrays, uniqueItems primitive arrays, union + tuple fields, an
// optimistic-concurrency version column (@db.column.version), and a
// merge-strategy object in every placement (where the merge strategy applies).

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
/// createFormDef still dissolves it into `address.*` dot-paths; the diff
/// still emits a partial, as for a structured merge object.
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

    bin?: string
}

export interface CompositeKeyArrayForm {
    stock: StockLine[]
}

/// Composite-key array tagged @db.patch.strategy 'merge' — `$update` items
/// carry the full composite key + the changed leaves only.
export interface MergeCompositeKeyArrayForm {
    @db.patch.strategy 'merge'
    stock: StockLine[]
}

// ── Keyed arrays under each patch strategy ───────────────────

/// Keyed item with two required non-key fields and an optional one — shows
/// which leaves a `$update` item carries under each array patch strategy.
export interface OrderLine {
    @expect.array.key
    sku: string

    qty: number

    price: number

    note?: string
}

/// Default (replace) strategy: the db replaces a matched element with the
/// `$update` item, so the item is the whole current element.
export interface OrderLinesForm {
    lines: OrderLine[]
}

/// @db.patch.strategy 'merge' on the array: the db merges the `$update` item
/// into the matched element, so the item is the key + the changed leaves.
export interface MergeOrderLinesForm {
    @db.patch.strategy 'merge'
    lines: OrderLine[]
}

/// Keyed item holding a nested object — the db merges a `$update` item one
/// level deep, so under merge a change inside `size` sends the whole `size`.
export interface ParcelLine {
    @expect.array.key
    sku: string

    qty: number

    size: {
        w: number
        h: number
    }
}

/// Default (replace) strategy keyed array of items with a nested object.
export interface ParcelLinesForm {
    lines: ParcelLine[]
}

/// Merge strategy keyed array of items with a nested object.
export interface MergeParcelLinesForm {
    @db.patch.strategy 'merge'
    lines: ParcelLine[]
}

/// Keyed arrays below a structured merge object — the array's own strategy
/// decides the `$update` item shape at any depth.
@meta.label 'Order'
type OrderSection = {
    lines: OrderLine[]

    @db.patch.strategy 'merge'
    mergedLines: OrderLine[]
}

export interface NestedKeyedArraysForm {
    @db.patch.strategy 'merge'
    order: OrderSection
}

// ── Unset values at every depth ──────────────────────────────

@meta.label 'Profile'
type UnsetProfile = {
    bio: string
    nick?: string
}

export interface UnsetLine {
    label: string

    note?: string
}

/// Optional leaves at the top level, in a merge nested object, in an unkeyed
/// object array and in a keyed one — drives the unset equivalence (`null`,
/// `undefined` and an absent prop are one value) and the `""` baseline.
export interface UnsetForm {
    note?: string

    @db.patch.strategy 'merge'
    profile: UnsetProfile

    lines: UnsetLine[]

    items: CartLine[]
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

// ── Renamed version + derived ─────────────────────────────────

/// `@db.column` renames only the storage column — the version field keeps its
/// LOGICAL name (`rev`), which is what `$cas` must carry. `customerId` is a
/// `@db.column.derived` field (server-computed, never sent).
@db.table 'renamed_version_form'
export interface RenamedVersionForm {
    name: string

    @db.column 'row_version'
    @db.column.version
    rev: number

    @db.json
    payload?: {
        customerId: string
    }

    @db.column.derived
    customerId?: RenamedVersionForm.payload.customerId
}

// ── @db.json arrays ───────────────────────────────────────────

@meta.label 'Settings'
type JsonSettings = {
    flags: string[]
    mode?: string
}

/// `@db.json` stores a field as one JSON value: the db applies no array
/// operations inside it, so the patch must carry whole values. `synonyms` /
/// `lines` are `@db.json` arrays (unique primitives / keyed objects), `doc` an
/// inlined `@db.json` object holding an array, `settings` a structured one.
/// `meta` is a plain merge object whose array keeps its operations.
@db.table 'json_array_form'
export interface JsonArrayForm {
    name: string

    @db.json
    @expect.array.uniqueItems
    synonyms?: string[]

    @db.json
    lines?: CartLine[]

    @db.json
    doc?: {
        tags: string[]
        note?: string
    }

    @db.json
    settings?: JsonSettings

    @db.patch.strategy 'merge'
    meta?: {
        @expect.array.uniqueItems
        labels: string[]
        note?: string
    }

    plain?: {
        items: string[]
        note?: string
    }
}

// ── Where the merge strategy applies ─────────────────────────

type PlacedGeo = {
    lat: number
    lng: number
    note?: string
}

/// One type in every kind of place. Its `geo` merges where a patch reaches it
/// by its own path through stored objects (a `T | null` object is a `T`), and
/// is sent whole everywhere else: inside an array or tuple element, a union
/// member, a `@db.json` / `@db.encrypted` field — `mergeStrategyPaths`.
@meta.label 'Prefs'
type PlacedPrefs = {
    theme?: string

    @db.patch.strategy 'merge'
    geo?: PlacedGeo
}

/// Keyed array item holding a merge-strategy object (declared here, so it is
/// no build error inside an array element — and it never merges there).
export interface PlacedLine {
    @expect.array.key
    sku: string

    qty: number

    @db.patch.strategy 'merge'
    geo: PlacedGeo
}

/// `PlacedPrefs` / `PlacedLine` in every placement a form can edit; `card` is
/// an unlabelled (dissolved) `PlacedPrefs`.
@db.table 'merge_placements'
export interface MergePlacementsForm {
    @db.patch.strategy 'merge'
    prefs?: PlacedPrefs

    profile?: PlacedPrefs

    card?: {
        theme?: string

        @db.patch.strategy 'merge'
        geo?: PlacedGeo
    }

    @db.patch.strategy 'merge'
    contact?: PlacedPrefs | null

    @db.json
    saved?: PlacedPrefs

    @db.encrypted
    sealed?: PlacedPrefs

    lines?: PlacedLine[]

    @db.patch.strategy 'merge'
    mergedLines?: PlacedLine[]

    trail?: PlacedPrefs[]

    pair?: [PlacedPrefs, PlacedPrefs]

    pick?: PlacedPrefs | string
}

/// `@db.patch.strategy 'merge'` written on a `@db.json` / `@db.encrypted` field
/// is a build error; added through `annotate` it compiles and has no effect.
annotate MergePlacementsForm {
    @db.patch.strategy 'merge'
    saved

    @db.patch.strategy 'merge'
    sealed
}

/// A recursive merge-strategy type: the merge strategy applies down to where
/// the type repeats (`child`), not below it.
@meta.label 'Node'
export interface MergeTreeNode {
    name: string

    kind: string

    @db.patch.strategy 'merge'
    child?: MergeTreeNode
}

/// Structured (labelled) objects inside dissolved (unlabelled) ones — `box`
/// under the default (replace) strategy, `mergedBox` under merge.
export interface DissolvedHolderForm {
    box: {
        label: string
        geo?: Geo
    }

    @db.patch.strategy 'merge'
    mergedBox: {
        label: string
        geo?: Geo
    }
}
