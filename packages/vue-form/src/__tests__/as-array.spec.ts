import { describe, it, expect } from "vitest";
import { nextTick } from "vue";
import { mountForm, objectType, arrayType, stringProp } from "./helpers";

describe("AsArray", () => {
  it("renders add button", () => {
    const type = objectType({
      items: arrayType(stringProp()),
    });
    const { wrapper } = mountForm(type);
    const addBtn = wrapper.find(".as-array-add-btn");
    expect(addBtn.exists()).toBe(true);
    expect(addBtn.text()).toBe("Add item");
  });

  it("clicking add button adds an item", async () => {
    const type = objectType({
      items: arrayType(stringProp()),
    });
    const { wrapper, formData } = mountForm(type);

    const addBtn = wrapper.find(".as-array-add-btn");
    await addBtn.trigger("click");
    await nextTick();

    expect(formData.value.items.length).toBe(1);
  });

  it("renders remove button per item", async () => {
    const type = objectType({
      items: arrayType(stringProp()),
    });
    const { wrapper, formData } = mountForm(type);

    formData.value.items = ["a", "b"];
    await nextTick();

    const removeBtns = wrapper.findAll(".as-field-remove-btn");
    expect(removeBtns.length).toBe(2);
  });

  it("clicking remove button removes the item", async () => {
    const type = objectType({
      items: arrayType(stringProp()),
    });
    const { wrapper, formData } = mountForm(type);

    formData.value.items = ["a", "b", "c"];
    await nextTick();

    const removeBtns = wrapper.findAll(".as-field-remove-btn");
    expect(removeBtns.length).toBe(3);

    await removeBtns[1]!.trigger("click");
    await nextTick();

    expect(formData.value.items.length).toBe(2);
    expect(formData.value.items).toEqual(["a", "c"]);
  });

  it("disables add button when at maxLength", async () => {
    const { MaxLengthArrayForm } = await import("./fixtures/array-forms.as");
    const { wrapper, formData } = mountForm(MaxLengthArrayForm);

    formData.value.items = ["a", "b"];
    await nextTick();

    const addBtn = wrapper.find(".as-array-add-btn");
    expect(addBtn.attributes("disabled")).toBeDefined();
  });

  it("disables remove buttons when at minLength", async () => {
    const { MinLengthArrayForm } = await import("./fixtures/array-forms.as");
    const { wrapper, formData } = mountForm(MinLengthArrayForm);

    formData.value.items = ["a", "b"];
    await nextTick();

    const removeBtns = wrapper.findAll(".as-field-remove-btn");
    expect(removeBtns.length).toBe(2);
    for (const btn of removeBtns) {
      expect(btn.attributes("disabled")).toBeDefined();
    }
  });

  it("Add button uses singular from @ui.form.label.singular", async () => {
    const { SingularLabelArray } = await import("./fixtures/array-forms.as");
    const { wrapper } = mountForm(SingularLabelArray);
    const addBtn = wrapper.find(".as-array-add-btn");
    expect(addBtn.text()).toBe("Add tag");
  });

  it("optional empty placeholder reads 'Add <label>' (uses @meta.label, not singular)", async () => {
    const { OptionalLabelArrayForm } = await import("./fixtures/array-forms.as");
    const { wrapper } = mountForm(OptionalLabelArrayForm);
    await nextTick();
    // Optional + undefined → AsCollapsible #empty slot → mirrors AsObject's
    // dashed-island placeholder. Label uses @meta.label, never the singular.
    const emptyBtn = wrapper.find(".as-object-empty-add");
    expect(emptyBtn.exists()).toBe(true);
    expect(emptyBtn.text()).toBe("Add Tags");
  });

  it("required-array Clear reads 'Clear' (length 0 semantics)", async () => {
    const type = objectType({
      items: arrayType(stringProp(), { "meta.label": "Tags" }),
    });
    const { wrapper, formData } = mountForm(type);
    formData.value.items = ["a"];
    await nextTick();
    const clearBtn = wrapper.find(".as-optional-clear");
    expect(clearBtn.text()).toBe("Clear");
    expect(clearBtn.attributes("aria-label")).toBe("Clear Tags");
  });

  it("optional-array Clear renders X-icon button (Unset semantics)", async () => {
    const { OptionalLabelArrayForm } = await import("./fixtures/array-forms.as");
    const { wrapper, formData } = mountForm(OptionalLabelArrayForm);
    formData.value.items = ["a"];
    await nextTick();
    const btn = wrapper.find("button.as-field-remove-btn");
    expect(btn.exists()).toBe(true);
    expect(btn.attributes("aria-label")).toBe("Unset Tags");
    expect(btn.find(".as-field-remove-btn-icon").exists()).toBe(true);
  });

  it("items chip shows correct count", async () => {
    const type = objectType({
      items: arrayType(stringProp()),
    });
    const { wrapper, formData } = mountForm(type);

    expect(wrapper.find(".as-array-items-chip").text()).toContain("0 items");

    formData.value.items = ["a", "b", "c"];
    await nextTick();

    expect(wrapper.find(".as-array-items-chip").text()).toContain("3 items");
  });

  it("Clear sets length 0 for required arrays", async () => {
    const type = objectType({
      items: arrayType(stringProp()),
    });
    const { wrapper, formData } = mountForm(type);

    formData.value.items = ["a", "b"];
    await nextTick();

    const clearBtn = wrapper.find(".as-optional-clear");
    expect(clearBtn.exists()).toBe(true);
    await clearBtn.trigger("click");
    await nextTick();

    expect(Array.isArray(formData.value.items)).toBe(true);
    expect(formData.value.items.length).toBe(0);
  });

  it("Clear is not rendered when array is empty", () => {
    const type = objectType({
      items: arrayType(stringProp()),
    });
    const { wrapper } = mountForm(type);
    expect(wrapper.find(".as-optional-clear").exists()).toBe(false);
  });

  it("required+empty array renders open with no rows and only Add visible", async () => {
    const type = objectType({
      items: arrayType(stringProp()),
    });
    const { wrapper } = mountForm(type);
    await nextTick();

    expect(wrapper.findAll(".as-field-remove-btn").length).toBe(0);
    expect(wrapper.find(".as-array-add-btn").exists()).toBe(true);
    const details = wrapper.find("details");
    expect(details.attributes("open")).toBeDefined();
  });

  it("array validation error displayed on submit", async () => {
    const { RequiredArrayForm } = await import("./fixtures/array-forms.as");
    const { wrapper } = mountForm(RequiredArrayForm);

    await wrapper.find("form").trigger("submit");
    await nextTick();

    const errorEvents = wrapper.emitted("error");
    expect(errorEvents).toBeTruthy();
    expect(errorEvents!.length).toBe(1);
    const errors = errorEvents![0]![0] as { path: string; message: string }[];
    expect(errors.some((e) => e.message === "At least one item required")).toBe(true);
  });

  // After a failed submit, live validation is on form-wide. A newly-added
  // array item must NOT light up its required fields as red — the user
  // hasn't typed yet. Errors should appear only after first edit (per-field)
  // or next submit.
  it("array item added after submit stays clean until edited", async () => {
    const { PhonesArrayForm } = await import("./fixtures/array-forms.as");
    const { wrapper } = mountForm(PhonesArrayForm);

    // Trigger first submit to flip firstSubmitHappened on (form is empty,
    // so this fails on the array minLength rule).
    await wrapper.find("form").trigger("submit");
    await nextTick();

    // Add a fresh phone item.
    await wrapper.find(".as-array-add-btn").trigger("click");
    await nextTick();

    // Two required fields just rendered (label, number) — neither has been
    // touched. Their error slots must stay quiet.
    const alerts = wrapper.findAll(".as-error-slot[role='alert']");
    expect(alerts.length).toBe(0);

    // Editing one field promotes only that field — its sibling stays clean.
    const inputs = wrapper.findAll("input");
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    await inputs[0]!.setValue("a");
    await inputs[0]!.setValue("");
    await nextTick();

    const afterEdit = wrapper.findAll(".as-error-slot[role='alert']");
    expect(afterEdit.length).toBe(1);
  });

  // Blur counts as "the user considered this field" — same promotion as a
  // model edit. Tabbing past a fresh required field reveals its error.
  it("blur on a fresh field promotes it out of freshness", async () => {
    const { PhonesArrayForm } = await import("./fixtures/array-forms.as");
    const { wrapper } = mountForm(PhonesArrayForm);

    await wrapper.find("form").trigger("submit");
    await nextTick();
    await wrapper.find(".as-array-add-btn").trigger("click");
    await nextTick();

    expect(wrapper.findAll(".as-error-slot[role='alert']").length).toBe(0);

    const inputs = wrapper.findAll("input");
    expect(inputs.length).toBeGreaterThanOrEqual(1);
    await inputs[0]!.trigger("blur");
    await nextTick();

    // The blurred field reveals its required-error; siblings remain quiet.
    expect(wrapper.findAll(".as-error-slot[role='alert']").length).toBe(1);
  });

  // Each object item rendered inside an array gets its own AsCollapsible
  // title chip. The bold base label must be the singular (or @meta.label)
  // WITHOUT the `#N` suffix baked in — the muted `.as-collapsible-title-index`
  // span owns that suffix. Before the fix the index was concatenated into
  // both pieces, producing `Phone #1 #1`.
  it("array of objects: collapsible title chip splits base + muted #N (no duplication)", async () => {
    const { PhonesArrayForm } = await import("./fixtures/array-forms.as");
    const { wrapper, formData } = mountForm(PhonesArrayForm);
    formData.value.items = [
      { label: "a", number: "b" },
      { label: "c", number: "d" },
    ];
    await nextTick();
    // Two object items → two nested collapsible titles (each h4 within the
    // array's own collapsible). Filter by the nested title class.
    const titles = wrapper.findAll(".as-collapsible-title-nested");
    expect(titles.length).toBe(2);
    const baseTexts: string[] = [];
    const suffixTexts: string[] = [];
    for (const t of titles) {
      const suffix = t.find(".as-collapsible-title-index");
      expect(suffix.exists()).toBe(true);
      suffixTexts.push(suffix.text().trim());
      baseTexts.push(t.text().replace(suffix.text(), "").trim());
    }
    // Base must equal the singular alone — NO baked-in `#N`.
    expect(baseTexts).toEqual(["Item", "Item"]);
    expect(suffixTexts).toEqual(["#1", "#2"]);
  });

  // Next submit "promotes" every fresh field — they all light up if invalid.
  it("array item gets validated on next submit even without manual edit", async () => {
    const { PhonesArrayForm } = await import("./fixtures/array-forms.as");
    const { wrapper } = mountForm(PhonesArrayForm);

    await wrapper.find("form").trigger("submit");
    await nextTick();
    await wrapper.find(".as-array-add-btn").trigger("click");
    await nextTick();

    // Quiet right after adding (per the test above).
    expect(wrapper.findAll(".as-error-slot[role='alert']").length).toBe(0);

    // Submitting again with the new item still empty surfaces both errors.
    await wrapper.find("form").trigger("submit");
    await nextTick();

    expect(wrapper.findAll(".as-error-slot[role='alert']").length).toBe(2);
  });
});
