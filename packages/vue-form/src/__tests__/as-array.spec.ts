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

    const removeBtns = wrapper.findAll(".as-array-remove-btn");
    expect(removeBtns.length).toBe(2);
  });

  it("clicking remove button removes the item", async () => {
    const type = objectType({
      items: arrayType(stringProp()),
    });
    const { wrapper, formData } = mountForm(type);

    formData.value.items = ["a", "b", "c"];
    await nextTick();

    const removeBtns = wrapper.findAll(".as-array-remove-btn");
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

    const removeBtns = wrapper.findAll(".as-array-remove-btn");
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

  it("Clear button visible text is just 'Clear' (aria-label includes label)", async () => {
    const type = objectType({
      items: arrayType(stringProp(), { "meta.label": "Tags" }),
    });
    const { wrapper, formData } = mountForm(type);
    formData.value.items = ["a"];
    await nextTick();
    const clearBtn = wrapper.find(".as-array-clear-btn");
    expect(clearBtn.text()).toBe("Clear");
    expect(clearBtn.attributes("aria-label")).toBe("Clear Tags");
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

    const clearBtn = wrapper.find(".as-array-clear-btn");
    expect(clearBtn.exists()).toBe(true);
    await clearBtn.trigger("click");
    await nextTick();

    expect(Array.isArray(formData.value.items)).toBe(true);
    expect(formData.value.items.length).toBe(0);
  });

  it("Clear is disabled when array is empty", () => {
    const type = objectType({
      items: arrayType(stringProp()),
    });
    const { wrapper } = mountForm(type);
    const clearBtn = wrapper.find(".as-array-clear-btn");
    expect(clearBtn.attributes("disabled")).toBeDefined();
  });

  it("required+empty array renders open with no rows and only Add visible", async () => {
    const type = objectType({
      items: arrayType(stringProp()),
    });
    const { wrapper } = mountForm(type);
    await nextTick();

    expect(wrapper.findAll(".as-array-row-bare").length).toBe(0);
    expect(wrapper.findAll(".as-array-row-island").length).toBe(0);
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
});
