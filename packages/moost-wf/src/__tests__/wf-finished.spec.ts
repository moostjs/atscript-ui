import { describe, expect, it, vi } from "vite-plus/test";

const setSpy = vi.fn();
vi.mock("@wooksjs/event-wf", () => ({
  useWfFinished: () => ({ set: setSpy, get: () => undefined }),
}));

const {
  finishWf,
  finishWfAborted,
  finishWfWithChoice,
  finishWfWithData,
  finishWfWithMessage,
  finishWfWithRedirect,
  isWfFinished,
} = await import("../wf-finished");
import type { WfFinished } from "../wf-finished";

function lastEnvelope(): WfFinished {
  const call = setSpy.mock.calls[setSpy.mock.calls.length - 1];
  // helpers always call `set({ type: 'data', value: <envelope> })` so wooks
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
  it("passes the envelope through verbatim under `value`", () => {
    setSpy.mockClear();
    finishWf({ finished: true, data: { id: 1 } });
    expect(lastEnvelope()).toEqual({ finished: true, data: { id: 1 } });
  });
});

describe("finishWfWithData", () => {
  // Why: terminal data is the most common shape; ensure no `end` is added
  // so the UI fires `@finished` and stops without a redirect/countdown.
  it("builds an envelope with `data` and no `end`", () => {
    setSpy.mockClear();
    finishWfWithData({ user: "alice" });
    const env = lastEnvelope();
    expect(env).toEqual({ finished: true, data: { user: "alice" } });
    expect(env.end).toBeUndefined();
  });

  it("includes an optional message", () => {
    setSpy.mockClear();
    finishWfWithData({ ok: 1 }, { level: "success", text: "Saved" });
    expect(lastEnvelope()).toEqual({
      finished: true,
      data: { ok: 1 },
      message: { level: "success", text: "Saved" },
    });
  });
});

describe("finishWfWithMessage", () => {
  // Why: banner-only finish (no data, no end) — used for "done, here's why".
  it("builds an envelope with only a message", () => {
    setSpy.mockClear();
    finishWfWithMessage("info", "All done");
    expect(lastEnvelope()).toEqual({
      finished: true,
      message: { level: "info", text: "All done" },
    });
  });
});

describe("finishWfWithRedirect", () => {
  // Why: bare call defaults to immediate — the most common login flow
  // ("login OK, take me to /dashboard"). The consumer's `navigate` handler
  // decides cross-origin vs in-app routing — modes don't live in the envelope.
  it("defaults to immediate redirect", () => {
    setSpy.mockClear();
    finishWfWithRedirect("/dashboard");
    expect(lastEnvelope()).toEqual({
      finished: true,
      end: {
        mode: "immediate",
        action: { type: "redirect", target: "/dashboard" },
      },
    });
  });

  // Why: `autoMs` switches the envelope into countdown mode — UI shows a
  // "redirecting in N seconds" banner with optional skip button.
  it("with autoMs builds an `auto` end with timeoutMs", () => {
    setSpy.mockClear();
    finishWfWithRedirect("/x", { autoMs: 3000, skipLabel: "Skip" });
    const env = lastEnvelope();
    expect(env.end?.mode).toBe("auto");
    if (env.end?.mode === "auto") {
      expect(env.end.timeoutMs).toBe(3000);
      expect(env.end.skipButton).toEqual({ label: "Skip" });
      expect(env.end.action).toEqual({ type: "redirect", target: "/x" });
    }
  });

  it("propagates message + reason", () => {
    setSpy.mockClear();
    finishWfWithRedirect("/x", {
      reason: "session-renewed",
      message: { level: "success", text: "Welcome back" },
    });
    const env = lastEnvelope();
    expect(env.message).toEqual({ level: "success", text: "Welcome back" });
    if (env.end?.mode === "immediate" && env.end.action.type === "redirect") {
      expect(env.end.action.reason).toBe("session-renewed");
    }
  });
});

describe("finishWfWithChoice", () => {
  // Why: round-2 delta — primary became optional, but the envelope still
  // needs *some* button. This guard prevents shipping an unactionable screen.
  it("throws when neither primary nor options provided", () => {
    expect(() => finishWfWithChoice({})).toThrow(/at least a primary button or one option/i);
    expect(() => finishWfWithChoice({ options: [] })).toThrow();
  });

  // Why: round-2 delta — both shapes ("primary + options" and "options only"
  // with equal-weight buttons) are valid.
  it("accepts primary-only (no options)", () => {
    setSpy.mockClear();
    finishWfWithChoice({
      primary: {
        label: "OK",
        action: { type: "redirect", target: "/x" },
      },
    });
    const env = lastEnvelope();
    expect(env.end?.mode).toBe("manual");
    if (env.end?.mode === "manual") {
      expect(env.end.primary?.label).toBe("OK");
      expect(env.end.options).toBeUndefined();
    }
  });

  it("accepts options-only (no primary)", () => {
    setSpy.mockClear();
    finishWfWithChoice({
      options: [
        { label: "Yes", action: { type: "dismiss" } },
        { label: "No", action: { type: "dismiss" } },
      ],
    });
    const env = lastEnvelope();
    if (env.end?.mode === "manual") {
      expect(env.end.primary).toBeUndefined();
      expect(env.end.options).toHaveLength(2);
    }
  });

  it("carries data + message into the envelope", () => {
    setSpy.mockClear();
    finishWfWithChoice({
      data: { id: 7 },
      message: { level: "warn", text: "Confirm" },
      primary: { label: "Go", action: { type: "reload" } },
    });
    const env = lastEnvelope();
    expect(env.data).toEqual({ id: 7 });
    expect(env.message).toEqual({ level: "warn", text: "Confirm" });
  });
});

describe("finishWfAborted", () => {
  // Why: aborted is a distinct terminal state — UI may render differently
  // (error styling, retry option). Asserting the flag keeps that contract.
  it("sets aborted: true and reason", () => {
    setSpy.mockClear();
    finishWfAborted("cancelled-by-user");
    const env = lastEnvelope();
    expect(env.aborted).toBe(true);
    expect(env.reason).toBe("cancelled-by-user");
  });

  it("threads through optional message and end", () => {
    setSpy.mockClear();
    finishWfAborted("expired", {
      message: { level: "error", text: "Session expired" },
      end: {
        mode: "immediate",
        action: { type: "redirect", target: "/login" },
      },
    });
    const env = lastEnvelope();
    expect(env.message?.text).toBe("Session expired");
    expect(env.end?.mode).toBe("immediate");
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
