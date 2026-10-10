// ── Update stamps (@db.onUpdate.now) ─────────────────────────

/// A labelled variant holding a stamp — below a union of several types.
@meta.label 'Stamped'
export interface StampedVariant {
    updatedAt: number.timestamp.updated
}

export interface StampSource {
    touchedAt: number.timestamp.updated | null
}

@meta.label 'Note'
export interface NoteVariant {
    note: string
}

/// A row with update stamps in every place a form can hold one:
/// - `updatedAt` / `editedAt` — top level, with and without `@db.default.now`
/// - `trace.updatedAt` — an unlabelled object, inlined into the form
/// - `audit.updatedAt` — a labelled (structured) object
/// - `lines[].updatedAt` — an array item
/// - `touchedAt` — `number.timestamp.updated | null`
/// - `pair.0` / `either` — below a tuple / a union of several objects, where
///   the server does not set it
/// - `stamps` / `refTouched` — an array element / a field reference, which
///   the server does not set either
/// - `stampedAudit` — `StampedVariant`, also below `either`
@db.table 'stamped_rows'
export interface StampedRow {
    @meta.required
    name: string

    updatedAt: number.timestamp.updated

    @db.onUpdate.now
    editedAt: number.timestamp

    trace: {
        updatedAt: number.timestamp.updated
    }

    @meta.label 'Audit'
    audit: {
        updatedAt: number.timestamp.updated
    }

    lines: {
        qty: string
        updatedAt: number.timestamp.updated
    }[]

    touchedAt: number.timestamp.updated | null

    pair: [number.timestamp.updated, string]

    either: StampedVariant | NoteVariant

    stamps?: number.timestamp.updated[]

    refTouched?: StampSource.touchedAt

    stampedAudit?: StampedVariant
}
