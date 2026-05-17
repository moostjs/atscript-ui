import { describe, expect, it, vi } from "vite-plus/test";

const setSpy = vi.fn();
vi.mock("@wooksjs/event-wf", () => ({
  useWfFinished: () => ({ set: setSpy, get: () => undefined }),
}));

const {
  finishWfAborted,
  finishWfWithChoice,
  finishWfWithData,
  finishWfWithMessage,
  finishWfWithRedirect,
  isWfFinished,
} = await import("../wf-finished");
import { wrapFinished } from "../handle";

/**
 * Round-trip helper. Mirrors the Phase-2 contract:
 *
 *   1. Workflow author calls a helper. Helper calls
 *      `useWfFinished().set({ type: 'data', value: <envelope> })`.
 *   2. Wooks's runtime unwraps the `value` field and hands the envelope to
 *      moost as the response body (wooks event-wf index.mjs:198).
 *   3. moost-wf's `handleAsOutletRequest` calls `wrapFinished` on the body.
 *      Because the envelope already carries `finished: true`, wrap is a
 *      no-op.
 *
 * After all three steps, the HTTP body MUST be the same envelope the
 * author built. The SSR adapter is the *only* layer that may rewrite it
 * (and only for `mode: 'immediate'` redirects).
 */
function roundTrip(): unknown {
  const lastCall = setSpy.mock.calls[setSpy.mock.calls.length - 1];
  const unwrappedByWooks = (lastCall[0] as { value: unknown }).value;
  return wrapFinished(unwrappedByWooks);
}

describe("WfFinished helpers end-to-end through wrapFinished", () => {
  // Why: this is the critical invariant Phase 2 protects — envelopes never
  // get re-wrapped on the way out. If `wrapFinished` re-wraps an envelope,
  // the SPA's `wf.finished.value` ends up double-nested and routing breaks.

  it("finishWfWithData → identical envelope at the HTTP boundary", () => {
    setSpy.mockClear();
    finishWfWithData({ user: "alice" }, { level: "success", text: "Done" });
    const body = roundTrip();
    expect(isWfFinished(body)).toBe(true);
    expect(body).toEqual({
      finished: true,
      data: { user: "alice" },
      message: { level: "success", text: "Done" },
    });
  });

  it("finishWfWithMessage → identical envelope at the HTTP boundary", () => {
    setSpy.mockClear();
    finishWfWithMessage("warn", "Heads up");
    expect(roundTrip()).toEqual({
      finished: true,
      message: { level: "warn", text: "Heads up" },
    });
  });

  it("finishWfWithRedirect (immediate) → envelope reaches HTTP as JSON", () => {
    setSpy.mockClear();
    finishWfWithRedirect("/home");
    const body = roundTrip() as { finished: true; end: { mode: string; action: unknown } };
    expect(body.finished).toBe(true);
    expect(body.end.mode).toBe("immediate");
    expect(body.end.action).toEqual({ type: "redirect", target: "/home" });
  });

  it("finishWfWithRedirect (auto) → countdown envelope passes through", () => {
    setSpy.mockClear();
    finishWfWithRedirect("/x", { autoMs: 5000, skipLabel: "Skip" });
    const body = roundTrip() as { end: { mode: string; timeoutMs?: number } };
    expect(body.end.mode).toBe("auto");
    expect(body.end.timeoutMs).toBe(5000);
  });

  it("finishWfWithChoice (manual) → envelope passes through unchanged", () => {
    setSpy.mockClear();
    finishWfWithChoice({
      primary: {
        label: "Go",
        action: { type: "redirect", target: "/x" },
      },
      options: [{ label: "Dismiss", action: { type: "dismiss" } }],
    });
    const body = roundTrip() as { end: { mode: string; primary: unknown; options: unknown[] } };
    expect(body.end.mode).toBe("manual");
    expect(body.end.primary).toBeDefined();
    expect(body.end.options).toHaveLength(1);
  });

  // Why: the failure mode this protects against is `wrapFinished` injecting
  // `{ finished: true, ...envelope }` and overwriting `aborted`/`reason`.
  // Even with already-marked envelopes, a sloppy re-wrap could lose flags.
  it("finishWfAborted → aborted flag survives the wrap", () => {
    setSpy.mockClear();
    finishWfAborted("user-cancelled");
    const body = roundTrip() as { finished: true; aborted: boolean; reason: string };
    expect(body.aborted).toBe(true);
    expect(body.reason).toBe("user-cancelled");
  });
});
