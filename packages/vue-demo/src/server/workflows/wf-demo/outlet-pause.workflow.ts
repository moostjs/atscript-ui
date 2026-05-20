// Outlet-pause: workflow emits `outletEmail` which serializes as `{ sent: true }`
// to the client. From this session's POV the workflow is "finished" — real
// resumption happens out-of-band when the recipient clicks the magic link
// (here just logged to the server console by `consoleEmailSender`).
import { Controller } from "moost";
import {
  Workflow,
  Step,
  WorkflowSchema,
  WorkflowParam,
  outletEmail,
  type WfOutletRequest,
} from "@moostjs/event-wf";
import { WfInput } from "@atscript/moost-wf";
import { FinishDemoForm } from "../forms/finish-demo-form.as";

interface Ctx {
  note?: string;
  emailed?: boolean;
}

@Controller()
export class WfOutletPauseDemoWorkflow {
  @Workflow("wf-demo/outlet-pause")
  @WorkflowSchema<Ctx>([{ id: "wfd-outlet-collect" }, { id: "wfd-outlet-send" }])
  flow() {}

  @Step("wfd-outlet-collect")
  collect(@WfInput() input: FinishDemoForm, @WorkflowParam("context") ctx: Ctx) {
    ctx.note = input.note;
    return;
  }

  @Step("wfd-outlet-send")
  sendEmail(@WorkflowParam("context") ctx: Ctx) {
    // Idempotency on resume — without this, the magic-link replay would re-emit
    // the outlet and pause again instead of advancing past the step.
    if (ctx.emailed) return;
    ctx.emailed = true;
    return outletEmail("demo@example.com", "wf-demo-pause", { note: ctx.note }) as {
      inputRequired: WfOutletRequest;
    };
  }
}
