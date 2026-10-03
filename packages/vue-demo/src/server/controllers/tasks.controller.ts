import {
  TableController,
  DbAction,
  DbActionID,
  DbActionIDs,
  DbActionTarget,
  InputForm,
  perRow,
  useDbActionTarget,
  type TDbActionTarget,
} from "@atscript/moost-db";
import { Post, Authenticate } from "@moostjs/event-http";
import { ArbacAuthorize, ArbacResource, ArbacAction } from "@aooth/arbac-moost";
import { tasksTable } from "../db";
import type { TasksTable } from "../schemas/tasks.as";
import { SetPriorityInput } from "../schemas/action-forms.as";
import { SessionGuard } from "../auth/session.guard";
import { DemoArbacDbController } from "../auth/arbac-db.controller";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Query-target showcase. Every `'rows'` action except `notify` opts into
 * `queryTarget`, so the UI can run it on "every row matching the current
 * filter/search" (the "Select all N matching" banner) instead of a list of
 * ids. `archive` streams the target in batches (`@DbActionTarget`); the
 * others keep the materialized `@DbActionIDs` surface — the server resolves
 * the ids, the handler is unchanged.
 *
 * The `task-board` view (`task-board.controller.ts`) delegates these
 * actions via `@DbActionsFrom`; they stay authorized here, by this
 * controller's ARBAC (`tasks` resource, every action as `update`) — on the
 * board too, where they run as this controller.
 */
@Authenticate(SessionGuard)
@ArbacAuthorize()
@ArbacResource("tasks")
@TableController(tasksTable, "db/tables/tasks")
export class TasksController extends DemoArbacDbController<typeof TasksTable> {
  /** Single-row `open` → `in-progress` (the rows-level actions below join its menu). */
  @Post("actions/start")
  @DbAction<typeof TasksTable, ["status"]>("start", {
    label: "Start",
    icon: "i-as-arrow-up",
    intent: "positive",
    requiredFields: ["status"],
    disabled: perRow((t) => t.status !== "open" && "Only open tasks can be started"),
  })
  @ArbacAction("update")
  async start(@DbActionID() id: { id: number }) {
    await tasksTable.updateOne({ id: id.id, status: "in-progress" });
    return { ok: true, message: `Task ${id.id} started` };
  }

  /** Streamed: each batch of 20 is gated (already-archived rows skipped) when reached. */
  @Post("actions/archive")
  @DbAction<typeof TasksTable, ["status"]>("archive", {
    label: "Archive",
    icon: "i-as-close",
    intent: "negative",
    description: "Already archived tasks are skipped.",
    requiredFields: ["status"],
    disabled: perRow((t) => t.status === "archived" && "Already archived"),
    queryTarget: { maxRows: 500, batchSize: 20 },
  })
  @ArbacAction("update")
  async archive(@DbActionTarget() target: TDbActionTarget) {
    let archived = 0;
    for await (const { ids } of target.batches()) {
      const batch = ids.map((i) => i.id as number);
      await tasksTable.updateMany({ id: { $in: batch } }, { status: "archived" });
      archived += batch.length;
    }
    return { ...target.summary(), message: `Archived ${plural(archived, "task")}` };
  }

  /** Materialized: the server resolves the target, the handler gets plain ids. */
  @Post("actions/set-priority")
  @DbAction("set-priority", {
    label: "Set priority",
    icon: "i-as-arrow-up",
    intent: "primary",
    // Materialized handlers are also capped by `maxIds` (default 1000) —
    // declare it so `/meta` advertises the real cap.
    queryTarget: { maxRows: 1000 },
  })
  @ArbacAction("update")
  async setPriority(
    @DbActionIDs() ids: { id: number }[],
    @InputForm(SetPriorityInput) input: SetPriorityInput,
  ) {
    const targetIds = ids.map((t) => t.id);
    if (targetIds.length === 0) return { ok: false, message: "No tasks selected." };
    await tasksTable.updateMany({ id: { $in: targetIds } }, { priority: input.priority });
    return {
      ...useDbActionTarget().summary(),
      ok: true,
      message: `Set ${plural(targetIds.length, "task")} to ${input.priority}`,
    };
  }

  /** Small cap: selecting more than 25 matching rows answers 400 `TARGET_TOO_LARGE`. */
  @Post("actions/reopen")
  @DbAction<typeof TasksTable, ["status"]>("reopen", {
    label: "Reopen",
    icon: "i-as-refresh",
    intent: "primary",
    description: "Only done tasks can be reopened; others are skipped.",
    requiredFields: ["status"],
    disabled: perRow((t) => t.status !== "done" && "Only done tasks can be reopened"),
    onDisabledRows: "skip",
    queryTarget: { maxRows: 25 },
  })
  @ArbacAction("update")
  async reopen(@DbActionIDs() ids: { id: number }[]) {
    const targetIds = ids.map((t) => t.id);
    if (targetIds.length === 0) return { ok: false, message: "No done tasks selected." };
    await tasksTable.updateMany({ id: { $in: targetIds } }, { status: "open" });
    // The summary lists the non-done rows `onDisabledRows: "skip"` dropped.
    return {
      ...useDbActionTarget().summary(),
      ok: true,
      message: `Reopened ${plural(targetIds.length, "task")}`,
    };
  }

  /** No `queryTarget` — explicit selections only (disabled in "all matching" mode). */
  @Post("actions/notify")
  @DbAction("notify", {
    label: "Notify assignees",
    icon: "i-as-check",
    intent: "secondary",
  })
  @ArbacAction("update")
  async notify(@DbActionIDs() ids: { id: number }[]) {
    return { ok: true, message: `Notified ${ids.length}` };
  }
}
