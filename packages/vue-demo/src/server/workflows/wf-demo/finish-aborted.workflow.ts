// Two finish paths — happy `finishWf` on submit, `abortWf` when the "Cancel"
// action button is clicked. `@WfAction()` resolves the action name from the
// request body; if `cancel`, abort. Otherwise treat the request as a regular
// submit.
import { Controller } from "moost";
import { Workflow, Step, WorkflowSchema, WorkflowParam } from "@moostjs/event-wf";
import { WfAction, WfInput, abortWf, finishWf, useAtscriptWf } from "@atscript/moost-wf";
import { AbortableDemoForm } from "../forms/abortable-demo-form.as";

interface Ctx {
  name?: string;
}

@Controller()
export class WfFinishAbortedDemoWorkflow {
  @Workflow("wf-demo/finish-aborted")
  @WorkflowSchema<Ctx>([{ id: "wfd-aborted" }])
  flow() {}

  @Step("wfd-aborted")
  run(
    @WfInput({ pass: true }) input: AbortableDemoForm | undefined,
    @WorkflowParam("context") ctx: Ctx,
    @WfAction() action: string | undefined,
  ) {
    if (action === "cancel") {
      abortWf("user-cancel", {
        message: { level: "warn", text: "Operation cancelled." },
      });
      return;
    }
    if (!input) {
      throw useAtscriptWf(AbortableDemoForm).requireInput();
    }
    ctx.name = input.name;
    finishWf({
      data: { ok: true, name: input.name },
      message: { level: "success", text: "Saved." },
    });
    return;
  }
}
