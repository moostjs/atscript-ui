import {
  TableController,
  DbAction,
  DbActionRow,
  DbActionRows,
  DbRowActions,
  DbTableActions,
  InputForm,
  perRow,
} from "@atscript/moost-db";
import { Post, Authenticate } from "@moostjs/event-http";
import { ArbacAuthorize, ArbacResource, ArbacAction } from "@moostjs/arbac";
import { usersTable } from "../db";
import type { UsersTable } from "../schemas/users.as";
import { ResendInviteInput, SuspendUsersInput } from "../schemas/action-forms.as";
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
  "copy-invite-link": {
    processor: "custom",
    label: "Copy invite link",
    icon: "i-as-clipboard",
    intent: "secondary",
    description: "Copy /invite/<id> to clipboard via @action event",
  },
})
export class UsersController extends AsArbacDbController<typeof UsersTable> {
  /** `pending`/`suspended` → `active`. */
  @Post("actions/activate")
  @DbAction<typeof UsersTable, ["id", "username", "status"]>("activate", {
    label: "Activate",
    icon: "i-as-check",
    intent: "positive",
    requiredFields: ["id", "username", "status"],
    disabled: perRow((u) => u.status === "active"),
  })
  @ArbacAction("update")
  async activate(@DbActionRow() row: { id: number; username: string }) {
    await usersTable.updateOne({ id: row.id, status: "active" });
    return { ok: true, id: row.id, message: `User ${row.username} activated` };
  }

  @Post("actions/resend-invite")
  @DbAction<typeof UsersTable, ["id", "username", "email", "status"]>("resend-invite", {
    label: "Resend invite",
    icon: "i-as-refresh",
    intent: "primary",
    requiredFields: ["id", "username", "email", "status"],
    disabled: perRow((u) => u.status !== "invited"),
  })
  @ArbacAction("update")
  async resendInvite(
    @DbActionRow() row: { id: number; username: string; email: string; status: string },
    @InputForm(ResendInviteInput) input: ResendInviteInput,
  ) {
    const note = input?.customMessage ? ` (with custom message)` : "";
    return { ok: true, id: row.id, message: `Invite resent to ${row.email}${note}` };
  }

  /**
   * Suspend one or more users. `@DbActionRows` infers `level: 'rows'`; the
   * cell dropdown wraps a single row into `[{...}]` so this same handler
   * covers per-row and toolbar bulk paths. Already-suspended rows are
   * filtered out by the gate (they don't reach this handler).
   */
  @Post("actions/suspend")
  @DbAction<typeof UsersTable, ["id", "username", "status"]>("suspend", {
    label: "Suspend",
    icon: "i-as-close",
    intent: "negative",
    requiredFields: ["id", "username", "status"],
    disabled: perRow((u) => u.status === "suspended"),
    onDisabledRows: "skip",
    promptText: ["Suspend user $1?", "Suspend $N users? They won't be able to sign in."],
  })
  @ArbacAction("update")
  async suspend(
    @DbActionRows() rows: { id: number; username: string; status: string }[],
    @InputForm(SuspendUsersInput) input: SuspendUsersInput,
  ) {
    const targetIds = rows.map((r) => r.id);
    if (targetIds.length === 0) {
      return { ok: false, ids: [], message: "No users to suspend." };
    }
    await usersTable.updateMany({ id: { $in: targetIds } }, { status: "suspended" });
    const notify = input?.notifyUser !== false ? " They were notified by email." : "";
    const reason = input?.reason ? `: ${input.reason}` : "";
    return {
      ok: true,
      ids: targetIds,
      message: `Suspended ${targetIds.length} user${targetIds.length === 1 ? "" : "s"}${reason}.${notify}`,
    };
  }
}
