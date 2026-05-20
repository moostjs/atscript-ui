// `next.trigger: 'auto'` redirect with countdown + skip via `finishWf`.
//
// One round-trip. The default AsWfFinish renders the countdown text and a
// "Go now" skip button (skip behaviour defaults to `now` → fires the action
// immediately).
import { Controller } from "moost";
import { Workflow, Step, WorkflowSchema, WorkflowParam } from "@moostjs/event-wf";
import { WfInput, finishWf } from "@atscript/moost-wf";
import { FinishDemoForm } from "../forms/finish-demo-form.as";

interface Ctx {
  note?: string;
}

@Controller()
export class WfFinishAutoDemoWorkflow {
  @Workflow("wf-demo/finish-auto")
  @WorkflowSchema<Ctx>([{ id: "wfd-auto" }])
  flow() {}

  @Step("wfd-auto")
  run(@WfInput() input: FinishDemoForm, @WorkflowParam("context") ctx: Ctx) {
    ctx.note = input.note;
    finishWf({
      message: { level: "info", text: "All done. Redirecting in a moment…" },
      next: {
        trigger: "auto",
        timeoutMs: 4000,
        action: { type: "redirect", target: "/wf-demo", reason: "demo-auto" },
        skipButton: { label: "Go now" },
      },
    });
    return;
  }
}
