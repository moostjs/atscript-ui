import { AsWfStateRecord } from '@atscript/moost-wf/store'

@db.table 'wf_states'
export interface WfStateRow extends AsWfStateRecord {
    @meta.id
    @db.default.uuid
    id: string

    // Indexable shadows from the invite workflow's context — let an admin UI
    // filter pending invites by recipient email or role without scanning the
    // JSON `state` blob.
    @wf.context.copy 'email'
    @db.index.plain 'email_idx'
    inviteEmail?: string

    @wf.context.copy 'roleName'
    @db.index.plain 'role_idx'
    inviteRole?: string
}
