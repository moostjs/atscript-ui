// Phase 4 demo — `end.mode: 'auto'` redirect with countdown + skip via
// `finishWfWithRedirect`.
//
// One round-trip. The default AsWfFinish renders the countdown text and a
// "Go now" skip button (skip behaviour defaults to `now` → fires the action
// immediately).
import { Controller } from "moost";
import { Workflow, Step, WorkflowSchema, WorkflowParam } from "@moostjs/event-wf";
import { finishWfWithRedirect } from "@atscript/moost-wf";
import { FinishDemoForm } from "../forms/finish-demo-form.as";
import { httpInputRequired } from "../wf-helpers";

interface Ctx {
  note?: string;
}

@Controller()
export class WfFinishAutoDemoWorkflow {
  @Workflow("wf-demo/finish-auto")
  @WorkflowSchema<Ctx>([{ id: "wfd-auto" }])
  flow() {}

  @Step("wfd-auto")
  run(
    @WorkflowParam("input") input: { note?: string } | undefined,
    @WorkflowParam("context") ctx: Ctx,
  ) {
    if (!input || !input.note) {
      return httpInputRequired(FinishDemoForm, ctx);
    }
    ctx.note = input.note;
    finishWfWithRedirect("/wf-demo", {
      mode: "soft",
      autoMs: 4000,
      skipLabel: "Go now",
      reason: "demo-auto",
      message: { level: "info", text: "All done. Redirecting in a moment…" },
    });
    return;
  }
}
