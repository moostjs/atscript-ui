import { AsWfStateRecord } from '@atscript/moost-wf/store'

@db.table 'wf_states'
export interface WfStateRow extends AsWfStateRecord {
    // UUID PK — opaque, hidden from list views.
    @meta.id
    @ui.table.hidden
    @db.default.uuid
    id: string

    // Indexable shadows from the invite workflow's context — let an admin UI
    // filter pending invites without scanning the JSON `state` blob.
    @meta.label 'Invite Email'
    @wf.store.fromContext 'email'
    @db.index.plain 'email_idx'
    @ui.form.grid.colSpan 'half'
    inviteEmail?: string

    @meta.label 'Invite Role'
    @wf.store.fromContext 'roleName'
    @db.index.plain 'role_idx'
    @ui.form.grid.colSpan 'half'
    inviteRole?: string
}
