// Backing type for the canonical form example (docs/forms/canonical-example.md).
// A small, self-contained edit form: one required scalar, one custom-rendered
// literal union, one optional field, plus the identity and version columns that
// the PATCH / optimistic-concurrency flow needs.

/// One row of a support desk. `version` is the optimistic-concurrency column:
/// it is never written as a normal field, only round-tripped through `$cas`.
@meta.label 'Service Ticket'
@ui.form.submit.text 'Save'
export interface ServiceTicket {
    @meta.id
    @ui.form.hidden
    id: number

    @meta.label 'Subject'
    @meta.required 'Subject is required'
    subject: string

    /// Rendered by the custom `priority` control registered in `types`.
    @meta.label 'Priority'
    @ui.type 'priority'
    priority: 'low' | 'normal' | 'high'

    @meta.label 'Notes'
    notes?: string

    @db.column.version
    @ui.form.hidden
    version: number
}
