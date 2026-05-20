// `next.trigger: 'manual'` with primary + two options via `finishWf`.
// The user picks an outcome (redirect home, redirect to login, or dismiss
// the screen entirely).
import { Controller } from "moost";
import { Workflow, Step, WorkflowSchema, WorkflowParam } from "@moostjs/event-wf";
import { finishWf } from "@atscript/moost-wf";
import { FinishDemoForm } from "../forms/finish-demo-form.as";
import { httpInputRequired } from "../wf-helpers";

interface Ctx {
  note?: string;
}

@Controller()
export class WfFinishManualDemoWorkflow {
  @Workflow("wf-demo/finish-manual")
  @WorkflowSchema<Ctx>([{ id: "wfd-manual" }])
  flow() {}

  @Step("wfd-manual")
  run(
    @WorkflowParam("input") input: { note?: string } | undefined,
    @WorkflowParam("context") ctx: Ctx,
  ) {
    if (!input || !input.note) {
      return httpInputRequired(FinishDemoForm, ctx);
    }
    ctx.note = input.note;
    finishWf({
      message: { level: "success", text: "What would you like to do next?" },
      next: {
        trigger: "manual",
        primary: {
          label: "Back to demo index",
          action: { type: "redirect", target: "/wf-demo", reason: "manual-primary" },
        },
        options: [
          {
            label: "Sign in",
            action: { type: "redirect", target: "/login", reason: "manual-login" },
          },
          { label: "Stay here", action: { type: "dismiss" } },
        ],
      },
    });
    return;
  }
}
