import { Controller } from "moost";
import { HttpError } from "@moostjs/event-http";
import { Workflow, Step, WorkflowSchema, WorkflowParam, useWfFinished } from "@moostjs/event-wf";
import { usersTable } from "../../db";
import { hashPassword, verifyPassword } from "../../auth/password";
import { useSession } from "../../auth/use-session";
import { ChangePasswordForm } from "../forms/profile-form.as";
import { httpInputRequired } from "../wf-helpers";

interface ChangePasswordCtx {
  userId?: number;
  oldVerified?: boolean;
}

@Controller()
export class ChangePasswordWorkflow {
  @Workflow("security/change-password")
  @WorkflowSchema<ChangePasswordCtx>([{ id: "cp-verify-old" }, { id: "cp-set-new" }])
  flow() {}

  @Step("cp-verify-old")
  async verifyOld(
    @WorkflowParam("input") input: { oldPassword?: string; newPassword?: string } | undefined,
    @WorkflowParam("context") ctx: ChangePasswordCtx,
  ) {
    const session = useSession();
    if (!session) throw new HttpError(401, "Not authenticated");

    if (!input || !input.oldPassword) {
      return httpInputRequired(ChangePasswordForm, ctx);
    }
    const user = await usersTable.findOne({ filter: { id: session.userId } });
    if (!user || !(await verifyPassword(input.oldPassword, user.password ?? "", user.salt ?? ""))) {
      return httpInputRequired(ChangePasswordForm, ctx, {
        oldPassword: "Current password is incorrect",
      });
    }
    ctx.userId = session.userId;
    ctx.oldVerified = true;
    return;
  }

  @Step("cp-set-new")
  async setNew(
    @WorkflowParam("input") input: { newPassword?: string } | undefined,
    @WorkflowParam("context") ctx: ChangePasswordCtx,
  ) {
    if (!input || !input.newPassword) {
      return httpInputRequired(ChangePasswordForm, ctx);
    }
    if (input.newPassword.length < 6) {
      return httpInputRequired(ChangePasswordForm, ctx, {
        newPassword: "At least 6 characters",
      });
    }
    const { hash, salt } = await hashPassword(input.newPassword);
    await usersTable.updateOne({ id: ctx.userId!, password: hash, salt });
    useWfFinished().set({
      type: "data",
      value: { finished: true, ok: true },
    });
    return;
  }
}
