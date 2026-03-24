import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { useWfForm } from "../use-wf-form";
import type { UseWfFormOptions, UseWfFormReturn } from "../use-wf-form";
import { mockFetch, mockFetchError, mockInputRequired, mockFinished, mockError } from "./helpers";

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

    expect(calls[0]!.body).toEqual({ wfid: "auth/login", input: { hint: "prefill" } });
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
      input: { username: "alice", password: "secret" },
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

    expect(calls[1]!.body).toEqual({ wfs: "tok1", action: "resend" });
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
      input: { username: "alice" },
      action: "saveDraft",
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

    expect(result.error.value).toEqual({ message: "Workflow not found", status: 404 });
    expect(result.formDef.value).toBeNull();
  });

  it("handles HTTP error (non-ok response)", async () => {
    mockFetchError(500, "Internal Server Error");

    const { result } = mountComposable({ path: "/api/wf", name: "test" });
    await flushPromises();

    expect(result.error.value).toEqual({ message: "Internal Server Error", status: 500 });
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
});
