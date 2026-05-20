// `next.trigger: 'auto'` redirect with countdown + skip via `finishWf`.
//
// One round-trip. The default AsWfFinish renders the countdown text and a
// "Go now" skip button (skip behaviour defaults to `now` → fires the action
// immediately).
import { Controller } from "moost";
import { Workflow, Step, WorkflowSchema, WorkflowParam } from "@moostjs/event-wf";
import { finishWf } from "@atscript/moost-wf";
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
