import { UsersTable } from './users'

@db.table 'tasks'
export interface TasksTable {
    @meta.id
    @db.default.increment
    id: number

    @meta.label 'Title'
    @db.index.fulltext 'tasks_search'
    title: string

    @meta.label 'Status'
    @ui.literalLabel 'open', 'Open'
    @ui.literalLabel 'in-progress', 'In progress'
    @ui.literalLabel 'done', 'Done'
    @ui.literalLabel 'archived', 'Archived'
    @db.index.plain 'tasks_status_idx'
    @db.default 'open'
    @ui.table.component 'status-badge'
    status: 'open' | 'in-progress' | 'done' | 'archived'

    @meta.label 'Priority'
    @db.default 'normal'
    priority: 'low' | 'normal' | 'high'

    @meta.label 'Assignee'
    @db.rel.FK
    assigneeId?: UsersTable.id

    @meta.label 'Estimate (h)'
    estimate: number

    @meta.label 'Spent (h)'
    spent: number

    @meta.label 'Due on'
    dueOn?: string.date

    @meta.label 'Reviewed at'
    reviewedAt?: string.isoDate

    @meta.label 'Created'
    @db.default.now
    createdAt: number.timestamp

    /// An array of a labelled literal union: the table shows each element's label
    @meta.label 'Labels'
    @ui.literalLabel 'bug', 'Defect'
    @ui.literalLabel 'feature', 'Feature request'
    labels?: ('bug' | 'feature' | 'chore')[]
}
