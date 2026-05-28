import { createHash } from "node:crypto";
import { Controller } from "moost";
import { Post } from "@moostjs/event-http";
import {
  MoostWf,
  createEmailOutlet,
  EncapsulatedStateStrategy,
  HandleStateStrategy,
  type WfOutletTriggerDeps,
} from "@moostjs/event-wf";
import { createAsHttpOutlet, handleAsOutletRequest } from "@atscript/moost-wf";
import { AsWfStore } from "@atscript/moost-wf/store";
// Keep the email outlet registered for future magic-link flows (user invite, password-reset);
// current P6 workflows dispatch OTP inline so they can pause on a form in the same response.
import { consoleEmailSender } from "../workflows/email-sender";
import { wfStateTable } from "../db";
import { useSession } from "../auth/use-session";

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
  "api/users/invite",
  "api/wf-demo/finish-immediate",
  "api/wf-demo/finish-auto",
  "api/wf-demo/finish-manual",
  "api/wf-demo/finish-data",
  "api/wf-demo/finish-message",
  "api/wf-demo/finish-aborted",
  "api/wf-demo/multi-step",
  "api/wf-demo/validation-errors",
  "api/wf-demo/outlet-pause",
  "api/wf-demo/qr-and-copy",
] as const;

// Workflows whose state must survive process restart (durable handle persistence).
// All other workflows fall through to `EncapsulatedStateStrategy` (stateless tokens).
const HANDLE_STATE_WFIDS = new Set<string>(["api/users/invite"]);

// Module-level singletons — one store + one strategy instance per process.
// Exported so the test-only controller (mounted under `DEMO_TEST_MODE=1`) can
// drive seed/cleanup/introspection through the SAME store instance the
// production strategy uses. Never imported by non-test code.
export const wfStore = new AsWfStore({
  // biome-ignore lint/suspicious/noExplicitAny: store only touches base columns; subtype generic
  table: wfStateTable as any,
  actor: () => useSession()?.username,
});

// Periodic cleanup: drop expired wf_states rows that survived past their
// retention window. `.unref()` keeps the timer from blocking node shutdown —
// fine for a demo; production would mount this on an explicit startup hook.
const RETENTION_MS = Number(process.env.DEMO_WF_RETENTION_MS ?? 86_400_000);
setInterval(() => {
  wfStore.cleanup({ retention: RETENTION_MS }).catch((err) => {
    // biome-ignore lint/suspicious/noConsole: server-side diagnostic
    console.error("[wf-store] cleanup failed:", err);
  });
}, 5 * 60_000).unref();

const encapsulatedStrategy = new EncapsulatedStateStrategy({ secret: WF_SECRET });
const handleStrategy = new HandleStateStrategy({ store: wfStore });

// Named strategy registry (since `@wooksjs/event-wf` 0.7.16). Tokens are
// prefixed `<name>.<raw>` so resume auto-dispatches via the registry — no
// more sniffing UUID vs base64 on the resume path. The `default` selector
// only runs on a fresh start (when `wfid` is known).
const strategies = { encapsulated: encapsulatedStrategy, handle: handleStrategy } as const;
const pickDefault = (wfid: string): keyof typeof strategies =>
  HANDLE_STATE_WFIDS.has(wfid) ? "handle" : "encapsulated";

@Controller()
export class WorkflowsController {
  constructor(private readonly wf: MoostWf) {}

  @Post("wf")
  async handle() {
    // Use handleAsOutletRequest directly so we can forward the HTTP eventContext
    // into the workflow — otherwise `useWfFinished().set({ cookies })` in a step
    // writes to the WF's isolated context and the HTTP trigger can't read it back.
    // (MoostWf.handleOutlet drops the eventContext param — workaround until fixed upstream.)
    const wfApp = this.wf.getWfApp();
    const deps: WfOutletTriggerDeps = {
      start: (schemaId, context, opts) =>
        wfApp.start(schemaId, context as never, {
          input: opts?.input,
          eventContext: opts?.eventContext as never,
          strategy: opts?.strategy,
        }),
      resume: (state, opts) =>
        wfApp.resume(state as { schemaId: string; indexes: number[]; context: never }, {
          input: opts?.input,
          eventContext: opts?.eventContext as never,
          strategy: opts?.strategy,
        }),
    };
    return await handleAsOutletRequest(
      {
        allow: [...ALLOWED_WORKFLOWS],
        // Named registry — the trigger unwraps `<name>.<raw>` from the token
        // on resume and routes to `strategies[name]` automatically. The
        // `default` selector only runs on a fresh start when `wfid` is set.
        state: { strategies, default: pickDefault },
        outlets: [createAsHttpOutlet(), createEmailOutlet(consoleEmailSender)],
        token: { read: ["body", "query", "cookie"], write: "body", name: "wfs" },
      },
      deps,
    );
  }
}
