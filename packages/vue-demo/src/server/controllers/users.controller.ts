import {
  TableController,
  DbAction,
  DbActionPK,
  DbActionPKs,
  DbRowActions,
  DbTableActions,
} from "@atscript/moost-db";
import { Post, Authenticate } from "@moostjs/event-http";
import { ArbacAuthorize, ArbacResource, ArbacAction } from "@moostjs/arbac";
import { usersTable } from "../db";
import type { UsersTable } from "../schemas/users.as";
import { SessionGuard } from "../auth/session.guard";
import { AsArbacDbController } from "../auth/arbac-db.controller";

@Authenticate(SessionGuard)
@ArbacAuthorize()
@ArbacResource("users")
@TableController(usersTable, "db/tables/users")
@DbTableActions({
  "invite-user": {
    processor: "navigate",
    label: "Invite user",
    icon: "i-as-plus",
    intent: "primary",
    value: "/users/invite",
    default: true,
  },
  "export-csv": {
    processor: "custom",
    label: "Export CSV",
    icon: "i-as-arrow-down",
    intent: "secondary",
    description: "Trigger client-side export via @action event",
  },
})
@DbRowActions({
  edit: {
    processor: "navigate",
    label: "Edit",
    icon: "i-as-arrow-up",
    value: "/users/$1/edit",
    intent: "secondary",
    default: true,
  },
})
export class UsersController extends AsArbacDbController<typeof UsersTable> {
  /** `pending`/`suspended` → `active`. */
  @Post("actions/activate")
  @DbAction("activate", {
    label: "Activate",
    icon: "i-as-check",
    intent: "positive",
  })
  @ArbacAction("update")
  async activate(@DbActionPK() id: number) {
    const row = await usersTable.findById(id);
    if (!row) return { ok: false, id, message: `User ${id} not found` };
    if (row.status === "active") {
      return { ok: false, id, message: `User ${id} is already active` };
    }
    await usersTable.updateOne({ id, status: "active" });
    return { ok: true, id, message: `User ${id} activated` };
  }

  @Post("actions/resend-invite")
  @DbAction("resend-invite", {
    label: "Resend invite",
    icon: "i-as-refresh",
    intent: "primary",
  })
  @ArbacAction("update")
  async resendInvite(@DbActionPK() id: number) {
    const row = await usersTable.findById(id);
    if (!row) return { ok: false, id, message: `User ${id} not found` };
    if (row.status !== "invited") {
      return { ok: false, id, message: `User ${id} is ${row.status}, not invited` };
    }
    // Demo: just bumps the createdAt as a stand-in for a real send.
    return { ok: true, id, message: `Invite resent to ${row.email}` };
  }

  /**
   * Suspend one or more users. `@DbActionPKs` infers `level: 'rows'`; the
   * cell dropdown wraps a single pk into `[pk]` so this same handler covers
   * per-row and toolbar bulk paths. Already-suspended rows are silently
   * skipped; zero survivors → friendly toast.
   */
  @Post("actions/suspend")
  @DbAction("suspend", {
    label: "Suspend",
    icon: "i-as-close",
    intent: "negative",
    promptText: "Suspend the selected user(s)? They won't be able to sign in.",
  })
  @ArbacAction("update")
  async suspend(@DbActionPKs() ids: number[]) {
    const selected = await usersTable.findMany({ filter: { id: { $in: ids } } });
    const targets = selected.filter((u) => u.status !== "suspended");
    if (targets.length === 0) {
      return { ok: false, ids, message: "All selected users are already suspended." };
    }
    await usersTable.updateMany({ id: { $in: targets.map((u) => u.id) } }, { status: "suspended" });
    return {
      ok: true,
      ids: targets.map((u) => u.id),
      message: `Suspended ${targets.length} user(s).`,
    };
  }
}
