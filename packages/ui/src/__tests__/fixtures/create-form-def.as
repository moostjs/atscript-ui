// ── Object types — basic shape + rootField/flatMap probes ────

/// Simple object with string/number/boolean — also used as the source
/// for a "plain string" prop in non-object-root tests.
export interface SimpleObject {
    name: string
    age: number
    active: boolean
}

/// Object with three ordered fields — sort order: 1, 2, 3.
export interface ObjectWithOrder {
    @ui.form.order 2
    email: string

    @ui.form.order 1
    name: string

    @ui.form.order 3
    bio: string
}

/// One ordered + one unordered field — unordered must come last.
export interface PartialOrderObject {
    unordered: string

    @ui.form.order 1
    first: string
}

/// @ui.type overrides default type inference for primitives.
export interface TextareaObject {
    @ui.type 'textarea'
    bio: string
}

/// Hidden field must still appear in fields[].
export interface HiddenObject {
    @ui.form.hidden
    secret: string

    visible: string
}

/// Phantom prop — ui.paragraph is the closest @-level phantom; the test
/// only asserts `phantom === true`, not the type.
export interface PhantomObject {
    note: ui.paragraph
}

/// Object with a single static field — used to assert allStatic is true.
export interface StaticObject {
    name: string
}

/// Object with a numeric `version` column — opts.versionColumn must
/// skip it from fields[] while keeping it in flatMap.
export interface VersionedObject {
    name: string
    age: number
    version: number
}

// ── Nested objects ────────────────────────────────────────────

/// Flat inner with no @meta.label / @ui.form.component — inlined.
export interface FlatNestedObject {
    address: {
        street: string
        city: string
    }
}

/// Inner with @meta.label — kept as a structured object field.
@meta.label 'Address'
type LabeledAddress = {
    street: string
}

export interface LabeledNestedObject {
    address: LabeledAddress
}

/// Inner with @ui.form.component — kept as a structured object field.
@ui.form.component 'custom-address'
type ComponentAddress = {
    street: string
}

export interface ComponentNestedObject {
    address: ComponentAddress
}

/// Inner with @meta.label + @ui.form.type — `customType` surfaces.
@meta.label 'Address'
@ui.form.type 'address-card'
type LabeledTypedAddress = {
    street: string
}

export interface LabeledTypedNestedObject {
    address: LabeledTypedAddress
}

// ── Array fields ─────────────────────────────────────────────

/// Object containing a plain string array.
export interface ArrayOfString {
    tags: string[]
}

/// Array with @ui.form.type override — customType: 'tag-input'.
export interface ArrayWithFormType {
    @ui.form.type 'tag-input'
    tags: string[]
}

/// Object used as the source for a root-level array prop —
/// `RootArrayContainer.type.props.get('items')` is the array itself.
export interface RootArrayContainer {
    items: string[]
}

// ── Union fields ─────────────────────────────────────────────

/// Heterogeneous string|number union — multi-variant.
/// Also used by buildUnionVariants tests.
export interface MultiVariantUnion {
    value: string | number
}

/// Pure literal union → renders as <select>.
export interface PureLiteralUnion {
    choice: 'a' | 'b'
}

/// Pure literal union + @ui.type 'radio' override.
export interface LiteralUnionRadio {
    @ui.type 'radio'
    choice: 'a' | 'b'
}

/// Mixed union (literal + number) — stays as union.
export interface MixedUnion {
    value: 'a' | number
}

/// Multi-variant union + @ui.form.type — customType: 'contact-card'.
export interface UnionWithFormType {
    @ui.form.type 'contact-card'
    contact: string | number
}

// ── Tuples ───────────────────────────────────────────────────

/// 2-tuple [string, number].
export interface TupleTwo {
    pair: [string, number]
}

/// 3-tuple [number, number, number] with @ui.form.type override.
export interface TupleRgbPicker {
    @ui.form.type 'rgb-picker'
    logoRgb: [number, number, number]
}

// ── Primitive tags ───────────────────────────────────────────

/// ui.select primitive → select type.
export interface SelectTagObject {
    choice: ui.select
}

/// ui.radio primitive → radio type.
export interface RadioTagObject {
    choice: ui.radio
}

/// ui.action primitive → action type + phantom.
export interface ActionTagObject {
    submit: ui.action
}

/// ui.select + @ui.type override.
export interface SelectTagWithUiType {
    @ui.type 'custom-select'
    choice: ui.select
}

// ── Measurement & date dispatch ──────────────────────────────

/// number.timestamp → datetime type.
export interface TimestampObject {
    at: number.timestamp
}

/// decimal design type → decimal type.
export interface DecimalObject {
    score: decimal
}

/// decimal + @db.amount.currency → decimal type.
export interface DecimalCurrencyObject {
    @db.amount.currency 'EUR'
    total: decimal
}

/// number + @db.unit → number type (single-input with suffix).
export interface NumberUnitObject {
    @db.unit 'kg'
    weight: number
}

/// decimal + @db.unit → decimal type.
export interface DecimalUnitObject {
    @db.unit '°C'
    temperature: decimal
}

/// number + @db.unit.ref → number type.
export interface NumberUnitRefObject {
    unitCode: string

    @db.unit.ref 'unitCode'
    weight: number
}

/// number + @ui.form.prefix → number type.
export interface NumberPrefixObject {
    @ui.form.prefix '+1'
    rate: number
}

/// decimal + @ui.form.suffix → decimal type.
export interface DecimalSuffixObject {
    @ui.form.suffix '/100'
    score: decimal
}

/// number + @ui.form.suffix.ref → number type.
export interface NumberSuffixRefObject {
    unit: string

    @ui.form.suffix.ref 'unit'
    quantity: number
}

/// decimal + @ui.form.prefix.ref → decimal type.
export interface DecimalPrefixRefObject {
    currency: string

    @ui.form.prefix.ref 'currency'
    amt: decimal
}

/// Plain number — falls through to designType branch.
export interface PlainNumberObject {
    count: number
}

/// string + @ui.form.type 'date' → date input.
export interface StringDateObject {
    @ui.form.type 'date'
    d: string
}

// ── buildUnionVariants helpers ───────────────────────────────

/// Union with an object variant carrying @meta.label 'Person'.
/// Used to assert variant label resolution for object items.
@meta.label 'Person'
type Person = {
    name: string
}

export interface PersonStringUnion {
    val: Person | string
}

// ── Declared form actions ────────────────────────────────────

/// One data field + one `@ui.form.action` field — getDeclaredFormActions must
/// yield the action id (withData:false) and skip the plain data field.
export interface FormWithAction {
    @meta.label 'Username'
    username: string

    @meta.label 'Resend Code'
    @ui.form.action 'resend', 'Resend'
    resendAction: ui.action
}
