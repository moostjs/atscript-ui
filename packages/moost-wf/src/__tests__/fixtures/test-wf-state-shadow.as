import { AsWfStateRecord } from '../../store/as-wf-state'

@db.table 'wf_states_shadow_test'
export interface ShadowWfStateRecord extends AsWfStateRecord {
    @meta.id
    @db.default.uuid
    id: string

    // Shadow column from `state.context.approver` — optional, indexed.
    @wf.context.copy 'approver'
    @db.index.plain 'approver_idx'
    approver?: string

    // Nested dot-path: copies `state.context.approval.priority`.
    @wf.context.copy 'approval.priority'
    priority?: number

    // Boolean shadow.
    @wf.context.copy 'urgent'
    urgent?: boolean
}
