import { Controller } from "moost";
import { HttpError } from "@moostjs/event-http";
import { Workflow, Step, WorkflowSchema, WorkflowParam } from "@moostjs/event-wf";
import { finishWf, useAtscriptWf } from "@atscript/moost-wf";
import { usersTable } from "../../db";
import { useSession } from "../../auth/use-session";
import { ProfileForm } from "../forms/profile-form.as";

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
  async save(@WorkflowParam("context") ctx: ProfileCtx) {
    const session = useSession();
    if (!session) throw new HttpError(401, "Not authenticated");

    // First entry has no input — seed ctx so @wf.context.pass exposes current
    // values to the form, then re-throw the same StepRetriableError. @WfInput
    // doesn't fit cleanly here because it throws before the body runs.
    const wf = useAtscriptWf(ProfileForm);
    let input: ProfileForm;
    try {
      input = wf.resolveInput();
    } catch (err) {
      const user = await usersTable.findOne({ filter: { id: session.userId } });
      ctx.currentUsername = user?.username;
      ctx.currentEmail = user?.email;
      throw err;
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
