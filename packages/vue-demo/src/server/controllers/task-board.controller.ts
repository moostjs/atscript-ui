import { AsDbReadableController, DbActionsFrom, ViewController } from "@atscript/moost-db";
import { Authenticate } from "@moostjs/event-http";
import { taskBoardView } from "../db";
import type { TaskBoardView } from "../schemas/task-board.as";
import { SessionGuard } from "../auth/session.guard";
import { TasksController } from "./tasks.controller";

/**
 * View-delegated actions showcase. The `task_board` view lists tasks joined
 * with their assignee and exposes the task id as `taskId`; `@DbActionsFrom`
 * lists `TasksController`'s row actions on the board rows with the derived
 * `idMap: { id: "taskId" }`. The actions stay the source's — its route,
 * ARBAC grants and `disabled` decide; "all matching" runs on the view's
 * `POST delegated-actions/:name`.
 *
 * Mounted under `db/tables/` because the demo client resolves every table
 * page as `/api/db/tables/<apiPath>`. Session-authenticated only (no ARBAC
 * on the view itself): the delegated actions are authorized by
 * `TasksController`'s ARBAC, which `@DbActionsFrom` evaluates as the source
 * — a viewer sees the board, but none of the task actions.
 */
@Authenticate(SessionGuard)
@ViewController(taskBoardView, "db/tables/task-board")
@DbActionsFrom(() => TasksController)
export class TaskBoardController extends AsDbReadableController<typeof TaskBoardView> {}
