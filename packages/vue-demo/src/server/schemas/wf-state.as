import { AsWfStateRecord, JsonValue } from '@atscript/moost-wf/store'

// Re-export keeps JsonValue's import live in the generated `.as.js`; see /Users/mavrik/code/atscript/TODO.md (codegen drops parent-only refs on `extends`).
export type WfStateJsonValue = JsonValue

@db.table 'wf_states'
export interface WfStateRow extends AsWfStateRecord {
    @meta.id
    @db.default.uuid
    id: string
}
