import { describe, expect, it, vi } from "vite-plus/test";

const setSpy = vi.fn();
vi.mock("@wooksjs/event-wf", () => ({
  useWfFinished: () => ({ set: setSpy, get: () => undefined }),
}));

const { abortWf, finishWf, isWfFinished } = await import("../wf-finished");
import type { WfFinished } from "../wf-finished";

function lastEnvelope(): WfFinished {
  const call = setSpy.mock.calls[setSpy.mock.calls.length - 1];
  // Helpers always call `set({ type: 'data', value: <envelope> })` so wooks
  // doesn't emit its own 302 — assert this contract at every call site.
  expect(call[0]).toHaveProperty("type", "data");
  return call[0].value as WfFinished;
}

describe("isWfFinished", () => {
  // Why: this guard is the only thing the SSR adapter and the Vue layer
  // use to discriminate the envelope from other moost responses.
  it("returns true only for { finished: true } objects", () => {
    expect(isWfFinished({ finished: true })).toBe(true);
    expect(isWfFinished({ finished: true, data: { x: 1 } })).toBe(true);
    expect(isWfFinished({ finished: false })).toBe(false);
    expect(isWfFinished({})).toBe(false);
    expect(isWfFinished(null)).toBe(false);
    expect(isWfFinished(undefined)).toBe(false);
    expect(isWfFinished("finished")).toBe(false);
  });
});

describe("finishWf", () => {
  // Why: helpers always wrap into `{ type: 'data', value: ... }` so the wooks
  // unwrap leaves the envelope intact. If a refactor breaks this, terminal
  // redirects start emitting 302 from wooks (wrong layer, breaks SPA fetch).
  it("emits a bare envelope when called with no options", () => {
    setSpy.mockClear();
    finishWf();
    expect(lastEnvelope()).toEqual({ finished: true });
  });

  // Why: terminal data is the most common shape; ensure no `next` is added
  // so the UI fires `@finished` and stops without a redirect/countdown.
  it("emits `data` without `next` when only `data` is passed", () => {
    setSpy.mockClear();
    finishWf({ data: { user: "alice" } });
    const env = lastEnvelope();
    expect(env).toEqual({ finished: true, data: { user: "alice" } });
    expect(env.next).toBeUndefined();
  });

  // Why: banner-only finish (no data, no next) — "done, here's why".
  it("emits a message-only envelope", () => {
    setSpy.mockClear();
    finishWf({ message: { level: "info", text: "All done" } });
    expect(lastEnvelope()).toEqual({
      finished: true,
      message: { level: "info", text: "All done" },
    });
  });

  it("threads `data` + `message` through together", () => {
    setSpy.mockClear();
    finishWf({ data: { ok: 1 }, message: { level: "success", text: "Saved" } });
    expect(lastEnvelope()).toEqual({
      finished: true,
      data: { ok: 1 },
      message: { level: "success", text: "Saved" },
    });
  });

  // Why: `trigger: 'immediate'` is the most common login-flow shape
  // ("login OK, take me to /dashboard"). The consumer's `navigate` handler
  // decides cross-origin vs in-app routing — modes don't live in the envelope.
  it("with next.trigger='immediate' emits an immediate redirect envelope", () => {
    setSpy.mockClear();
    finishWf({
      next: {
        trigger: "immediate",
        action: { type: "redirect", target: "/dashboard" },
      },
    });
    expect(lastEnvelope()).toEqual({
      finished: true,
      next: {
        trigger: "immediate",
        action: { type: "redirect", target: "/dashboard" },
      },
    });
  });

  // Why: `trigger: 'auto'` switches the UI into countdown mode — a "redirecting
  // in N seconds" banner with optional skip button.
  it("with next.trigger='auto' emits a countdown envelope", () => {
    setSpy.mockClear();
    finishWf({
      next: {
        trigger: "auto",
        timeoutMs: 3000,
        action: { type: "redirect", target: "/x" },
        skipButton: { label: "Skip" },
      },
    });
    const env = lastEnvelope();
    expect(env.next?.trigger).toBe("auto");
    if (env.next?.trigger === "auto") {
      expect(env.next.timeoutMs).toBe(3000);
      expect(env.next.skipButton).toEqual({ label: "Skip" });
      expect(env.next.action).toEqual({ type: "redirect", target: "/x" });
    }
  });

  // Why: `trigger: 'manual'` is the "user picks an outcome" shape —
  // both primary-only and options-only are valid.
  it("with next.trigger='manual' carries primary + options + data + message", () => {
    setSpy.mockClear();
    finishWf({
      data: { id: 7 },
      message: { level: "warn", text: "Confirm" },
      next: {
        trigger: "manual",
        primary: { label: "Go", action: { type: "reload" } },
        options: [{ label: "Cancel", action: { type: "dismiss" } }],
      },
    });
    const env = lastEnvelope();
    expect(env.data).toEqual({ id: 7 });
    expect(env.message).toEqual({ level: "warn", text: "Confirm" });
    if (env.next?.trigger === "manual") {
      expect(env.next.primary?.label).toBe("Go");
      expect(env.next.options).toHaveLength(1);
    }
  });
});

describe("abortWf", () => {
  // Why: aborted is a distinct terminal state — UI may render differently
  // (error styling, retry option). Asserting the flag keeps that contract.
  it("sets aborted: true and reason", () => {
    setSpy.mockClear();
    abortWf("cancelled-by-user");
    const env = lastEnvelope();
    expect(env.aborted).toBe(true);
    expect(env.reason).toBe("cancelled-by-user");
  });

  it("threads through optional message and next", () => {
    setSpy.mockClear();
    abortWf("expired", {
      message: { level: "error", text: "Session expired" },
      next: {
        trigger: "immediate",
        action: { type: "redirect", target: "/login" },
      },
    });
    const env = lastEnvelope();
    expect(env.aborted).toBe(true);
    expect(env.reason).toBe("expired");
    expect(env.message?.text).toBe("Session expired");
    expect(env.next?.trigger).toBe("immediate");
  });

  // Why: an aborted flow may still want to surface partial data the user
  // can act on (e.g. a draft id to resume later).
  it("carries optional partial data", () => {
    setSpy.mockClear();
    abortWf("incomplete", { data: { draftId: 42 } });
    const env = lastEnvelope();
    expect(env.aborted).toBe(true);
    expect(env.data).toEqual({ draftId: 42 });
  });
});

describe("type-level narrowing", () => {
  // Why: consumers rely on `isWfFinished` to discriminate envelope shape
  // inside `if`/`else`. If narrowing breaks, every Vue/SSR consumer ends
  // up with `unknown` and casts everywhere.
  it("narrows `unknown` to WfFinished", () => {
    const v: unknown = { finished: true, data: { x: 1 } };
    if (isWfFinished(v)) {
      // Compile-time guard: `v.data` must be accessible without casts.
      expect(v.data).toEqual({ x: 1 });
    } else {
      throw new Error("narrowing failed");
    }
  });
});
