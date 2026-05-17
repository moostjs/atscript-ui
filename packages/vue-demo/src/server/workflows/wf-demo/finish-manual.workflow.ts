// Phase 4 demo — `end.mode: 'manual'` with primary + two options via
// `finishWfWithChoice`. The user picks an outcome (redirect home, redirect to
// login, or dismiss the screen entirely).
import { Controller } from "moost";
import { Workflow, Step, WorkflowSchema, WorkflowParam } from "@moostjs/event-wf";
import { finishWfWithChoice } from "@atscript/moost-wf";
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
    finishWfWithChoice({
      message: { level: "success", text: "What would you like to do next?" },
      primary: {
        label: "Back to demo index",
        action: { type: "redirect", target: "/wf-demo", mode: "soft", reason: "manual-primary" },
      },
      options: [
        {
          label: "Sign in",
          action: { type: "redirect", target: "/login", mode: "soft", reason: "manual-login" },
        },
        { label: "Stay here", action: { type: "dismiss" } },
      ],
    });
    return;
  }
}
