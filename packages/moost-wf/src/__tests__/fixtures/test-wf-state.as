import { AsWfStateRecord, JsonValue } from '../../as-wf-state'

// Re-export keeps JsonValue's import live in the generated `.as.js`; see /Users/mavrik/code/atscript/TODO.md (codegen drops parent-only refs on `extends`).
export type WfJsonValue = JsonValue

@db.table 'wf_states_test'
export interface TestWfStateRecord extends AsWfStateRecord {
    @meta.id
    @db.default.uuid
    id: string
}
