import { describe, expect, it, vi } from "vite-plus/test";

const setSpy = vi.fn();
vi.mock("@wooksjs/event-wf", () => ({
  useWfFinished: () => ({ set: setSpy, get: () => undefined }),
}));

const { abortWf, finishWf, isWfFinished } = await import("../wf-finished");
import { wrapFinished } from "../handle";

/**
 * Round-trip helper. Mirrors the envelope contract:
 *
 *   1. Workflow author calls `finishWf` / `abortWf`. The helper calls
 *      `useWfFinished().set({ type: 'data', value: <envelope> })`.
 *   2. Wooks's runtime unwraps the `value` field and hands the envelope to
 *      moost as the response body (wooks event-wf index.mjs:198).
 *   3. moost-wf's `handleAsOutletRequest` calls `wrapFinished` on the body.
 *      Because the envelope already carries `finished: true`, wrap is a
 *      no-op.
 *
 * After all three steps, the HTTP body MUST be the same envelope the
 * author built. The SSR adapter is the *only* layer that may rewrite it
 * (and only for `trigger: 'immediate'` redirects).
 */
function roundTrip(): unknown {
  const lastCall = setSpy.mock.calls[setSpy.mock.calls.length - 1];
  const unwrappedByWooks = (lastCall[0] as { value: unknown }).value;
  return wrapFinished(unwrappedByWooks);
}

describe("WfFinished helpers end-to-end through wrapFinished", () => {
  // Why: the critical invariant — envelopes never get re-wrapped on the
  // way out. If `wrapFinished` re-wraps an envelope, the SPA's
  // `wf.finished.value` ends up double-nested and routing breaks.

  it("finishWf({ data, message }) → identical envelope at the HTTP boundary", () => {
    setSpy.mockClear();
    finishWf({ data: { user: "alice" }, message: { level: "success", text: "Done" } });
    const body = roundTrip();
    expect(isWfFinished(body)).toBe(true);
    expect(body).toEqual({
      finished: true,
      data: { user: "alice" },
      message: { level: "success", text: "Done" },
    });
  });

  it("finishWf({ message }) → identical envelope at the HTTP boundary", () => {
    setSpy.mockClear();
    finishWf({ message: { level: "warn", text: "Heads up" } });
    expect(roundTrip()).toEqual({
      finished: true,
      message: { level: "warn", text: "Heads up" },
    });
  });

  it("finishWf with next.trigger='immediate' → envelope reaches HTTP as JSON", () => {
    setSpy.mockClear();
    finishWf({
      next: {
        trigger: "immediate",
        action: { type: "redirect", target: "/home" },
      },
    });
    const body = roundTrip() as { finished: true; next: { trigger: string; action: unknown } };
    expect(body.finished).toBe(true);
    expect(body.next.trigger).toBe("immediate");
    expect(body.next.action).toEqual({ type: "redirect", target: "/home" });
  });

  it("finishWf with next.trigger='auto' → countdown envelope passes through", () => {
    setSpy.mockClear();
    finishWf({
      next: {
        trigger: "auto",
        timeoutMs: 5000,
        action: { type: "redirect", target: "/x" },
        skipButton: { label: "Skip" },
      },
    });
    const body = roundTrip() as { next: { trigger: string; timeoutMs?: number } };
    expect(body.next.trigger).toBe("auto");
    expect(body.next.timeoutMs).toBe(5000);
  });

  it("finishWf with next.trigger='manual' → envelope passes through unchanged", () => {
    setSpy.mockClear();
    finishWf({
      next: {
        trigger: "manual",
        primary: { label: "Go", action: { type: "redirect", target: "/x" } },
        options: [{ label: "Dismiss", action: { type: "dismiss" } }],
      },
    });
    const body = roundTrip() as {
      next: { trigger: string; primary: unknown; options: unknown[] };
    };
    expect(body.next.trigger).toBe("manual");
    expect(body.next.primary).toBeDefined();
    expect(body.next.options).toHaveLength(1);
  });

  // Why: the failure mode this protects against is `wrapFinished` injecting
  // `{ finished: true, ...envelope }` and overwriting `aborted`/`reason`.
  // Even with already-marked envelopes, a sloppy re-wrap could lose flags.
  it("abortWf → aborted flag survives the wrap", () => {
    setSpy.mockClear();
    abortWf("user-cancelled");
    const body = roundTrip() as { finished: true; aborted: boolean; reason: string };
    expect(body.aborted).toBe(true);
    expect(body.reason).toBe("user-cancelled");
  });
});
