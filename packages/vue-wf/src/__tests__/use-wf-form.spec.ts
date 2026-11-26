import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSSRApp, defineComponent, h, nextTick, reactive } from "vue";
import { flushPromises } from "@vue/test-utils";
import { useWfForm } from "../use-wf-form";
import type { UseWfFormOptions, UseWfFormReturn } from "../use-wf-form";
import {
  mockFetch,
  mockFetchError,
  mockInputRequired,
  mockFinished,
  mockError,
  mountComposable,
  restoreLocation,
  stubLocationSearch,
} from "./helpers";

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useWfForm", () => {
  it("auto-starts on mount and processes inputRequired response", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    const { calls } = mockFetch([mockInputRequired(LoginForm, { token: "tok1" })]);

    const { result } = mountComposable({ path: "/api/wf", name: "auth/login" });
    await flushPromises();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toEqual({ wfid: "auth/login" });
    expect(result.formDef.value).not.toBeNull();
    expect(result.formDef.value!.fields).toHaveLength(2);
    expect(result.formData.value).not.toBeNull();
    expect(result.loading.value).toBe(false);
    expect(result.finished.value).toBe(false);
    expect(result.error.value).toBeNull();
  });

  it("autoStart: false does not fetch on mount", async () => {
    const { calls } = mockFetch([]);
    mountComposable({ path: "/api/wf", name: "test", autoStart: false });
    await flushPromises();
    expect(calls).toHaveLength(0);
  });

  it("sends initial input with start request", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    const { calls } = mockFetch([mockInputRequired(LoginForm)]);

    mountComposable({ path: "/api/wf", name: "auth/login", input: { hint: "prefill" } });
    await flushPromises();

    expect(calls[0]!.body).toEqual({
      wfid: "auth/login",
      input: { formData: { hint: "prefill" } },
    });
  });

  it("submit() sends POST with { wfs, input }", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    const { calls } = mockFetch([
      mockInputRequired(LoginForm, { token: "tok1" }),
      mockFinished({ userId: 42 }),
    ]);

    const { result } = mountComposable({ path: "/api/wf", name: "auth/login" });
    await flushPromises();

    await result.submit({ username: "alice", password: "secret" });
    await flushPromises();

    expect(calls).toHaveLength(2);
    expect(calls[1]!.body).toEqual({
      wfs: "tok1",
      input: { formData: { username: "alice", password: "secret" } },
    });
    expect(result.finished.value).toBe(true);
    expect(result.response.value).toMatchObject({ finished: true, userId: 42 });
    expect(result.formDef.value).toBeNull();
  });

  it("action() sends POST with { wfs, action } (no input)", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    const { calls } = mockFetch([
      mockInputRequired(LoginForm, { token: "tok1" }),
      mockInputRequired(LoginForm, { token: "tok2" }),
    ]);

    const { result } = mountComposable({ path: "/api/wf", name: "auth/login" });
    await flushPromises();

    await result.action("resend");
    await flushPromises();

    expect(calls[1]!.body).toEqual({ wfs: "tok1", input: { action: "resend" } });
  });

  it("actionWithData() sends POST with { wfs, input, action }", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    const { calls } = mockFetch([
      mockInputRequired(LoginForm, { token: "tok1" }),
      mockInputRequired(LoginForm, { token: "tok2" }),
    ]);

    const { result } = mountComposable({ path: "/api/wf", name: "auth/login" });
    await flushPromises();

    await result.actionWithData("saveDraft", { username: "alice" });
    await flushPromises();

    expect(calls[1]!.body).toEqual({
      wfs: "tok1",
      input: { action: "saveDraft", formData: { username: "alice" } },
    });
  });

  it("extracts errors from context.errors into errors ref", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    mockFetch([
      mockInputRequired(LoginForm, {
        errors: { username: "Required", password: "Too short" },
        context: { passwordRules: ["min 8 chars"] },
      }),
    ]);

    const { result } = mountComposable({ path: "/api/wf", name: "auth/login" });
    await flushPromises();

    expect(result.errors.value).toEqual({ username: "Required", password: "Too short" });
    expect(result.formContext.value).toEqual({ passwordRules: ["min 8 chars"] });
    expect(result.formContext.value).not.toHaveProperty("errors");
  });

  it("handles server error responses", async () => {
    mockFetch([mockError("Workflow not found", 404)]);

    const { result } = mountComposable({ path: "/api/wf", name: "bad" });
    await flushPromises();

    expect(result.error.value).toEqual({
      message: "Workflow not found",
      status: 404,
      body: { message: "Workflow not found", status: 404 },
    });
    expect(result.formDef.value).toBeNull();
  });

  it("handles HTTP error (non-ok response)", async () => {
    mockFetchError(500, "Internal Server Error");

    const { result } = mountComposable({ path: "/api/wf", name: "test" });
    await flushPromises();

    expect(result.error.value).toEqual({
      message: "Internal Server Error",
      status: 500,
      body: { message: "Internal Server Error" },
    });
  });

  it("handles network errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Network failure");
      }),
    );

    const { result } = mountComposable({ path: "/api/wf", name: "test" });
    await flushPromises();

    expect(result.error.value).toEqual({ message: "Network failure" });
  });

  it("retry() re-sends last request", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, _init?: RequestInit) => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 500,
            statusText: "Error",
            json: async () => ({ message: "Error" }),
          };
        }
        return { ok: true, json: async () => mockInputRequired(LoginForm) };
      }),
    );

    const { result } = mountComposable({ path: "/api/wf", name: "test" });
    await flushPromises();
    expect(result.error.value).toBeTruthy();

    await result.retry();
    await flushPromises();
    expect(result.error.value).toBeNull();
    expect(result.formDef.value).not.toBeNull();
  });

  it("loading toggles during requests", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    let resolveResponse!: (v: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveResponse = resolve;
          }),
      ),
    );

    const { result } = mountComposable({ path: "/api/wf", name: "test" });
    await nextTick();
    expect(result.loading.value).toBe(true);

    resolveResponse({ ok: true, json: async () => mockInputRequired(LoginForm) });
    await flushPromises();
    expect(result.loading.value).toBe(false);
  });

  it("token updates across round-trips", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    const { calls } = mockFetch([
      mockInputRequired(LoginForm, { token: "tok1" }),
      mockInputRequired(LoginForm, { token: "tok2" }),
      mockFinished(),
    ]);

    const { result } = mountComposable({ path: "/api/wf", name: "test" });
    await flushPromises();

    await result.submit({ username: "a" });
    await flushPromises();
    expect(calls[1]!.body).toHaveProperty("wfs", "tok1");

    await result.submit({ username: "b" });
    await flushPromises();
    expect(calls[2]!.body).toHaveProperty("wfs", "tok2");
  });

  it("cookie transport: no token in body, credentials include", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    const { calls } = mockFetch([mockInputRequired(LoginForm)]);

    mountComposable({ path: "/api/wf", name: "test", tokenTransport: "cookie" });
    await flushPromises();

    expect(calls[0]!.body).not.toHaveProperty("wfs");
    expect(calls[0]!.init?.credentials).toBe("include");
  });

  it("custom tokenName and wfidName", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    const { calls } = mockFetch([{ ...mockInputRequired(LoginForm), myToken: "custom-tok" }]);

    const { result } = mountComposable({
      path: "/api/wf",
      name: "myflow",
      tokenName: "myToken",
      wfidName: "flowId",
    });
    await flushPromises();

    expect(calls[0]!.body).toEqual({ flowId: "myflow" });

    await result.submit({ x: 1 });
    await flushPromises();
    expect(calls[1]!.body).toHaveProperty("myToken", "custom-tok");
  });

  it("multi-step: login form → MFA form → finished", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    const { MfaForm } = await import("./fixtures/mfa-form.as");

    mockFetch([
      mockInputRequired(LoginForm, { token: "tok1" }),
      mockInputRequired(MfaForm, { token: "tok2" }),
      mockFinished({ success: true }),
    ]);

    const { result } = mountComposable({ path: "/api/wf", name: "auth/login" });
    await flushPromises();

    expect(result.formDef.value!.fields).toHaveLength(2);

    await result.submit({ username: "alice", password: "pass" });
    await flushPromises();
    expect(result.formDef.value!.fields).toHaveLength(1);
    expect(result.finished.value).toBe(false);

    await result.submit({ code: "123456" });
    await flushPromises();
    expect(result.finished.value).toBe(true);
    expect(result.formDef.value).toBeNull();
  });

  it("handles unexpected response format", async () => {
    mockFetch([{ something: "unexpected" }]);

    const { result } = mountComposable({ path: "/api/wf", name: "test" });
    await flushPromises();

    expect(result.error.value).toEqual({ message: "Unexpected response format" });
  });

  it("finishedPayload surfaces the typed envelope on finish", async () => {
    // WHY: typed accessor lets new code reach `next.trigger` without `any` casts.
    const { LoginForm } = await import("./fixtures/login-form.as");
    mockFetch([
      mockInputRequired(LoginForm, { token: "tok1" }),
      {
        finished: true,
        data: { userId: 42 },
        next: { trigger: "manual", primary: { label: "OK", action: { type: "dismiss" } } },
      },
    ]);
    const { result } = mountComposable({ path: "/api/wf", name: "auth/login" });
    await flushPromises();
    await result.submit({ username: "a", password: "b" });
    await flushPromises();
    expect(result.finishedPayload.value).not.toBeNull();
    expect(result.finishedPayload.value!.next?.trigger).toBe("manual");
    expect(result.finishedPayload.value!.data).toEqual({ userId: 42 });
  });

  it("finishedPayload stays null on outlet-pause responses", async () => {
    // WHY: outlet pause ≠ terminal envelope per Phase 2 contract.
    mockFetch([{ sent: true, outlet: "email" }]);
    const { result } = mountComposable({ path: "/api/wf", name: "test" });
    await flushPromises();
    expect(result.finished.value).toBe(true);
    expect(result.finishedPayload.value).toBeNull();
  });

  it("finishedPayload stays null while form is rendered", async () => {
    // WHY: only a `finished: true` response should populate the typed accessor.
    const { LoginForm } = await import("./fixtures/login-form.as");
    mockFetch([mockInputRequired(LoginForm)]);
    const { result } = mountComposable({ path: "/api/wf", name: "auth/login" });
    await flushPromises();
    expect(result.finishedPayload.value).toBeNull();
  });

  it("custom fetch override is used instead of global fetch", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    const globalSpy = vi.fn();
    vi.stubGlobal("fetch", globalSpy);

    const customFetch = vi.fn(
      async () =>
        ({
          ok: true,
          json: async () => mockInputRequired(LoginForm, { token: "tok1" }),
        }) as Response,
    );

    mountComposable({
      path: "/api/wf",
      name: "auth/login",
      fetch: customFetch as unknown as typeof fetch,
    });
    await flushPromises();

    expect(customFetch).toHaveBeenCalledTimes(1);
    expect(globalSpy).not.toHaveBeenCalled();
  });
});

