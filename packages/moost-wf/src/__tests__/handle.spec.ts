import { describe, expect, it } from "vite-plus/test";
import { wrapFinished } from "../handle";

describe("wrapFinished", () => {
  it("wraps a plain object without a marker in `{ finished: true, ...result }`", () => {
    expect(wrapFinished({ ok: true, user: { name: "alice" } })).toEqual({
      finished: true,
      ok: true,
      user: { name: "alice" },
    });
  });

  it.each([
    ["inputRequired", { inputRequired: { payload: {}, transport: "http", context: {} } }],
    ["finished", { finished: true, ok: true, user: { name: "bob" } }],
    ["error", { error: { message: "boom" } }],
    ["sent", { sent: true }],
    ["outlet", { outlet: "awaiting-payment" }],
  ])("passes through a result already marked with `%s`", (_key, value) => {
    expect(wrapFinished(value)).toBe(value);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["empty string", ""],
    ["non-empty string", "hello"],
    ["number", 42],
    ["true", true],
    ["false", false],
  ])("passes through %s", (_label, value) => {
    expect(wrapFinished(value)).toBe(value);
  });

  it("passes through arrays", () => {
    const a = [1, 2, 3];
    expect(wrapFinished(a)).toBe(a);
  });

  it("does not mutate the input object", () => {
    const r = { ok: true };
    wrapFinished(r);
    expect(r).toEqual({ ok: true });
  });

  // Why: `finishWf` produces already-marked WfFinished envelopes; wrap
  // must be a true no-op so envelopes carrying `next: { trigger: 'immediate',
  // action: redirect }` reach the HTTP layer as 200 JSON (not 302) — the
  // SSR adapter is the only place that translates back to 3xx.
  it("passes through a full WfFinished envelope with a redirect next unchanged", () => {
    const envelope = {
      finished: true,
      next: {
        trigger: "immediate",
        action: { type: "redirect", target: "/login" },
      },
    };
    expect(wrapFinished(envelope)).toBe(envelope);
  });
});
