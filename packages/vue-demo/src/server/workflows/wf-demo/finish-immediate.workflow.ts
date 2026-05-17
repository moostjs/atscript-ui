// Phase 4 demo — `end.mode: 'immediate'` redirect via `finishWfWithRedirect`.
//
// One round-trip: the client posts the `FinishDemoForm` input, the step
// finishes with an immediate soft redirect back to the wf-demo index.
//
// Wire shape on finish (handle.ts no-ops the marker because envelope already
// has `finished: true`):
//   { finished: true, message?: {...}, end: { mode: 'immediate', action: {...} } }
import { Controller } from "moost";
import { Workflow, Step, WorkflowSchema, WorkflowParam } from "@moostjs/event-wf";
import { finishWfWithRedirect } from "@atscript/moost-wf";
import { FinishDemoForm } from "../forms/finish-demo-form.as";
import { httpInputRequired } from "../wf-helpers";

interface Ctx {
  note?: string;
}

@Controller()
export class WfFinishImmediateDemoWorkflow {
  @Workflow("wf-demo/finish-immediate")
  @WorkflowSchema<Ctx>([{ id: "wfd-immediate" }])
  flow() {}

  @Step("wfd-immediate")
  run(
    @WorkflowParam("input") input: { note?: string } | undefined,
    @WorkflowParam("context") ctx: Ctx,
  ) {
    if (!input || !input.note) {
      return httpInputRequired(FinishDemoForm, ctx);
    }
    ctx.note = input.note;
    finishWfWithRedirect("/wf-demo", {
      reason: "demo-immediate",
      message: { level: "success", text: "Redirecting now…" },
    });
    return;
  }
}
