/// Fixtures backing create-table-def.spec.ts.
/// Each interface targets one (or a small family of) tests covering a
/// specific column-resolution behaviour: design-type inference, label /
/// order / visibility / width annotations, quantity tagging
/// (currency / unit / precision), nested object handling, unions, etc.

/// Three primitive props (string, number, boolean) — exercises basic column
/// generation + designType-to-cell-type inference. Backs:
///   - "creates columns for a simple object type"
///   - "infers display type from designType"
///   - "non-FK columns have undefined valueHelpInfo"
export interface SimpleObject {
    name: string
    age: number
    active: boolean
}

/// Single string prop carrying `@meta.label`. Backs:
///   - "uses @meta.label for column label"
export interface WithLabel {
    @meta.label 'First Name'
    firstName: string
}

/// Single string prop without `@meta.label` — humanized path is used. Backs:
///   - "humanizes path when no @meta.label"
///   - "fields not in meta.fields default to not sortable/filterable"
export interface WithoutLabel {
    firstName: string
}

/// `@ui.type` cascades to the table cell when no `@ui.table.type` override. Backs:
///   - "uses bare @ui.type as the cell renderer when no @ui.table.type override exists"
export interface WithUiType {
    @ui.type 'textarea'
    bio: string
}

/// `@ui.table.type` overrides bare `@ui.type` for the table cell. Backs:
///   - "@ui.table.type wins over @ui.type for the cell renderer"
export interface WithUiTableType {
    @ui.type 'textarea'
    @ui.table.type 'rich-text'
    bio: string
}

/// Three props with explicit `@ui.table.order` values. Backs:
///   - "sorts columns by @ui.table.order"
export interface WithTableOrder {
    @ui.table.order 2
    email: string

    @ui.table.order 1
    name: string

    @ui.table.order 3
    bio: string
}

/// Two props with `@ui.form.order` only — should NOT influence table order. Backs:
///   - "@ui.form.order does NOT influence column order"
export interface WithFormOrder {
    @ui.form.order 1
    email: string

    @ui.form.order 2
    name: string
}

/// `@ui.table.hidden` flag toggles column visibility. Backs:
///   - "@ui.table.hidden sets visible: false"
export interface WithTableHidden {
    @ui.table.hidden
    secret: string

    visible: string
}

/// `@ui.form.hidden` MUST NOT hide the table column. Backs:
///   - "@ui.form.hidden does NOT hide the table column"
export interface WithFormHidden {
    @ui.form.hidden
    internal: string
}

/// `@ui.table.width` sets `column.width`. Backs:
///   - "reads @ui.table.width"
export interface WithTableWidth {
    @ui.table.width '240px'
    name: string
}

/// Repeated `@ui.table.selectWith` appends sibling leaf paths onto
/// `column.selectWith`; a column without the annotation stays `undefined`. Backs:
///   - "collects @ui.table.selectWith into column.selectWith"
///   - "column.selectWith is undefined when no @ui.table.selectWith"
export interface WithSelectWith {
    @ui.table.selectWith 'firstName'
    @ui.table.selectWith 'lastName'
    fullName: string

    plain: string
}

/// Two-prop fixture used for sortable/filterable meta.fields wiring. Backs:
///   - "reads sortable/filterable from meta.fields"
export interface NameAndAge {
    name: string
    age: number
}

/// Required + optional pair — exercises `nullable` flag mirroring `prop.optional`. Backs:
///   - "nullable flag mirrors prop.optional"
export interface RequiredAndOptional {
    required: string
    optional?: string
}

/// Single id prop. Backs:
///   - "passes through primaryKeys, crud, searchable flags"
///   - "preferredId falls back to primaryKeys when meta omits it (legacy server)"
///   - "passes through relations and searchIndexes"
export interface WithId {
    id: string
}

/// id + slug pair — primaryKeys vs preferredId divergence. Backs:
///   - "preferredId comes from meta when distinct from primaryKeys"
export interface WithIdAndSlug {
    id: string
    slug: string
}

/// id + name + version. Backs:
///   - "skips the versionColumn from columns and propagates it to TableDef"
export interface WithVersionColumn {
    id: string
    name: string
    version: number
}

/// Single `number.timestamp` prop — cell-type should infer to `datetime`. Backs:
///   - "timestamp-tagged number → cell-type 'datetime'"
export interface WithTimestamp {
    createdAt: number.timestamp
}

/// Single plain `number` prop (no timestamp tag) — stays `number`. Backs:
///   - "plain number (no timestamp tag) stays cell-type 'number'"
export interface WithCount {
    count: number
}

/// Single `decimal` prop — designType `decimal` maps to cell-type `number`. Backs:
///   - "decimal designType maps to cell-type 'number'"
export interface WithDecimal {
    price: decimal
}

/// `decimal` with `@db.amount.currency` literal — emits `currencyCode`. Backs:
///   - "reads @db.amount.currency literal onto column.currencyCode"
export interface WithCurrencyLiteral {
    @db.amount.currency 'USD'
    price: decimal
}

/// `decimal` with `@db.amount.currency.ref` — emits `currencyRefField`. Backs:
///   - "reads @db.amount.currency.ref onto column.currencyRefField"
export interface WithCurrencyRef {
    @db.amount.currency.ref 'currency'
    total: decimal

    currency: string
}

/// `decimal` with `@db.unit` literal — emits `unitCode`. Backs:
///   - "reads @db.unit literal onto column.unitCode"
export interface WithUnitLiteral {
    @db.unit 'kg'
    weight: decimal
}

/// `decimal` with `@db.unit.ref` — emits `unitRefField`. Backs:
///   - "reads @db.unit.ref onto column.unitRefField"
export interface WithUnitRef {
    @db.unit.ref 'unit'
    value: decimal

    unit: string
}

/// `decimal` with `@db.column.precision` — emits `precisionScale`. Backs:
///   - "reads @db.column.precision scale onto column.precisionScale"
export interface WithPrecision {
    @db.column.precision 10, 2
    price: decimal
}

/// Nested object NOT marked `@db.json` — server-flattened, so the parent
/// must be skipped and only leaves become columns. Backs:
///   - "skips flat-flattened object parents — only leaves become columns"
export interface WithFlatNested {
    name: string
    profile: {
        firstName: string
        lastName: string
    }
}

/// Nested object marked `@db.json` — single atomic column. Backs:
///   - "keeps @db.json (atomic) object parent as a single column"
export interface WithJsonNested {
    name: string

    @db.json
    address: {
        street: string
        city: string
    }
}

/// Non-literal union of two object variants — should infer cell-type `union`. Backs:
///   - "non-literal union (object variants) infers cell-type 'union'"
type CardVariant = {
    card: string
}

type BankVariant = {
    iban: string
}

export interface WithUnion {
    paymentMethod: CardVariant | BankVariant
}

/// Three-prop fixture for the column-resolver helper block. Provides
/// ordered ids, a hidden column, and mixed sortable/filterable flags. Backs:
///   - "getVisibleColumns filters hidden columns"
///   - "getSortableColumns returns only sortable"
///   - "getFilterableColumns returns only filterable"
///   - "getColumn finds by path"
export interface ResolverHelpers {
    @ui.table.order 1
    id: string

    @ui.table.order 2
    name: string

    @ui.table.hidden
    @ui.table.order 3
    secret: string
}
