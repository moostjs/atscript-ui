import { useResponse } from "@wooksjs/event-http";
import { defineAfterInterceptor } from "moost";

import { isWfFinished } from "./wf-finished";

/**
 * Opt-in moost after-interceptor that translates `mode: 'immediate'` redirect
 * envelopes back to a real 3xx HTTP redirect for server-rendered (SSR / no-JS)
 * consumers. Install on the controller / handler serving the workflow route.
 *
 * `auto` and `manual` end modes REQUIRE client-side rendering (countdown
 * timers, button choices) — they pass through as 200 JSON regardless of
 * whether this interceptor is installed.
 *
 * @example
 * ```ts
 * import { Intercept } from "moost";
 * import { workflowSsrAdapter } from "@atscript/moost-wf/ssr-adapter";
 *
 * @Controller("/auth")
 * @Intercept(workflowSsrAdapter)
 * export class AuthController { ... }
 * ```
 */
export const workflowSsrAdapter = defineAfterInterceptor((response, reply) => {
  if (!isWfFinished(response)) return;
  const end = response.end;
  if (!end || end.mode !== "immediate") return;
  if (end.action.type !== "redirect") return;
  // 303 forces GET on the redirect target (post-action hard navigation);
  // 302 preserves method (soft SPA-style nav fallback).
  const status = end.action.mode === "hard" ? 303 : 302;
  useResponse().setStatus(status).setHeader("location", end.action.target);
  reply("");
});
