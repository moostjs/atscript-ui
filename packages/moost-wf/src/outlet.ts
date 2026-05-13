import { createHttpOutlet, type WfOutlet } from "@moostjs/event-wf";

/**
 * Top-level keys `<AsWfForm>` routes on (`packages/vue-wf/src/use-wf-form.ts:128-167`):
 * `finished` → @finished, `sent`/`outlet` → outlet pause, `error` → error branch.
 * Payloads that already carry one of these must reach the response root intact —
 * wrapping in `inputRequired` would mis-route to the form branch.
 */
const SIGNAL_KEYS = ["finished", "sent", "outlet", "error"] as const;

/**
 * `createHttpOutlet` pre-configured for `<AsWfForm>` consumers.
 *
 * Wraps generic form payloads in `{ inputRequired: { payload, transport: 'http', context } }`
 * so step handlers can `return outletHttp(serializeFormSchema(Form), extractPassContext(Form, ctx))`
 * without shaping the response by hand.
 *
 * Signal pass-through: payloads already carrying a root-level routing key
 * (`finished`/`sent`/`outlet`/`error`) — e.g. `outletHttp({ outlet: 'awaiting-payment' })`
 * for a webhook pause — flow through at the response root (merged with `context`
 * if provided), so the client routes on the signal as expected.
 */
export function createAsHttpOutlet(): WfOutlet {
  return createHttpOutlet({
    transform: (payload, context) => {
      if (payload !== null && typeof payload === "object") {
        for (const key of SIGNAL_KEYS) {
          if (key in payload) {
            return context && typeof context === "object"
              ? { ...(payload as Record<string, unknown>), ...(context as Record<string, unknown>) }
              : (payload as Record<string, unknown>);
          }
        }
      }
      return {
        inputRequired: {
          payload,
          transport: "http" as const,
          context: (context ?? {}) as Record<string, unknown>,
        },
      };
    },
  });
}
