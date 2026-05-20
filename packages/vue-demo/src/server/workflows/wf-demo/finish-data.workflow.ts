// Terminal `data` payload + success message — no `next` action.
// The client renders the message via default AsWfFinish and exposes `payload.data`
// to the `wf.finished` slot so consumers can render typed result data.
import { Controller } from "moost";
import { Workflow, Step, WorkflowSchema, WorkflowParam } from "@moostjs/event-wf";
import { WfInput, finishWf } from "@atscript/moost-wf";
import { FinishDemoForm } from "../forms/finish-demo-form.as";

interface Ctx {
  note?: string;
}

@Controller()
export class WfFinishDataDemoWorkflow {
  @Workflow("wf-demo/finish-data")
  @WorkflowSchema<Ctx>([{ id: "wfd-data" }])
  flow() {}

  @Step("wfd-data")
  run(@WfInput() input: FinishDemoForm, @WorkflowParam("context") ctx: Ctx) {
    ctx.note = input.note;
    finishWf({
      data: { greeting: `Hello, ${input.note}!`, timestamp: Date.now() },
      message: { level: "success", text: "Greeting generated." },
    });
    return;
  }
}