// Why: the client followed a token that changed between pauses but never told
// the app, so a page started from a link kept the link's token in its URL and
// resent it after a reload — once the server rotates the token, that run is lost.
describe("useWfForm — token", () => {
  it("starts as initialToken and follows each answer's wfs", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    mockFetch([
      mockInputRequired(LoginForm, { token: "link" }),
      mockInputRequired(LoginForm, { token: "rotated" }),
    ]);

    const { result } = mountComposable({
      path: "/api/wf",
      name: "users/invite",
      initialToken: "link",
      autoStart: false,
    });
    expect(result.token.value).toBe("link");

    await result.start();
    await flushPromises();
    expect(result.token.value).toBe("link");

    await result.submit({ username: "a" });
    await flushPromises();
    expect(result.token.value).toBe("rotated");
  });

  it("is cleared when the run finishes, so a later start() begins a new run", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    const { calls } = mockFetch([
      mockInputRequired(LoginForm, { token: "tok1" }),
      mockFinished(),
      mockInputRequired(LoginForm, { token: "tok2" }),
    ]);

    const { result } = mountComposable({ path: "/api/wf", name: "auth/login" });
    await flushPromises();
    expect(result.token.value).toBe("tok1");

    await result.submit({ username: "a" });
    await flushPromises();
    expect(result.token.value).toBeUndefined();

    await result.start();
    await flushPromises();
    expect(calls[2]!.body).toEqual({ wfid: "auth/login" });
  });

  it.each([
    [
      "without a wfs (the token went out of band) clears it",
      { sent: true, outlet: "email" },
      undefined,
    ],
    ["with a wfs (in band) keeps that one", { outlet: "awaiting-payment", wfs: "pay" }, "pay"],
  ])("an outlet pause %s", async (_, answer, expected) => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    mockFetch([mockInputRequired(LoginForm, { token: "tok1" }), answer]);

    const { result } = mountComposable({ path: "/api/wf", name: "users/invite" });
    await flushPromises();
    await result.submit({ username: "a" });
    await flushPromises();

    expect(result.finished.value).toBe(true);
    expect(result.token.value).toBe(expected);
  });

  it("a refused answer keeps the token, unless it carries a fresh one", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    const answers = [
      { ok: true, status: 200, body: mockInputRequired(LoginForm, { token: "tok1" }) },
      { ok: false, status: 410, body: { message: "Gone", code: "WF_EXPIRED" } },
      { ok: false, status: 400, body: { message: "Try again", wfs: "fresh" } },
    ];
    let i = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const { ok, status, body } = answers[i++]!;
        return { ok, status, json: async () => body } as unknown as Response;
      }),
    );

    const { result } = mountComposable({ path: "/api/wf", name: "auth/login" });
    await flushPromises();
    await result.submit({ username: "a" });
    await flushPromises();
    expect(result.error.value).toMatchObject({ status: 410 });
    expect(result.token.value).toBe("tok1");

    await result.submit({ username: "a" });
    await flushPromises();
    expect(result.token.value).toBe("fresh");
  });

  it("stays undefined with cookie transport (the cookie is the token)", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    const { calls } = mockFetch([
      mockInputRequired(LoginForm, { token: "in-body" }),
      mockFinished(),
    ]);

    const { result } = mountComposable({
      path: "/api/wf",
      name: "users/invite",
      tokenTransport: "cookie",
      initialToken: "link",
    });
    expect(result.token.value).toBeUndefined();
    await flushPromises();
    // The link token still rides the start request, once.
    expect(calls[0]!.body).toEqual({ wfid: "users/invite", wfs: "link" });
    expect(result.token.value).toBeUndefined();

    await result.submit({ username: "a" });
    await flushPromises();
    expect(calls[1]!.body).not.toHaveProperty("wfs");
    expect(result.token.value).toBeUndefined();
  });

  it("start() after an out-of-band outlet pause begins a new run", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    const { calls } = mockFetch([
      mockInputRequired(LoginForm, { token: "tok1" }),
      { sent: true, outlet: "email" },
      mockInputRequired(LoginForm, { token: "tok2" }),
    ]);

    const { result } = mountComposable({ path: "/api/wf", name: "users/invite" });
    await flushPromises();
    await result.submit({ username: "a" });
    await flushPromises();
    await result.start();
    await flushPromises();

    expect(calls[2]!.body).toEqual({ wfid: "users/invite" });
  });

  // Why: start() put the link token back, so a start() during or after the run
  // resent a link the server had rotated away, and `token` reported that dead link.
  it("the link token is used up once answered: start() mid-run resumes the current pause", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    const { calls } = mockFetch([
      mockInputRequired(LoginForm, { token: "link" }),
      mockInputRequired(LoginForm, { token: "rotated" }),
      mockInputRequired(LoginForm, { token: "rotated" }),
    ]);

    const { result } = mountComposable({
      path: "/api/wf",
      name: "users/invite",
      initialToken: "link",
    });
    await flushPromises();
    expect(calls[0]!.body).toEqual({ wfid: "users/invite", wfs: "link" });
    await result.submit({ username: "a" });
    await flushPromises();

    await result.start({ hint: "x" });
    await flushPromises();
    expect(calls[2]!.body).toEqual({
      wfid: "users/invite",
      wfs: "rotated",
      input: { formData: { hint: "x" } },
    });
    expect(result.token.value).toBe("rotated");
  });

  it("the link token is used up once answered: start() after a finish begins a new run", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    const { calls } = mockFetch([
      mockInputRequired(LoginForm, { token: "link" }),
      mockFinished(),
      mockInputRequired(LoginForm, { token: "tok2" }),
    ]);

    const { result } = mountComposable({
      path: "/api/wf",
      name: "users/invite",
      initialToken: "link",
    });
    await flushPromises();
    await result.submit({ username: "a" });
    await flushPromises();

    await result.start();
    await flushPromises();
    expect(calls[2]!.body).toEqual({ wfid: "users/invite" });
    expect(result.token.value).toBe("tok2");
  });

  it("a reactive initialToken that changes value is used by the next start()", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    const { calls } = mockFetch([
      mockInputRequired(LoginForm, { token: "link-1" }),
      mockFinished(),
      mockInputRequired(LoginForm, { token: "link-2" }),
    ]);
    const opts = reactive<UseWfFormOptions>({
      path: "/api/wf",
      name: "users/invite",
      initialToken: "link-1",
    });

    const { result } = mountComposable(opts);
    await flushPromises();
    await result.submit({ username: "a" });
    await flushPromises();

    opts.initialToken = "link-2";
    await result.start();
    await flushPromises();
    expect(calls[2]!.body).toEqual({ wfid: "users/invite", wfs: "link-2" });
    expect(result.token.value).toBe("link-2");
  });

  it("an unanswered start keeps the link token: retry() resends it", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    const bodies: unknown[] = [];
    let i = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(init?.body as string));
        if (i++ === 0) throw new Error("offline");
        return { ok: true, json: async () => mockInputRequired(LoginForm, { token: "link" }) };
      }),
    );

    const { result } = mountComposable({
      path: "/api/wf",
      name: "users/invite",
      initialToken: "link",
    });
    await flushPromises();
    expect(result.error.value).toEqual({ message: "offline" });

    await result.retry();
    await flushPromises();
    expect(bodies[1]).toEqual({ wfid: "users/invite", wfs: "link" });
  });

  it("a network error keeps the token", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    const bodies: unknown[] = [];
    let i = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(init?.body as string));
        if (i++ === 1) throw new Error("offline");
        return { ok: true, json: async () => mockInputRequired(LoginForm, { token: "tok1" }) };
      }),
    );

    const { result } = mountComposable({ path: "/api/wf", name: "auth/login" });
    await flushPromises();
    await result.submit({ username: "a" });
    await flushPromises();
    expect(result.error.value).toEqual({ message: "offline" });
    expect(result.token.value).toBe("tok1");

    await result.retry();
    await flushPromises();
    expect(bodies[2]).toMatchObject({ wfs: "tok1" });
  });

  it("cookie transport: a second start() does not resend the link token", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    const { calls } = mockFetch([mockInputRequired(LoginForm), mockInputRequired(LoginForm)]);

    const { result } = mountComposable({
      path: "/api/wf",
      name: "users/invite",
      tokenTransport: "cookie",
      initialToken: "link",
    });
    await flushPromises();
    expect(calls[0]!.body).toEqual({ wfid: "users/invite", wfs: "link" });

    await result.start();
    await flushPromises();
    expect(calls[1]!.body).toEqual({ wfid: "users/invite" });
  });

  describe("query transport", () => {
    afterEach(() => restoreLocation());

    it("is seeded from the URL and follows answers from there", async () => {
      const { LoginForm } = await import("./fixtures/login-form.as");
      stubLocationSearch("?wfs=from-url");
      const { calls } = mockFetch([
        mockInputRequired(LoginForm, { token: "from-url" }),
        mockInputRequired(LoginForm, { token: "rotated" }),
      ]);

      const { result } = mountComposable({
        path: "/api/wf",
        name: "users/invite",
        tokenTransport: "query",
        autoStart: false,
      });
      expect(result.token.value).toBe("from-url");

      await result.start();
      await flushPromises();
      expect(calls[0]!.body).toEqual({ wfid: "users/invite", wfs: "from-url" });
      await result.submit({ username: "a" });
      await flushPromises();
      expect(result.token.value).toBe("rotated");
    });

    it("setup does not read the URL without a window (SSR)", async () => {
      const { renderToString } = await import("vue/server-renderer");
      let result!: UseWfFormReturn;
      const app = createSSRApp(
        defineComponent({
          setup() {
            result = useWfForm({ path: "/api/wf", name: "users/invite", tokenTransport: "query" });
            return () => h("div");
          },
        }),
      );
      vi.stubGlobal("window", undefined);
      try {
        await renderToString(app);
      } finally {
        vi.unstubAllGlobals();
      }
      expect(result.token.value).toBeUndefined();
    });
  });
});

