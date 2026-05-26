import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { useWfForm } from "../use-wf-form";
import type { UseWfFormOptions, UseWfFormReturn } from "../use-wf-form";

function mountComposable(opts: UseWfFormOptions) {
  let result!: UseWfFormReturn;
  const Comp = defineComponent({
    setup() {
      result = useWfForm(opts);
      return () => h("div");
    },
  });
  const wrapper = mount(Comp);
  return { result, wrapper };
}

const originalLocation = window.location;

function stubLocationSearch(search: string) {
  Object.defineProperty(window, "location", {
    value: { ...originalLocation, search },
    writable: true,
    configurable: true,
  });
}

function restoreLocation() {
  Object.defineProperty(window, "location", {
    value: originalLocation,
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  restoreLocation();
});

describe("useWfForm — post() token extraction on 4xx", () => {
  // WHY: HandleStateStrategy issues single-use handles via getAndDelete.
  // When a workflow step throws mid-execution, the server saves a fresh
  // handle and returns it on a 4xx body. If the client discards that
  // fresh handle, the next submit replays the consumed one → permanent
  // 410 Gone. The user's only path forward is requesting a new email.
  it("extracts a fresh wfs token from a 4xx response body before erroring", async () => {
    const captured: Array<Record<string, unknown>> = [];
    let callCount = 0;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      callCount++;
      captured.push(JSON.parse(init?.body as string));
      if (callCount === 1) {
        // First submit: 4xx with a NEW handle.
        return {
          ok: false,
          status: 400,
          statusText: "Bad Request",
          json: async () => ({
            wfs: "fresh-handle-after-error",
            message: "Password was recently used",
          }),
        } as unknown as Response;
      }
      // Second submit: another 4xx with yet another new handle. Confirms
      // the chain forwards each fresh token rather than discarding it.
      return {
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          wfs: "even-newer-handle",
          message: "Try a different password",
        }),
      } as unknown as Response;
    });

    const { result } = mountComposable({
      path: "/api/wf",
      name: "auth/recover",
      autoStart: false,
      initialToken: "magic-link-handle",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await result.start({ password: "first-try" });
    await flushPromises();

    expect(captured[0]).toMatchObject({ wfs: "magic-link-handle" });
    expect(result.error.value).toMatchObject({
      message: "Password was recently used",
      status: 400,
    });
    expect(result.finished.value).toBe(false);

    await result.retry();
    await flushPromises();

    // The retry MUST send the fresh handle from the first 4xx body,
    // not the original magic-link-handle (which the server has deleted).
    expect(captured[1]).toMatchObject({ wfs: "fresh-handle-after-error" });
  });

  // WHY: defensive — non-object error bodies (plain text, empty, arrays)
  // must not crash extraction and must not silently overwrite the token.
  it("does not crash or update the token on non-object error bodies", async () => {
    const captured: Array<Record<string, unknown>> = [];
    let callCount = 0;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      callCount++;
      captured.push(JSON.parse(init?.body as string));
      if (callCount === 1) {
        return {
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          // Body parses to a string, not an object — must not call extractToken.
          json: async () => "Internal Server Error",
        } as unknown as Response;
      }
      return {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({ message: "still broken" }),
      } as unknown as Response;
    });

    const { result } = mountComposable({
      path: "/api/wf",
      name: "auth/recover",
      autoStart: false,
      initialToken: "original-handle",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await result.start({ password: "x" });
    await flushPromises();

    expect(result.error.value).toMatchObject({ status: 500 });

    await result.retry();
    await flushPromises();

    // Token unchanged — still the original handle, because the previous
    // error body wasn't an object and didn't yield a wfs.
    expect(captured[1]).toMatchObject({ wfs: "original-handle" });
  });
});

describe("useWfForm — dev warning for unused magic-link token", () => {
  // WHY: silent-restart of a magic-link flow is the worst UX — neither
  // the old handle gets consumed nor does the user see an error. The
  // warning surfaces the misconfiguration loudly during dev so the
  // consumer remembers to wire `initial-token`.
  it("warns when URL has ?wfs=… but initialToken is missing (body transport)", async () => {
    stubLocationSearch("?wfs=link-token");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({ finished: true }),
        }) as unknown as Response,
    );

    mountComposable({
      path: "/api/wf",
      name: "auth/login",
      fetch: fetchMock as unknown as typeof fetch,
    });
    await flushPromises();

    expect(warn).toHaveBeenCalledTimes(1);
    const msg = warn.mock.calls[0]![0] as string;
    expect(msg).toContain("wfs");
    expect(msg).toContain("initialToken");
  });

  it("does not warn when initialToken IS passed", async () => {
    stubLocationSearch("?wfs=link-token");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({ finished: true }),
        }) as unknown as Response,
    );

    mountComposable({
      path: "/api/wf",
      name: "auth/login",
      initialToken: "link-token",
      fetch: fetchMock as unknown as typeof fetch,
    });
    await flushPromises();

    expect(warn).not.toHaveBeenCalled();
  });

  it("does not warn when tokenTransport is 'query'", async () => {
    stubLocationSearch("?wfs=link-token");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({ finished: true }),
        }) as unknown as Response,
    );

    mountComposable({
      path: "/api/wf",
      name: "auth/login",
      tokenTransport: "query",
      fetch: fetchMock as unknown as typeof fetch,
    });
    await flushPromises();

    expect(warn).not.toHaveBeenCalled();
  });

  it("does not warn when URL has no wfs param", async () => {
    stubLocationSearch("");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({ finished: true }),
        }) as unknown as Response,
    );

    mountComposable({
      path: "/api/wf",
      name: "auth/login",
      fetch: fetchMock as unknown as typeof fetch,
    });
    await flushPromises();

    expect(warn).not.toHaveBeenCalled();
  });
});

