import { TableController, DbAction, DbActionRow, DbActionRows, perRow } from "@atscript/moost-db";
import { Post, Authenticate } from "@moostjs/event-http";
import { ArbacAuthorize, ArbacResource, ArbacAction } from "@aooth/arbac-moost";
import { categoriesTable } from "../db";
import type { CategoriesTable } from "../schemas/categories.as";
import { SessionGuard } from "../auth/session.guard";
import { DemoArbacDbController } from "../auth/arbac-db.controller";

type CategoryRow = { id: number; name: string; parentId?: number | null };

/**
 * Disabled-action-reason showcase. A `disabled` predicate that returns a
 * STRING disables the action with that reason: rows carry it in
 * `$disabledReasons`, and the table shows the action greyed with the reason
 * instead of hiding it. `true` still hides it (no reason to show).
 *
 *   show-parent   row, DEFAULT — disabled WITH a reason on top-level rows, so
 *                 double-click / Enter on those rows does nothing
 *   export-branch row — disabled WITHOUT a reason (hidden) on subcategories
 *   promote       rows — disabled WITH a reason on top-level rows; the bulk
 *                 toolbar lists the selection's distinct reasons
 */
@Authenticate(SessionGuard)
@ArbacAuthorize()
@ArbacResource("categories")
@TableController(categoriesTable, "db/tables/categories")
export class CategoriesController extends DemoArbacDbController<typeof CategoriesTable> {
  /** Read-only report — the category's parent. */
  @Post("actions/show-parent")
  @DbAction<typeof CategoriesTable, ["id", "name", "parentId"]>("show-parent", {
    label: "Show parent",
    icon: "i-as-arrow-up",
    intent: "secondary",
    default: true,
    requiredFields: ["id", "name", "parentId"],
    disabled: perRow((c) => (c.parentId == null ? "Top-level category has no parent" : false)),
  })
  @ArbacAction("update")
  async showParent(@DbActionRow() row: CategoryRow) {
    const parent = await categoriesTable.findOne({ filter: { id: row.parentId as number } });
    return { ok: true, id: row.id, message: `${row.name} → parent: ${parent?.name ?? "?"}` };
  }

  /** Read-only report over a top-level category's branch. */
  @Post("actions/export-branch")
  @DbAction<typeof CategoriesTable, ["id", "name", "parentId"]>("export-branch", {
    label: "Export branch",
    icon: "i-as-arrow-down",
    intent: "primary",
    requiredFields: ["id", "name", "parentId"],
    disabled: perRow((c) => c.parentId != null),
  })
  @ArbacAction("update")
  async exportBranch(@DbActionRow() row: CategoryRow) {
    const children = await categoriesTable.count({ filter: { parentId: row.id } });
    return { ok: true, id: row.id, message: `Exported ${row.name} (${children} subcategories)` };
  }

  /** Detach subcategories from their parent. */
  @Post("actions/promote")
  @DbAction<typeof CategoriesTable, ["id", "name", "parentId"]>("promote", {
    label: "Move to top level",
    icon: "i-as-arrow-up",
    intent: "warning",
    requiredFields: ["id", "name", "parentId"],
    disabled: perRow((c) => (c.parentId == null ? "Already a top-level category" : false)),
    onDisabledRows: "skip",
  })
  @ArbacAction("update")
  async promote(@DbActionRows() rows: CategoryRow[]) {
    const ids = rows.map((r) => r.id);
    await categoriesTable.updateMany({ id: { $in: ids } }, { parentId: null });
    return { ok: true, ids, message: `Moved ${ids.length} to top level` };
  }
}
