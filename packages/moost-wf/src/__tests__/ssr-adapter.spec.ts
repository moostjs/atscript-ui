import { prepareTestHttpContext, useResponse } from "@wooksjs/event-http";
import { describe, expect, it } from "vite-plus/test";

import { workflowSsrAdapter } from "../ssr-adapter";

// The interceptor is invoked by moost's chain with (response, reply). We
// drive it directly here — the contract we care about is whether it
// rewrites the HTTP response headers/status when handed an envelope.
async function runInterceptor(response: unknown): Promise<{
  replied: { called: boolean; value: unknown };
  status: number;
  location: string | undefined;
}> {
  const run = prepareTestHttpContext({ url: "/wf", method: "POST" });
  return run(async () => {
    const replied: { called: boolean; value: unknown } = { called: false, value: undefined };
    const reply = (v: unknown) => {
      replied.called = true;
      replied.value = v;
    };
    // biome-ignore lint/suspicious/noExplicitAny: TInterceptorDef.after typed loosely upstream
    await (workflowSsrAdapter as any).after(response, reply);
    const r = useResponse();
    return {
      replied,
      status: (r as unknown as { status: number }).status,
      location: r.getHeader("location") as string | undefined,
    };
  });
}

describe("workflowSsrAdapter", () => {
  // Why: SSR consumers (curl, plain `fetch`-follow) need a real 3xx to follow
  // the redirect server-side. `hard` mode forces 303 so the follow-up is GET.
  it("translates immediate redirect (hard) to 303 + Location + empty body", async () => {
    const envelope = {
      finished: true as const,
      end: {
        mode: "immediate" as const,
        action: { type: "redirect" as const, target: "/login", mode: "hard" as const },
      },
    };
    const { replied, status, location } = await runInterceptor(envelope);
    expect(status).toBe(303);
    expect(location).toBe("/login");
    expect(replied.called).toBe(true);
    expect(replied.value).toBe("");
  });

  // Why: soft redirects keep the request method, so 302 is the right status —
  // SPA can still pick this up if it bypasses the SSR layer.
  it("translates immediate redirect (soft) to 302 + Location + empty body", async () => {
    const envelope = {
      finished: true as const,
      end: {
        mode: "immediate" as const,
        action: { type: "redirect" as const, target: "/home", mode: "soft" as const },
      },
    };
    const { status, location } = await runInterceptor(envelope);
    expect(status).toBe(302);
    expect(location).toBe("/home");
  });

  // Why: countdown timer can't render server-side — keep the JSON so the
  // client takes over and renders the timer.
  it("passes through `auto` envelopes as JSON (no header/status mutation)", async () => {
    const envelope = {
      finished: true as const,
      end: {
        mode: "auto" as const,
        timeoutMs: 3000,
        action: { type: "redirect" as const, target: "/x", mode: "soft" as const },
      },
    };
    const { replied, location } = await runInterceptor(envelope);
    expect(replied.called).toBe(false);
    expect(location).toBeUndefined();
  });

  // Why: manual choice needs a user click — server can't pick the action.
  it("passes through `manual` envelopes as JSON", async () => {
    const envelope = {
      finished: true as const,
      end: {
        mode: "manual" as const,
        primary: {
          label: "OK",
          action: { type: "redirect" as const, target: "/x", mode: "soft" as const },
        },
      },
    };
    const { replied, location } = await runInterceptor(envelope);
    expect(replied.called).toBe(false);
    expect(location).toBeUndefined();
  });

  // Why: terminal data without `end` is just "done — render the message".
  // No HTTP redirect involved at any layer.
  it("passes through envelopes without `end`", async () => {
    const envelope = { finished: true as const, data: { ok: 1 } };
    const { replied, location } = await runInterceptor(envelope);
    expect(replied.called).toBe(false);
    expect(location).toBeUndefined();
  });

  // Why: non-envelope responses (inputRequired, sent/outlet, plain data)
  // must never be touched by this interceptor.
  it("ignores non-envelope responses", async () => {
    const { replied, location } = await runInterceptor({ inputRequired: { payload: {} } });
    expect(replied.called).toBe(false);
    expect(location).toBeUndefined();
  });

  // Why: reload/dismiss actions have no server-side equivalent — only
  // `redirect` actions translate.
  it("ignores immediate envelopes whose action is not a redirect", async () => {
    const envelope = {
      finished: true as const,
      end: { mode: "immediate" as const, action: { type: "reload" as const } },
    };
    const { replied, location } = await runInterceptor(envelope);
    expect(replied.called).toBe(false);
    expect(location).toBeUndefined();
  });

});