// Why: with cookie transport a start sends `{ wfid }` + the cookie; while another
// request of the run is in flight its state is consumed, the server reads the
// cookie as no token and starts a second run — aborting the fetch doesn't stop it.
describe("useWfForm — a start never races an in-flight request (cookie transport)", () => {
  async function racing(tokenTransport: "body" | "cookie") {
    const { LoginForm } = await import("./fixtures/login-form.as");
    const inits: RequestInit[] = [];
    const settle: Array<() => void> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        inits.push(init);
        const answer = { ok: true, json: async () => mockInputRequired(LoginForm, { token: "t" }) };
        if (inits.length === 1) return Promise.resolve(answer);
        return new Promise((resolve) => settle.push(() => resolve(answer)));
      }),
    );
    const { result } = mountComposable({ path: "/api/wf", name: "auth/login", tokenTransport });
    await flushPromises();
    void result.submit({ username: "a" });
    await flushPromises();
    return { result, inits, settle };
  }

  it("cookie: start() waits for the submit in flight, then goes", async () => {
    const { result, inits, settle } = await racing("cookie");

    const started = result.start();
    await flushPromises();
    expect(inits).toHaveLength(2);
    expect(inits[1]!.signal!.aborted).toBe(false);

    settle[0]!();
    await flushPromises();
    expect(inits).toHaveLength(3);
    expect(JSON.parse(inits[2]!.body as string)).toEqual({ wfid: "auth/login" });
    settle[1]!();
    await started;
  });

  it("cookie: retry() of a start in flight waits for it too", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    const inits: RequestInit[] = [];
    const settle: Array<() => void> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        inits.push(init);
        return new Promise((resolve) =>
          settle.push(() => resolve({ ok: true, json: async () => mockInputRequired(LoginForm) })),
        );
      }),
    );
    const { result } = mountComposable({
      path: "/api/wf",
      name: "auth/login",
      tokenTransport: "cookie",
    });
    await flushPromises();
    expect(inits).toHaveLength(1);

    const retried = result.retry();
    await flushPromises();
    expect(inits).toHaveLength(1);

    settle[0]!();
    await flushPromises();
    expect(inits).toHaveLength(2);
    settle[1]!();
    await retried;
  });

  it("body: start() still aborts the request in flight and goes at once", async () => {
    const { result, inits, settle } = await racing("body");

    const started = result.start();
    await flushPromises();
    expect(inits).toHaveLength(3);
    expect(inits[1]!.signal!.aborted).toBe(true);
    settle[1]!();
    await started;
  });
});
