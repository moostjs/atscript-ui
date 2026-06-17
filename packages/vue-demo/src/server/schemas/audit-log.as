@meta.label 'Login payload'
type AuditLoginPayload = {
    @meta.label 'type'
    @ui.form.hidden
    type: 'login'

    @meta.label 'IP address'
    @meta.required 'IP address required'
    ip: string
}

@meta.label 'Logout payload'
type AuditLogoutPayload = {
    @meta.label 'type'
    @ui.form.hidden
    type: 'logout'

    @meta.label 'Session id'
    @meta.required 'Session id required'
    sessionId: string
}

@meta.label 'Note payload'
type AuditNotePayload = {
    @meta.label 'type'
    @ui.form.hidden
    type: 'note'

    @meta.label 'Text'
    @meta.required 'Note text required'
    text: string
}

@db.table 'audit_log'
export interface AuditLogTable {
    @meta.id
    @db.default.increment
    id: number

    @meta.label 'Actor'
    actorId: number

    @meta.label 'Entity'
    @db.index.plain 'audit_entity_idx'
    @ui.form.grid.colSpan 'half'
    entityType: string

    @meta.label 'Entity ID'
    @db.index.plain 'audit_entity_idx'
    @ui.form.grid.colSpan 'half'
    entityId: number

    @meta.label 'Action'
    action: string

    @meta.label 'Changes'
    changes: string

    @meta.label 'Payload'
    @meta.description 'Optional discriminated union — `type` selects the variant.'
    @db.json
    @ui.table.exclude
    payload?: AuditLoginPayload | AuditLogoutPayload | AuditNotePayload

    @meta.label 'At'
    @db.default.now
    @db.index.plain 'audit_created_idx', 'desc'
    createdAt: number.timestamp
}
