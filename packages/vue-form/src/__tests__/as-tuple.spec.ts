import { describe, it, expect } from "vitest";
import { nextTick } from "vue";
import { mountForm } from "./helpers";

describe("AsTuple", () => {
  it("required tuple auto-fills missing positions on mount", async () => {
    const { RequiredTupleForm } = await import("./fixtures/array-forms.as");
    const { formData } = mountForm(RequiredTupleForm);
    expect(Array.isArray(formData.value.coords)).toBe(true);
    expect(formData.value.coords.length).toBe(2);
  });

  it("renders one input per position; no add or remove buttons", async () => {
    const { RequiredTupleForm } = await import("./fixtures/array-forms.as");
    const { wrapper } = mountForm(RequiredTupleForm);
    expect(wrapper.findAll("input").length).toBe(2);
    expect(wrapper.find(".as-array-add-btn").exists()).toBe(false);
    expect(wrapper.findAll(".as-field-remove-btn").length).toBe(0);
  });

  it("does not render the items chip", async () => {
    const { RequiredTupleForm } = await import("./fixtures/array-forms.as");
    const { wrapper } = mountForm(RequiredTupleForm);
    expect(wrapper.find(".as-array-items-chip").exists()).toBe(false);
  });

  it("required tuple does not render Clear or Unset action", async () => {
    const { RequiredTupleForm } = await import("./fixtures/array-forms.as");
    const { wrapper } = mountForm(RequiredTupleForm);
    expect(wrapper.find(".as-optional-clear").exists()).toBe(false);
    expect(wrapper.find("button.as-field-remove-btn").exists()).toBe(false);
  });

  it("optional tuple starts undefined and shows the empty placeholder", async () => {
    const { OptionalTupleForm } = await import("./fixtures/array-forms.as");
    const { wrapper, formData } = mountForm(OptionalTupleForm);
    expect(formData.value.coords).toBeUndefined();
    const emptyBtn = wrapper.find(".as-object-empty-add");
    expect(emptyBtn.exists()).toBe(true);
    expect(emptyBtn.text()).toContain("Add Coordinates");
  });

  it("clicking empty placeholder enables and fills all positions", async () => {
    const { OptionalTupleForm } = await import("./fixtures/array-forms.as");
    const { wrapper, formData } = mountForm(OptionalTupleForm);
    await wrapper.find(".as-object-empty-add").trigger("click");
    await nextTick();
    expect(Array.isArray(formData.value.coords)).toBe(true);
    expect(formData.value.coords.length).toBe(2);
    expect(wrapper.findAll("input").length).toBe(2);
  });

  it("optional tuple with values renders X-icon Unset action", async () => {
    const { OptionalTupleForm } = await import("./fixtures/array-forms.as");
    const { wrapper, formData } = mountForm(OptionalTupleForm);
    formData.value.coords = [1, 2];
    await nextTick();
    const btn = wrapper.find("button.as-field-remove-btn");
    expect(btn.exists()).toBe(true);
    expect(btn.attributes("aria-label")).toBe("Unset Coordinates");
    expect(btn.find(".as-field-remove-btn-icon").exists()).toBe(true);
  });

  it("clicking Unset on optional tuple sets value to undefined", async () => {
    const { OptionalTupleForm } = await import("./fixtures/array-forms.as");
    const { wrapper, formData } = mountForm(OptionalTupleForm);
    formData.value.coords = [1, 2];
    await nextTick();
    await wrapper.find("button.as-field-remove-btn").trigger("click");
    await nextTick();
    expect(formData.value.coords).toBeUndefined();
  });

  it("renders position labels — meta.label when set, muted #N otherwise", async () => {
    const { LabeledTupleForm } = await import("./fixtures/array-forms.as");
    const { wrapper } = mountForm(LabeledTupleForm);
    const labels = wrapper.findAll(".as-field-label");
    const labelTexts = labels.map((l) => l.text());
    expect(labelTexts.some((t) => t.includes("Latitude"))).toBe(true);
    expect(labelTexts.some((t) => t.includes("Longitude"))).toBe(true);
    // Labeled positions render only the meta.label — no muted `#N` suffix.
    for (const label of labels) {
      expect(label.find(".as-field-label-index").exists()).toBe(false);
    }
  });

  it("falls back to muted #N suffix labels when positions have no @meta.label", async () => {
    const { RequiredTupleForm } = await import("./fixtures/array-forms.as");
    const { wrapper } = mountForm(RequiredTupleForm);
    const indexSuffixes = wrapper.findAll(".as-field-label-index");
    const suffixTexts = indexSuffixes.map((s) => s.text());
    expect(suffixTexts.some((t) => t.includes("#1"))).toBe(true);
    expect(suffixTexts.some((t) => t.includes("#2"))).toBe(true);
  });

  // Tuple element labels for unlabeled positions fall back to the capitalized
  // type name (`number` → `Number`) so the bold base label is non-empty.
  // Before the fix the label was empty and only the muted `#N` suffix showed.
  it("unlabeled tuple positions render the type name as the bold base label", async () => {
    const { RequiredTupleForm } = await import("./fixtures/array-forms.as");
    const { wrapper } = mountForm(RequiredTupleForm);
    const labels = wrapper.findAll(".as-field-label");
    expect(labels.length).toBe(2);
    // The label element contains the bold base text directly + a child span
    // with the muted `#N` suffix. Strip the suffix span to read the base.
    const baseTexts = labels.map((l) => {
      const suffix = l.find(".as-field-label-index");
      return suffix.exists() ? l.text().replace(suffix.text(), "").trim() : l.text().trim();
    });
    expect(baseTexts).toEqual(["Number", "Number"]);
  });
});
