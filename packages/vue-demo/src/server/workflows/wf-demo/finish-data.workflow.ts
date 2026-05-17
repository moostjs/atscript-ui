// Terminal `data` payload + success message — no `end` action.
// The client renders the message via default AsWfFinish and exposes `payload.data`
// to the `wf.finished` slot so consumers can render typed result data.
import { Controller } from "moost";
import { Workflow, Step, WorkflowSchema, WorkflowParam } from "@moostjs/event-wf";
import { finishWfWithData } from "@atscript/moost-wf";
import { FinishDemoForm } from "../forms/finish-demo-form.as";
import { httpInputRequired } from "../wf-helpers";

interface Ctx {
  note?: string;
}

@Controller()
export class WfFinishDataDemoWorkflow {
  @Workflow("wf-demo/finish-data")
  @WorkflowSchema<Ctx>([{ id: "wfd-data" }])
  flow() {}

  @Step("wfd-data")
  run(
    @WorkflowParam("input") input: { note?: string } | undefined,
    @WorkflowParam("context") ctx: Ctx,
  ) {
    if (!input || !input.note) {
      return httpInputRequired(FinishDemoForm, ctx);
    }
    ctx.note = input.note;
    finishWfWithData(
      { greeting: `Hello, ${input.note}!`, timestamp: Date.now() },
      { level: "success", text: "Greeting generated." },
    );
    return;
  }
}
