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
