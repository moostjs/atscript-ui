import { Controller } from "moost";
import { HttpError } from "@moostjs/event-http";
import { Workflow, Step, WorkflowSchema, WorkflowParam } from "@moostjs/event-wf";
import { WfInput, finishWf, useAtscriptWf } from "@atscript/moost-wf";
import { usersTable } from "../../db";
import { hashPassword, verifyPassword } from "../../auth/password";
import { useSession } from "../../auth/use-session";
import { ChangePasswordForm } from "../forms/profile-form.as";

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
    @WfInput() input: ChangePasswordForm,
    @WorkflowParam("context") ctx: ChangePasswordCtx,
  ) {
    const session = useSession();
    if (!session) throw new HttpError(401, "Not authenticated");

    const user = await usersTable.findOne({ filter: { id: session.userId } });
    if (!user || !(await verifyPassword(input.oldPassword, user.password ?? "", user.salt ?? ""))) {
      throw useAtscriptWf(ChangePasswordForm).requireInput({
        errors: { oldPassword: "Current password is incorrect" },
      });
    }
    ctx.userId = session.userId;
    ctx.oldVerified = true;
    return;
  }

  @Step("cp-set-new")
  async setNew(
    @WfInput() input: ChangePasswordForm,
    @WorkflowParam("context") ctx: ChangePasswordCtx,
  ) {
    const { hash, salt } = await hashPassword(input.newPassword);
    await usersTable.updateOne({ id: ctx.userId!, password: hash, salt });
    finishWf({ data: { ok: true } });
    return;
  }
}
