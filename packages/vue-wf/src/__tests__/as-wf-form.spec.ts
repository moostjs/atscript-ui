import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import AsWfForm from "../components/as-wf-form.vue";
import { createDefaultTypes } from "@atscript/vue-form";
import { mockFetch, mockInputRequired, mockFinished } from "./helpers";

const types = createDefaultTypes();

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mountAsWfForm(propsOverrides?: Record<string, unknown>) {
  return mount(AsWfForm as any, {
    props: { path: "/api/wf", name: "auth/login", types, ...propsOverrides },
  });
}

describe("AsWfForm", () => {
  it("renders AsForm when inputRequired received", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    mockFetch([mockInputRequired(LoginForm)]);

    const wrapper = mountAsWfForm();
    await flushPromises();

    expect(wrapper.find("form").exists()).toBe(true);
    expect(wrapper.findAll("input").length).toBeGreaterThanOrEqual(2);
  });

  it("passes errors to AsForm", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    mockFetch([mockInputRequired(LoginForm, { errors: { username: "Required" } })]);

    const wrapper = mountAsWfForm();
    await flushPromises();

    expect(wrapper.text()).toContain("Required");
  });

  it("emits finished when workflow completes", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    mockFetch([mockInputRequired(LoginForm), mockFinished({ userId: 42 })]);

    const wrapper = mountAsWfForm();
    await flushPromises();

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    const emitted = wrapper.emitted("finished");
    expect(emitted).toBeTruthy();
    expect(emitted![0]![0]).toMatchObject({ finished: true, userId: 42 });
  });

  it("emits error on server error", async () => {
    mockFetch([{ error: { message: "Not found", status: 404 } }]);

    const wrapper = mountAsWfForm();
    await flushPromises();

    const emitted = wrapper.emitted("error");
    expect(emitted).toBeTruthy();
    expect(emitted![0]![0]).toMatchObject({ message: "Not found" });
  });

  it("emits form event when form schema received", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    mockFetch([mockInputRequired(LoginForm, { context: { hint: "test" } })]);

    const wrapper = mountAsWfForm();
    await flushPromises();

    const emitted = wrapper.emitted("form");
    expect(emitted).toBeTruthy();
    expect(emitted![0]![0]).toHaveProperty("fields");
    expect(emitted![0]![1]).toEqual({ hint: "test" });
  });

  it("emits loading events", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    mockFetch([mockInputRequired(LoginForm)]);

    const wrapper = mountAsWfForm();
    await flushPromises();

    const emitted = wrapper.emitted("loading");
    expect(emitted).toBeTruthy();
    const values = emitted!.map((e) => e[0]);
    expect(values).toContain(true);
    expect(values).toContain(false);
  });

  it("renders default error slot for errors without form", async () => {
    mockFetch([{ error: { message: "Workflow broken" } }]);

    const wrapper = mountAsWfForm();
    await flushPromises();

    expect(wrapper.text()).toContain("Workflow broken");
  });

  it("renders finished slot content", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    mockFetch([mockInputRequired(LoginForm), mockFinished()]);

    const wrapper = mountAsWfForm();
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

    const wrapper = mountAsWfForm();
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

    const wrapper = mountAsWfForm();
    await flushPromises();

    const actionButtons = wrapper.findAll("button[type='button']");
    const resendBtn = actionButtons.find((b) => b.text().includes("Resend"));
    expect(resendBtn).toBeDefined();
    await resendBtn!.trigger("click");
    await flushPromises();

    expect(calls[1]!.body).toHaveProperty("input.action", "resend");
    expect((calls[1]!.body as { input: Record<string, unknown> }).input).not.toHaveProperty(
      "formData",
    );
  });

  it("paints the AsForm loading overlay while a server round-trip is in flight", async () => {
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

    const wrapper = mountAsWfForm();
    await flushPromises();

    // First request settled — form rendered, no overlay.
    expect(wrapper.find("form").exists()).toBe(true);
    expect(wrapper.find(".as-form-overlay").exists()).toBe(false);

    // Submit kicks off the second (pending) request.
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    // Overlay is up while loading and the form is `inert`.
    expect(wrapper.find(".as-form-overlay").exists()).toBe(true);
    expect(wrapper.find("form").attributes("inert")).toBeDefined();

    // Resolve the in-flight request (workflow finishes).
    resolveSecond({ ok: true, json: async () => mockFinished() });
    await flushPromises();

    // Form is gone (replaced by finished slot), so the overlay must also be gone.
    expect(wrapper.find(".as-form-overlay").exists()).toBe(false);
  });

  it("clears the loading overlay after a server response that keeps the form mounted", async () => {
    const { LoginForm } = await import("./fixtures/login-form.as");
    mockFetch([
      mockInputRequired(LoginForm),
      mockInputRequired(LoginForm, { errors: { username: "Required" } }),
    ]);

    const wrapper = mountAsWfForm();
    await flushPromises();
    expect(wrapper.find(".as-form-overlay").exists()).toBe(false);

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    // Second response landed — same form, new errors. Overlay must be down.
    expect(wrapper.find("form").exists()).toBe(true);
    expect(wrapper.find(".as-form-overlay").exists()).toBe(false);
    expect(wrapper.find("form").attributes("inert")).toBeUndefined();
  });

  it("classifies @wf.action.withData as data action", async () => {
    const { DataActionForm } = await import("./fixtures/action-form.as");

    const { calls } = mockFetch([
      mockInputRequired(DataActionForm, { token: "tok1" }),
      mockInputRequired(DataActionForm, { token: "tok2" }),
    ]);

    const wrapper = mountAsWfForm();
    await flushPromises();

    const actionButtons = wrapper.findAll("button[type='button']");
    const saveBtn = actionButtons.find((b) => b.text().includes("Save Draft"));
    expect(saveBtn).toBeDefined();
    await saveBtn!.trigger("click");
    await flushPromises();

    expect(calls[1]!.body).toHaveProperty("input.action", "saveDraft");
    expect(calls[1]!.body).toHaveProperty("input.formData");
  });

  it("exposes action() that fires a stateless action without formData", async () => {
    const { ActionForm } = await import("./fixtures/action-form.as");

    const { calls } = mockFetch([
      mockInputRequired(ActionForm, { token: "tok1" }),
      mockInputRequired(ActionForm, { token: "tok2" }),
    ]);

    const wrapper = mountAsWfForm();
    await flushPromises();

    // Host-fired via the defineExpose surface (no data passed).
    (wrapper.vm as any).action("resend");
    await flushPromises();

    expect(calls[1]!.body).toHaveProperty("input.action", "resend");
    expect((calls[1]!.body as { input: Record<string, unknown> }).input).not.toHaveProperty(
      "formData",
    );
  });

  it("exposes action() that routes a withData action through actionWithData", async () => {
    const { DataActionForm } = await import("./fixtures/action-form.as");

    const { calls } = mockFetch([
      mockInputRequired(DataActionForm, { token: "tok1" }),
      mockInputRequired(DataActionForm, { token: "tok2" }),
    ]);

    const wrapper = mountAsWfForm();
    await flushPromises();

    // Host passes data — classifier must send it as formData.
    (wrapper.vm as any).action("saveDraft", { draft: 1 });
    await flushPromises();

    expect(calls[1]!.body).toHaveProperty("input.action", "saveDraft");
    expect(calls[1]!.body).toHaveProperty("input.formData");
  });

  it("exposes supportsAction reflecting declared action ids", async () => {
    const { ActionForm } = await import("./fixtures/action-form.as");
    mockFetch([mockInputRequired(ActionForm)]);

    const wrapper = mountAsWfForm();
    await flushPromises();

    // Gating signal is the declared action id, not the field name.
    expect((wrapper.vm as any).supportsAction("resend")).toBe(true);
    expect((wrapper.vm as any).supportsAction("nope")).toBe(false);
  });
});