describe("useWfForm — error response handling", () => {
  function makeFetchMock(body: unknown, status: number, statusText: string) {
    return vi.fn(
      async () =>
        ({
          ok: false,
          status,
          statusText,
          json: async () => body,
        }) as unknown as Response,
    );
  }

  // WHY: regression for the field-name mismatch — `@wooksjs/event-wf` emits
  // failed-response bodies as `{ error: string }`, but the SPA used to read
  // `data.message`. Engine emissions MUST surface verbatim instead of falling
  // through to the HTTP reason phrase.
  it("surfaces engine `error` field when server returns 4xx with `{ error: ... }`", async () => {
    const fetchMock = makeFetchMock({ error: "Invalid or expired workflow state" }, 410, "Gone");
    const { result } = mountComposable({
      path: "/api/wf",
      name: "auth/login",
      autoStart: false,
      fetch: fetchMock as unknown as typeof fetch,
    });

    await result.start();
    await flushPromises();

    expect(result.error.value).toMatchObject({
      message: "Invalid or expired workflow state",
      status: 410,
    });
  });

  // WHY: pin dual-field tolerance for `HttpError`-shaped responses from
  // non-engine handlers (e.g. moost-http's auto-serialized `{ message }`
  // bodies). Either shape must produce a usable message.
  it("falls back to `message` field when `error` is absent", async () => {
    const fetchMock = makeFetchMock({ message: "Custom error" }, 400, "Bad Request");
    const { result } = mountComposable({
      path: "/api/wf",
      name: "auth/login",
      autoStart: false,
      fetch: fetchMock as unknown as typeof fetch,
    });

    await result.start();
    await flushPromises();

    expect(result.error.value).toMatchObject({ message: "Custom error", status: 400 });
  });

  // WHY: pin precedence so engine emissions always win. If both fields are
  // present, the engine's `error` is the authoritative one — `message` is a
  // compatibility fallback for non-engine callers and must not shadow it.
  it("prefers `error` over `message` when both present", async () => {
    const fetchMock = makeFetchMock({ error: "engine-msg", message: "ignored" }, 410, "Gone");
    const { result } = mountComposable({
      path: "/api/wf",
      name: "auth/login",
      autoStart: false,
      fetch: fetchMock as unknown as typeof fetch,
    });

    await result.start();
    await flushPromises();

    expect(result.error.value).toMatchObject({ message: "engine-msg", status: 410 });
  });

  // WHY: primary fallback regression — the HTTP reason phrase ("Gone") must
  // never reach the user-facing error slot. A friendly mapped message is the
  // baseline UX when the server didn't supply a body.
  it("falls back to friendly 410 message when body has neither field", async () => {
    const fetchMock = makeFetchMock(null, 410, "Gone");
    const { result } = mountComposable({
      path: "/api/wf",
      name: "auth/login",
      autoStart: false,
      fetch: fetchMock as unknown as typeof fetch,
    });

    await result.start();
    await flushPromises();

    const err = result.error.value as { message: string; status: number };
    expect(err.message).toBe("This session has expired. Please start over.");
    expect(err.message).not.toBe("Gone");
    expect(err.status).toBe(410);
  });

  // WHY: covers the whole user-facing 4xx surface so a typo in any entry of
  // FRIENDLY_STATUS_MESSAGES surfaces in CI rather than in a customer's UI.
  it.each([
    [400, "The request was invalid. Please check your input and try again."],
    [401, "You need to sign in to continue."],
    [403, "You don't have permission to do that."],
    [404, "We couldn't find what you're looking for."],
    [410, "This session has expired. Please start over."],
    [429, "Too many requests. Please wait a moment and try again."],
  ])("falls back to friendly mapped message for status %i", async (status, expected) => {
    const fetchMock = makeFetchMock(null, status, "X");
    const { result } = mountComposable({
      path: "/api/wf",
      name: "auth/login",
      autoStart: false,
      fetch: fetchMock as unknown as typeof fetch,
    });

    await result.start();
    await flushPromises();

    expect(result.error.value).toMatchObject({ message: expected, status });
  });

  // WHY: ensure unmapped 4xx codes hit the `>= 400` generic branch rather
  // than the 5xx branch or leaking the raw statusText ("I'm a teapot").
  it("falls back to friendly 4xx default for unmapped 4xx status", async () => {
    const fetchMock = makeFetchMock(null, 418, "I'm a teapot");
    const { result } = mountComposable({
      path: "/api/wf",
      name: "auth/login",
      autoStart: false,
      fetch: fetchMock as unknown as typeof fetch,
    });

    await result.start();
    await flushPromises();

    const err = result.error.value as { message: string; status: number };
    expect(err.message).toBe("Something went wrong with that request. Please try again.");
    expect(err.message).not.toBe("I'm a teapot");
    expect(err.status).toBe(418);
  });

  // WHY: pin the 5xx branch including non-IANA codes (Cloudflare-style 599).
  // All server errors must collapse to a generic "try again" message — no
  // HTTP jargon leakage regardless of code.
  it("falls back to friendly 5xx default for any 5xx", async () => {
    const fetchMock = makeFetchMock(null, 599, "Network Connect Timeout Error");
    const { result } = mountComposable({
      path: "/api/wf",
      name: "auth/login",
      autoStart: false,
      fetch: fetchMock as unknown as typeof fetch,
    });

    await result.start();
    await flushPromises();

    expect(result.error.value).toMatchObject({
      message: "Something went wrong on our end. Please try again in a moment.",
      status: 599,
    });
  });
});
