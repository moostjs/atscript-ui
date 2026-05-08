/**
 * Stand-in for `unknown` (atscript has no such primitive). Used inside
 * the `@db.json` blob below, so this widens the typing surface only —
 * the column stores opaque JSON and runtime never validates per-key.
 */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [/^.+$/]: JsonValue }

export interface AsWfStateRecord {
    @db.index.unique 'handle_idx'
    @expect.maxLength 256
    handle: string

    @db.index.plain 'schema_idx'
    @expect.maxLength 256
    schemaId: string

    @db.json
    state: {
        context: JsonValue
        indexes: number[]
        meta?: { [/^.+$/]: JsonValue }
    }

    @db.index.plain 'expires_idx'
    expiresAt?: number.timestamp

    @db.default.now
    @db.index.plain 'updated_idx'
    updatedAt: number.timestamp

    createdAt: number.timestamp

    @expect.maxLength 128
    createdBy?: string

    @expect.maxLength 128
    lastUpdatedBy?: string
}
