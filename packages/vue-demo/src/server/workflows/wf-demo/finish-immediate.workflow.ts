// `next.trigger: 'immediate'` redirect via `finishWf`.
//
// One round-trip: the client posts the `FinishDemoForm` input, the step
// finishes with an immediate soft redirect back to the wf-demo index.
//
// Wire shape on finish (handle.ts no-ops the marker because envelope already
// has `finished: true`):
//   { finished: true, message?: {...}, next: { trigger: 'immediate', action: {...} } }
import { Controller } from "moost";
import { Workflow, Step, WorkflowSchema, WorkflowParam } from "@moostjs/event-wf";
import { WfInput, finishWf } from "@atscript/moost-wf";
import { FinishDemoForm } from "../forms/finish-demo-form.as";

interface Ctx {
  note?: string;
}

@Controller()
export class WfFinishImmediateDemoWorkflow {
  @Workflow("wf-demo/finish-immediate")
  @WorkflowSchema<Ctx>([{ id: "wfd-immediate" }])
  flow() {}

  @Step("wfd-immediate")
  run(@WfInput() input: FinishDemoForm, @WorkflowParam("context") ctx: Ctx) {
    ctx.note = input.note;
    finishWf({
      message: { level: "success", text: "Redirecting now…" },
      next: {
        trigger: "immediate",
        action: { type: "redirect", target: "/wf-demo", reason: "demo-immediate" },
      },
    });
    return;
  }
}
