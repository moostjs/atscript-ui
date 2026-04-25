@db.table 'audit_log'
export interface AuditLogTable {
    @meta.id
    @db.default.increment
    id: number

    @meta.label 'Actor'
    actorId: number

    @meta.label 'Entity'
    @db.index.plain 'audit_entity_idx'
    entityType: string

    @meta.label 'Entity ID'
    @db.index.plain 'audit_entity_idx'
    entityId: number

    @meta.label 'Action'
    action: string

    @meta.label 'Changes'
    changes: string

    @meta.label 'At'
    @db.default.now
    @db.index.plain 'audit_created_idx', 'desc'
    createdAt: number
}
