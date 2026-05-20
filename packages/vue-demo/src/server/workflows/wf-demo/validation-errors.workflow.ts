// Server-side validation: reject example/test domains by re-emitting the same
// form with `inputRequired.context.errors`. The client preserves user-entered
// values across re-validation rounds (same serialized payload → no FormDef
// rebuild). User corrects, resubmits, succeeds.
import { Controller } from "moost";
import { Workflow, Step, WorkflowSchema, WorkflowParam } from "@moostjs/event-wf";
import { finishWf } from "@atscript/moost-wf";
import { EmailDemoForm } from "../forms/email-form.as";
import { httpInputRequired } from "../wf-helpers";

const BLOCKED_DOMAINS = ["@example.com", "@test.com"];

interface Ctx {
  email?: string;
}

@Controller()
export class WfValidationErrorsDemoWorkflow {
  @Workflow("wf-demo/validation-errors")
  @WorkflowSchema<Ctx>([{ id: "wfd-validation" }])
  flow() {}

  @Step("wfd-validation")
  run(
    @WorkflowParam("input") input: { email?: string } | undefined,
    @WorkflowParam("context") ctx: Ctx,
  ) {
    if (!input || !input.email) {
      return httpInputRequired(EmailDemoForm, ctx);
    }
    const lower = input.email.toLowerCase();
    if (BLOCKED_DOMAINS.some((d) => lower.endsWith(d))) {
      return httpInputRequired(EmailDemoForm, ctx, {
        email: "Example domain not allowed. Use a real address.",
      });
    }
    ctx.email = input.email;
    finishWf({
      data: { accepted: true, email: input.email },
      message: { level: "success", text: "Email accepted." },
    });
    return;
  }
}
