// Two finish paths — happy `finishWf` on submit, `abortWf` when the "Cancel"
// action button is clicked. `@AltAction()` resolves the action name from the
// request body; if `cancel`, abort. Otherwise treat the request as a regular
// submit.
import { Controller } from "moost";
import { Workflow, Step, WorkflowSchema, WorkflowParam } from "@moostjs/event-wf";
import { abortWf, finishWf, AltAction } from "@atscript/moost-wf";
import { AbortableDemoForm } from "../forms/abortable-demo-form.as";
import { httpInputRequired } from "../wf-helpers";

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
    @WorkflowParam("input") input: { name?: string } | undefined,
    @WorkflowParam("context") ctx: Ctx,
    @AltAction() action: string | undefined,
  ) {
    if (action === "cancel") {
      abortWf("user-cancel", {
        message: { level: "warn", text: "Operation cancelled." },
      });
      return;
    }
    if (!input || !input.name) {
      return httpInputRequired(AbortableDemoForm, ctx);
    }
    ctx.name = input.name;
    finishWf({
      data: { ok: true, name: input.name },
      message: { level: "success", text: "Saved." },
    });
    return;
  }
}
