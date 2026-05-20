import { Controller } from "moost";
import { HttpError } from "@moostjs/event-http";
import { Workflow, Step, WorkflowSchema, WorkflowParam } from "@moostjs/event-wf";
import { finishWf } from "@atscript/moost-wf";
import { usersTable } from "../../db";
import { useSession } from "../../auth/use-session";
import { ProfileForm } from "../forms/profile-form.as";
import { httpInputRequired } from "../wf-helpers";

interface ProfileCtx {
  currentUsername?: string;
  currentEmail?: string;
}

@Controller()
export class EditProfileWorkflow {
  @Workflow("profile/edit")
  @WorkflowSchema<ProfileCtx>([{ id: "profile-save" }])
  flow() {}

  @Step("profile-save")
  async save(
    @WorkflowParam("input") input: { username?: string; email?: string } | undefined,
    @WorkflowParam("context") ctx: ProfileCtx,
  ) {
    const session = useSession();
    if (!session) throw new HttpError(401, "Not authenticated");

    if (!input) {
      const user = await usersTable.findOne({ filter: { id: session.userId } });
      ctx.currentUsername = user?.username;
      ctx.currentEmail = user?.email;
      return httpInputRequired(ProfileForm, ctx);
    }
    if (!input.username || !input.email) {
      return httpInputRequired(ProfileForm, ctx, { __form: "Username and email are required" });
    }
    await usersTable.updateOne({
      id: session.userId,
      username: input.username,
      email: input.email,
    });
    finishWf({ data: { ok: true, user: { username: input.username, email: input.email } } });
    return;
  }
}
