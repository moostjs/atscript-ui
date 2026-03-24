import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import WfForm from "../wf-form.vue";
import { createDefaultTypes } from "@atscript/vue-form";
import { mockFetch, mockInputRequired, mockFinished } from "./helpers";

const types = createDefaultTypes();

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mountWfForm(propsOverrides?: Record<string, unknown>) {
  return mount(WfForm as any, {
    props: { path: "/api/wf", name: "auth/login", types, ...propsOverrides },
  });
}

describe("WfForm", () => {
  it("renders AsForm when inputRequired received", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    mockFetch([mockInputRequired(LoginForm)]);

    const wrapper = mountWfForm();
    await flushPromises();

    expect(wrapper.find("form").exists()).toBe(true);
    expect(wrapper.findAll("input").length).toBeGreaterThanOrEqual(2);
  });

  it("passes errors to AsForm", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    mockFetch([mockInputRequired(LoginForm, { errors: { username: "Required" } })]);

    const wrapper = mountWfForm();
    await flushPromises();

    expect(wrapper.text()).toContain("Required");
  });

  it("emits finished when workflow completes", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    mockFetch([mockInputRequired(LoginForm), mockFinished({ userId: 42 })]);

    const wrapper = mountWfForm();
    await flushPromises();

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    const emitted = wrapper.emitted("finished");
    expect(emitted).toBeTruthy();
    expect(emitted![0]![0]).toMatchObject({ finished: true, userId: 42 });
  });

  it("emits error on server error", async () => {
    mockFetch([{ error: { message: "Not found", status: 404 } }]);

    const wrapper = mountWfForm();
    await flushPromises();

    const emitted = wrapper.emitted("error");
    expect(emitted).toBeTruthy();
    expect(emitted![0]![0]).toMatchObject({ message: "Not found" });
  });

  it("emits form event when form schema received", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    mockFetch([mockInputRequired(LoginForm, { context: { hint: "test" } })]);

    const wrapper = mountWfForm();
    await flushPromises();

    const emitted = wrapper.emitted("form");
    expect(emitted).toBeTruthy();
    expect(emitted![0]![0]).toHaveProperty("fields");
    expect(emitted![0]![1]).toEqual({ hint: "test" });
  });

  it("emits loading events", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    mockFetch([mockInputRequired(LoginForm)]);

    const wrapper = mountWfForm();
    await flushPromises();

    const emitted = wrapper.emitted("loading");
    expect(emitted).toBeTruthy();
    const values = emitted!.map((e) => e[0]);
    expect(values).toContain(true);
    expect(values).toContain(false);
  });

  it("renders default error slot for errors without form", async () => {
    mockFetch([{ error: { message: "Workflow broken" } }]);

    const wrapper = mountWfForm();
    await flushPromises();

    expect(wrapper.text()).toContain("Workflow broken");
  });

  it("renders finished slot content", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    mockFetch([mockInputRequired(LoginForm), mockFinished()]);

    const wrapper = mountWfForm();
    await flushPromises();

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.find("form").exists()).toBe(false);
  });

  it("submit button disables during loading (default slot)", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    let resolveSecond!: (v: unknown) => void;
    let callCount = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          return { ok: true, json: async () => mockInputRequired(LoginForm) };
        }
        return new Promise((resolve) => {
          resolveSecond = resolve;
        });
      }),
    );

    const wrapper = mountWfForm();
    await flushPromises();

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    const button = wrapper.find("form > button:last-of-type");
    expect(button.exists()).toBe(true);
    expect(button.attributes("disabled")).toBeDefined();

    resolveSecond({ ok: true, json: async () => mockFinished() });
    await flushPromises();
  });

  it("classifies @ui.form.action as stateless (no data sent)", async () => {
    const { ActionForm } = await import("./fixtures/action-form.as");

    const { calls } = mockFetch([
      mockInputRequired(ActionForm, { token: "tok1" }),
      mockInputRequired(ActionForm, { token: "tok2" }),
    ]);

    const wrapper = mountWfForm();
    await flushPromises();

    const actionButtons = wrapper.findAll("button[type='button']");
    const resendBtn = actionButtons.find((b) => b.text().includes("Resend"));
    expect(resendBtn).toBeDefined();
    await resendBtn!.trigger("click");
    await flushPromises();

    expect(calls[1]!.body).toHaveProperty("action", "resend");
    expect(calls[1]!.body).not.toHaveProperty("input");
  });

  it("classifies @wf.action.withData as data action", async () => {
    const { DataActionForm } = await import("./fixtures/action-form.as");

    const { calls } = mockFetch([
      mockInputRequired(DataActionForm, { token: "tok1" }),
      mockInputRequired(DataActionForm, { token: "tok2" }),
    ]);

    const wrapper = mountWfForm();
    await flushPromises();

    const actionButtons = wrapper.findAll("button[type='button']");
    const saveBtn = actionButtons.find((b) => b.text().includes("Save Draft"));
    expect(saveBtn).toBeDefined();
    await saveBtn!.trigger("click");
    await flushPromises();

    expect(calls[1]!.body).toHaveProperty("action", "saveDraft");
    expect(calls[1]!.body).toHaveProperty("input");
  });
});
