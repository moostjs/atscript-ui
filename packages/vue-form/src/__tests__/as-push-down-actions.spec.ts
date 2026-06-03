import { describe, it, expect } from "vitest";
import { nextTick } from "vue";
import { mountForm } from "./helpers";

describe("@ui.form.pushDown + alt-action text/align", () => {
  it("renders a pushed-down action below the submit button, not in the main grid", async () => {
    const { SignUpForm } = await import("./fixtures/push-down-actions.as");
    const { wrapper } = mountForm(SignUpForm);

    const action = wrapper.find(".as-action-field");
    expect(action.exists()).toBe(true);

    const html = wrapper.html();
    const submitIdx = html.indexOf("as-submit-btn");
    const actionIdx = html.indexOf("as-action-field");
    expect(submitIdx).toBeGreaterThan(-1);
    // The action markup appears AFTER the submit button in document order.
    expect(actionIdx).toBeGreaterThan(submitIdx);

    // The pushed-down action lives in its own grid, which is a direct child of
    // <form> after submit — never inside the main (above-submit) field grid.
    const grids = wrapper.findAll("form > .as-form-grid");
    expect(grids.length).toBe(2);
    expect(grids[0]!.find(".as-action-field").exists()).toBe(false);
    expect(grids[1]!.find(".as-action-field").exists()).toBe(true);
  });

  it("renders the @ui.form.attr 'text' prefix before the action link", async () => {
    const { SignUpForm } = await import("./fixtures/push-down-actions.as");
    const { wrapper } = mountForm(SignUpForm);

    const text = wrapper.find(".as-action-text");
    expect(text.exists()).toBe(true);
    expect(text.text()).toBe("Already have an account?");

    const link = wrapper.find(".as-action-field button");
    expect(link.text()).toBe("Sign in");
  });

  it("applies the @ui.form.attr 'align' class to the action field", async () => {
    const { SignUpForm } = await import("./fixtures/push-down-actions.as");
    const { wrapper } = mountForm(SignUpForm);

    const field = wrapper.find(".as-action-field");
    expect(field.exists()).toBe(true);
    expect(field.classes()).toContain("as-action-center");
  });

  it("styles the link on the button itself (hover stays scoped to the link)", async () => {
    const { SignUpForm } = await import("./fixtures/push-down-actions.as");
    const { wrapper } = mountForm(SignUpForm);

    // The link class lives on the <button>, not the row — so :hover binds to
    // the button alone rather than the whole action field.
    const link = wrapper.find(".as-action-field button");
    expect(link.classes()).toContain("as-field-action-link");
  });

  it("emits the action id on click", async () => {
    const { SignUpForm } = await import("./fixtures/push-down-actions.as");
    const { wrapper } = mountForm(SignUpForm);

    await wrapper.find(".as-action-field button").trigger("click");
    await nextTick();

    const actionEvents = wrapper.emitted("action");
    expect(actionEvents).toBeTruthy();
    expect(actionEvents![0]![0]).toBe("signin");
  });

  it("defaults a plain action (no pushDown) to the main grid, left-aligned, no prefix", async () => {
    const { PlainActionForm } = await import("./fixtures/push-down-actions.as");
    const { wrapper } = mountForm(PlainActionForm);

    // Only one grid: the action stays above submit.
    const grids = wrapper.findAll("form > .as-form-grid");
    expect(grids.length).toBe(1);
    expect(grids[0]!.find(".as-action-field").exists()).toBe(true);

    expect(wrapper.find(".as-action-text").exists()).toBe(false);
    expect(wrapper.find(".as-action-field").classes()).toContain("as-action-left");

    const html = wrapper.html();
    expect(html.indexOf("as-action-field")).toBeLessThan(html.indexOf("as-submit-btn"));
  });
});
