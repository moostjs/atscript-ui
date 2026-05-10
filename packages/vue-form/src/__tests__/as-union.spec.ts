import { describe, it, expect } from "vitest";
import { nextTick } from "vue";
import { mountForm } from "./helpers";

describe("AsUnion", () => {
  it("required object union shows the field label, not the variant label", async () => {
    const { RequiredObjectUnionForm } = await import("./fixtures/union-forms.as");
    const { wrapper } = mountForm(RequiredObjectUnionForm);
    const titles = wrapper.findAll(".as-collapsible-title").map((t) => t.text());
    expect(titles).toContain("Primary contact");
    expect(titles.some((t) => t === "Email contact")).toBe(false);
  });

  it("renders the variant picker in the collapsible header", async () => {
    const { RequiredObjectUnionForm } = await import("./fixtures/union-forms.as");
    const { wrapper } = mountForm(RequiredObjectUnionForm);
    expect(wrapper.find(".as-variant-trigger").exists()).toBe(true);
  });

  it("clicking a variant in the picker rewrites form data shape", async () => {
    const { RequiredObjectUnionForm } = await import("./fixtures/union-forms.as");
    const { wrapper, formData } = mountForm(RequiredObjectUnionForm);
    expect("email" in (formData.value.primaryContact as object)).toBe(true);
    await wrapper.find(".as-variant-trigger").trigger("click");
    await nextTick();
    const phoneItem = wrapper
      .findAll(".as-dropdown-item")
      .find((b) => b.text().includes("Phone"));
    expect(phoneItem).toBeTruthy();
    await phoneItem!.trigger("click");
    await nextTick();
    expect("phone" in (formData.value.primaryContact as object)).toBe(true);
    expect("email" in (formData.value.primaryContact as object)).toBe(false);
  });

  it("optional object union renders 'Add <Label>' empty placeholder", async () => {
    const { OptionalObjectUnionForm } = await import("./fixtures/union-forms.as");
    const { wrapper, formData } = mountForm(OptionalObjectUnionForm);
    expect(formData.value.backupContact).toBeUndefined();
    const btn = wrapper.find(".as-object-empty-add");
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toContain("Add Backup contact");
  });

  it("multi-variant optional opens the variant menu on placeholder click", async () => {
    const { OptionalObjectUnionForm } = await import("./fixtures/union-forms.as");
    const { wrapper } = mountForm(OptionalObjectUnionForm);
    await wrapper.find(".as-object-empty-add").trigger("click");
    await nextTick();
    const items = wrapper.findAll(".as-dropdown-item");
    expect(items.length).toBe(2);
    expect(items[0]!.text()).toMatch(/Email/);
    expect(items[1]!.text()).toMatch(/Phone/);
  });

  it("picking variant from empty-state menu enables the field", async () => {
    const { OptionalObjectUnionForm } = await import("./fixtures/union-forms.as");
    const { wrapper, formData } = mountForm(OptionalObjectUnionForm);
    await wrapper.find(".as-object-empty-add").trigger("click");
    await nextTick();
    const phoneItem = wrapper
      .findAll(".as-dropdown-item")
      .find((b) => b.text().includes("Phone"));
    expect(phoneItem).toBeTruthy();
    await phoneItem!.trigger("click");
    await nextTick();
    expect("phone" in (formData.value.backupContact as object)).toBe(true);
  });

  it("optional union with null value renders empty-state placeholder, not the picker", async () => {
    // Regression: DB-roundtripped null (SQL NULL) must be treated as "unset",
    // matching undefined. Was broken by `!== undefined` gates in 4 sites.
    const { OptionalObjectUnionForm } = await import("./fixtures/union-forms.as");
    const { wrapper } = mountForm(OptionalObjectUnionForm, {
      initialValue: { backupContact: null },
    });
    await nextTick();
    const btn = wrapper.find(".as-object-empty-add");
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toContain("Add Backup contact");
    expect(wrapper.find(".as-variant-trigger").exists()).toBe(false);
  });

  it("optional with value shows X-icon Unset; clicking it clears the value", async () => {
    const { OptionalObjectUnionForm } = await import("./fixtures/union-forms.as");
    const { wrapper, formData } = mountForm(OptionalObjectUnionForm);
    formData.value.backupContact = { email: "a@b.c", newsletter: false };
    await nextTick();
    const btn = wrapper.find("button.as-field-remove-btn");
    expect(btn.exists()).toBe(true);
    await btn.trigger("click");
    await nextTick();
    expect(formData.value.backupContact).toBeUndefined();
  });

  it("primitive union shows field label and no auto-numbered variant label", async () => {
    const { PrimitiveUnionForm } = await import("./fixtures/union-forms.as");
    const { wrapper } = mountForm(PrimitiveUnionForm);
    // Primitive variants render via AsFieldShell (no AsCollapsible chrome).
    const fieldLabels = wrapper.findAll(".as-field-label").map((l) => l.text());
    expect(fieldLabels).toContain("Quantity or label");
    expect(fieldLabels.some((t) => /^\d\.\s/.test(t))).toBe(false);
  });

  it("does not leak the variant picker onto descendant leaf fields", async () => {
    const { RequiredObjectUnionForm } = await import("./fixtures/union-forms.as");
    const { wrapper } = mountForm(RequiredObjectUnionForm);
    expect(wrapper.findAll(".as-variant-trigger").length).toBe(1);
  });

  it("array of unions renders per-row variant picker", async () => {
    const { UnionArrayForm } = await import("./fixtures/union-forms.as");
    const { wrapper, formData } = mountForm(UnionArrayForm);
    await wrapper.find(".as-array-add-btn").trigger("click");
    await nextTick();
    const addItems = wrapper.findAll(".as-dropdown-item");
    expect(addItems.length).toBeGreaterThanOrEqual(2);
    await addItems[0]!.trigger("click");
    await nextTick();
    await wrapper.find(".as-array-add-btn").trigger("click");
    await nextTick();
    const addItems2 = wrapper.findAll(".as-dropdown-item");
    await addItems2[1]!.trigger("click");
    await nextTick();
    expect((formData.value.log as unknown[]).length).toBe(2);
    expect(wrapper.findAll(".as-variant-trigger").length).toBe(2);
  });

  it("variant trigger label drops the auto-numbered prefix", async () => {
    const { RequiredObjectUnionForm } = await import("./fixtures/union-forms.as");
    const { wrapper } = mountForm(RequiredObjectUnionForm);
    const trigger = wrapper.find(".as-variant-trigger");
    expect(trigger.text()).toBe("Email contact");
    expect(trigger.text()).not.toMatch(/^\d+\.\s/);
    // Dropdown items keep the numbered list affordance.
    await trigger.trigger("click");
    await nextTick();
    const items = wrapper.findAll(".as-dropdown-item");
    expect(items[0]!.text()).toMatch(/^1\.\s/);
    expect(items[1]!.text()).toMatch(/^2\.\s/);
  });

  it("prefilled discriminated value lands on the matching variant", async () => {
    const { UnionArrayForm } = await import("./fixtures/union-forms.as");
    // `LogoutEvent` is the second variant in `LoginEvent | LogoutEvent`.
    // The discriminator fast-path must pick index 1 from `type: 'logout'`
    // without scanning every variant's validator.
    const { wrapper } = mountForm(UnionArrayForm, {
      initialValue: { log: [{ type: "logout", user: "alice" }] },
    });
    await nextTick();
    const triggers = wrapper.findAll(".as-variant-trigger");
    expect(triggers.length).toBe(1);
    expect(triggers[0]!.text()).toBe("Logout event");
  });
});
