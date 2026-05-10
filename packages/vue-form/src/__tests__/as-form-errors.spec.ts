import { describe, it, expect } from "vitest";
import { nextTick } from "vue";
import { mountForm, objectType, stringProp } from "./helpers";

describe("AsForm — external error auto-dismissal", () => {
  it("renders an external leaf error on mount", () => {
    const type = objectType({ name: stringProp() });
    const { wrapper } = mountForm(type, {
      errors: { name: "Server: name already taken" },
    });
    const slot = wrapper.find(".as-error-slot");
    expect(slot.exists()).toBe(true);
    expect(slot.text()).toBe("Server: name already taken");
  });

  it("dismisses the leaf error locally when its value changes", async () => {
    const type = objectType({ name: stringProp() });
    const { wrapper } = mountForm(type, {
      errors: { name: "Server: name already taken" },
    });
    expect(wrapper.find(".as-error-slot").text()).toBe("Server: name already taken");

    // Simulate a leaf edit: input alone (no blur) must trigger dismissal,
    // because AsField now watches `model.value` and calls
    // `dismissExternalAt(path)` on every keystroke.
    const input = wrapper.find("input");
    await input.setValue("Bob");
    await nextTick();

    expect(wrapper.find(".as-error-slot").exists()).toBe(false);
  });

  it("dismisses leaf error on every keystroke before blur", async () => {
    const type = objectType({ name: stringProp() });
    const { wrapper } = mountForm(type, {
      errors: { name: "Already used" },
    });
    expect(wrapper.find(".as-error-slot").text()).toBe("Already used");

    const input = wrapper.find("input");
    // First keystroke (no blur): error must already be gone.
    await input.setValue("a");
    await nextTick();
    expect(wrapper.find(".as-error-slot").exists()).toBe(false);

    // Subsequent keystrokes keep the error gone (no blur in between).
    await input.setValue("ab");
    await nextTick();
    expect(wrapper.find(".as-error-slot").exists()).toBe(false);
  });

  it("re-arms the leaf error when a fresh `errors` prop arrives", async () => {
    const type = objectType({ name: stringProp() });
    const { wrapper } = mountForm(type, {
      errors: { name: "Server: name already taken" },
    });

    // First, dismiss it via a leaf edit (no blur required).
    const input = wrapper.find("input");
    await input.setValue("Bob");
    await nextTick();
    expect(wrapper.find(".as-error-slot").exists()).toBe(false);

    // Server round-trip: a fresh errors map (new identity) re-arms the error.
    await wrapper.setProps({ errors: { name: "Server: still invalid" } });

    const slot = wrapper.find(".as-error-slot");
    expect(slot.exists()).toBe(true);
    expect(slot.text()).toBe("Server: still invalid");
  });

  it("does not dismiss `__form` (form-level) errors on leaf edits", async () => {
    const type = objectType({ name: stringProp() });
    const { wrapper } = mountForm(type, {
      errors: { __form: "Account is suspended" },
    });
    const banner = wrapper.find('[role="alert"].as-form-error');
    expect(banner.exists()).toBe(true);
    expect(banner.find(".as-form-error-message").text()).toBe("Account is suspended");

    // Edit a leaf field — the form-level banner must stay. Per-keystroke
    // dismissal is leaf-only; `__form` is sticky.
    const input = wrapper.find("input");
    await input.setValue("Bob");
    await nextTick();

    const bannerAfter = wrapper.find('[role="alert"].as-form-error');
    expect(bannerAfter.exists()).toBe(true);
    expect(bannerAfter.find(".as-form-error-message").text()).toBe("Account is suspended");
  });

  it("does not dismiss sibling leaf errors when an unrelated field changes", async () => {
    const type = objectType({
      name: stringProp(),
      email: stringProp(),
    });
    const { wrapper } = mountForm(type, {
      errors: { name: "Bad name", email: "Bad email" },
    });

    // Edit only `name` — `email`'s external error must remain. No blur
    // needed: the model watcher dismisses on input.
    const inputs = wrapper.findAll("input");
    await inputs[0]!.setValue("Bob");
    await nextTick();

    const slots = wrapper.findAll(".as-error-slot");
    const slotTexts = slots.map((s) => s.text());
    expect(slotTexts).toContain("Bad email");
    expect(slotTexts).not.toContain("Bad name");
  });
});

describe("AsForm — `__form` dismissable banner", () => {
  it("renders the dismissable banner with a close button when `__form` is set", () => {
    const type = objectType({ name: stringProp() });
    const { wrapper } = mountForm(type, {
      errors: { __form: "Account is suspended" },
    });
    const banner = wrapper.find('[role="alert"].as-form-error');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain("Account is suspended");
    const dismissBtn = banner.find("button.as-form-error-dismiss");
    expect(dismissBtn.exists()).toBe(true);
    expect(dismissBtn.text()).toBe("Dismiss");
  });

  it("hides the banner when the dismiss button is clicked", async () => {
    const type = objectType({ name: stringProp() });
    const { wrapper } = mountForm(type, {
      errors: { __form: "Account is suspended" },
    });
    expect(wrapper.find('[role="alert"].as-form-error').exists()).toBe(true);

    await wrapper.find("button.as-form-error-dismiss").trigger("click");
    await nextTick();

    expect(wrapper.find('[role="alert"].as-form-error').exists()).toBe(false);
  });

  it("re-renders the banner when a fresh `errors` prop arrives after dismissal", async () => {
    const type = objectType({ name: stringProp() });
    const { wrapper } = mountForm(type, {
      errors: { __form: "Account is suspended" },
    });

    // Dismiss it first.
    await wrapper.find("button.as-form-error-dismiss").trigger("click");
    await nextTick();
    expect(wrapper.find('[role="alert"].as-form-error').exists()).toBe(false);

    // Server round-trip: a fresh errors map (new identity) re-arms the banner.
    await wrapper.setProps({ errors: { __form: "Still suspended" } });

    const banner = wrapper.find('[role="alert"].as-form-error');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain("Still suspended");
  });

  it("does not dismiss the `__form` banner on field edits (sticky)", async () => {
    const type = objectType({ name: stringProp() });
    const { wrapper } = mountForm(type, {
      errors: { __form: "Account is suspended" },
    });
    expect(wrapper.find('[role="alert"].as-form-error').exists()).toBe(true);

    // Edit a leaf field — the form-level banner must stay (Phase A's
    // leaf-only dismissal must not regress to clear `__form`).
    const input = wrapper.find("input");
    await input.setValue("Bob");
    await nextTick();

    const banner = wrapper.find('[role="alert"].as-form-error');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain("Account is suspended");
  });
});
