import { AsWfStateRecord, JsonValue } from '@atscript/moost-wf/store'

// Atscript codegen workaround — see /Users/mavrik/code/atscript/TODO.md.
// Re-exporting JsonValue under a fresh name keeps the import live in the
// generated `wf-state.as.js` so `extends`-inherited prop refs to JsonValue
// resolve at module load.
export type WfStateJsonValue = JsonValue

@db.table 'wf_states'
export interface WfStateRow extends AsWfStateRecord {
    @meta.id
    @db.default.uuid
    id: string
}
