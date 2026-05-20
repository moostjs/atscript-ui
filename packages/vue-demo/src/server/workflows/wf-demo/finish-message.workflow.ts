// Message-only finish — no data, no `next` action. One trivial input round-trip
// keeps the demo's wire shape consistent with the others (the form's purpose
// is just to give the user something to click to advance).
import { Controller } from "moost";
import { Workflow, Step, WorkflowSchema, WorkflowParam } from "@moostjs/event-wf";
import { WfInput, finishWf } from "@atscript/moost-wf";
import { FinishDemoForm } from "../forms/finish-demo-form.as";

interface Ctx {
  note?: string;
}

@Controller()
export class WfFinishMessageDemoWorkflow {
  @Workflow("wf-demo/finish-message")
  @WorkflowSchema<Ctx>([{ id: "wfd-message" }])
  flow() {}

  @Step("wfd-message")
  run(@WfInput() input: FinishDemoForm, @WorkflowParam("context") ctx: Ctx) {
    ctx.note = input.note;
    finishWf({
      message: {
        level: "info",
        text: "Nothing to do here — the workflow just emitted a message.",
      },
    });
    return;
  }
}
