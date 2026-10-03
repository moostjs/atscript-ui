import { TasksTable } from './tasks'
import { UsersTable } from './users'

// Read-only board over `tasks` + the assignee's username. The task id is
// exposed under a RENAMED column (`taskId`), so `@DbActionsFrom` on the view
// controller derives `idMap: { id: "taskId" }` from this mapping.
// `remaining` is a computed column (`@db.compute`): the database evaluates
// it, `/meta` marks it `computed: true`, and it sorts / filters like any
// other number column.
@db.view 'task_board'
@db.view.for TasksTable
@db.view.joins UsersTable, `UsersTable.id = TasksTable.assigneeId`, 'left'
export interface TaskBoardView {
    @meta.id
    @meta.label 'Task #'
    taskId: TasksTable.id

    @meta.label 'Title'
    title: TasksTable.title

    @meta.label 'Status'
    @ui.table.component 'status-badge'
    status: TasksTable.status

    @meta.label 'Priority'
    priority: TasksTable.priority

    @meta.label 'Assignee'
    assignee?: UsersTable.username

    @meta.label 'Estimate (h)'
    estimate: TasksTable.estimate

    @meta.label 'Spent (h)'
    spent: TasksTable.spent

    @meta.label 'Remaining (h)'
    @db.compute `estimate - spent`
    remaining: number
}
