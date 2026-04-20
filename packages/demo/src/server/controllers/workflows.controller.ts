import { createHash } from "node:crypto";
import { Controller } from "moost";
import { Post } from "@moostjs/event-http";
import {
  MoostWf,
  createHttpOutlet,
  createEmailOutlet,
  EncapsulatedStateStrategy,
  handleWfOutletRequest,
  type WfOutletTriggerDeps,
} from "@moostjs/event-wf";
// Keep the email outlet registered for future magic-link flows (user invite, password-reset);
// current P6 workflows dispatch OTP inline so they can pause on a form in the same response.
import { consoleEmailSender } from "../workflows/email-sender";

// EncapsulatedStateStrategy requires a 32-byte key. Derive it deterministically
// from SESSION_SECRET via SHA-256 so operators can still set a human-friendly secret.
const WF_SECRET = createHash("sha256")
  .update(process.env.SESSION_SECRET ?? "dev-secret-change-me")
  .digest();

// NOTE: Moost applies its HTTP `globalPrefix` to WF adapter paths too, so registered
// schema IDs are `api/auth/login` etc. The client/allowlist must match.
const ALLOWED_WORKFLOWS = [
  "api/auth/login",
  "api/auth/register",
  "api/security/change-password",
  "api/profile/edit",
] as const;

@Controller()
export class WorkflowsController {
  constructor(private readonly wf: MoostWf) {}

  @Post("wf")
  handle() {
    // Use handleWfOutletRequest directly so we can forward the HTTP eventContext
    // into the workflow — otherwise `useWfFinished().set({ cookies })` in a step
    // writes to the WF's isolated context and the HTTP trigger can't read it back.
    // (MoostWf.handleOutlet drops the eventContext param — workaround until fixed upstream.)
    const wfApp = this.wf.getWfApp();
    const deps: WfOutletTriggerDeps = {
      start: (schemaId, context, opts) =>
        wfApp.start(schemaId, context as never, {
          input: opts?.input,
          eventContext: opts?.eventContext as never,
        }),
      resume: (state, opts) =>
        wfApp.resume(
          state as { schemaId: string; indexes: number[]; context: never },
          {
            input: opts?.input,
            eventContext: opts?.eventContext as never,
          },
        ),
    };
    return handleWfOutletRequest(
      {
        allow: [...ALLOWED_WORKFLOWS],
        state: new EncapsulatedStateStrategy({ secret: WF_SECRET }),
        outlets: [createHttpOutlet(), createEmailOutlet(consoleEmailSender)],
        token: { read: ["body", "query", "cookie"], write: "body", name: "wfs" },
      },
      deps,
    );
  }
}
