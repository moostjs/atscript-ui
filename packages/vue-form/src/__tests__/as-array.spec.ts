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

    // Add two items
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

    // Add items via mutation
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

  it("custom add label from @ui.array.add.label annotation", async () => {
    const { CustomAddLabelArray } = await import("./fixtures/array-forms.as");
    const { wrapper } = mountForm(CustomAddLabelArray);
    const addBtn = wrapper.find(".as-array-add-btn");
    expect(addBtn.text()).toBe("Add tag");
  });

  it("array validation error displayed on submit", async () => {
    const { RequiredArrayForm } = await import("./fixtures/array-forms.as");
    const { wrapper } = mountForm(RequiredArrayForm);

    // Items is empty by default — submit should trigger validation
    await wrapper.find("form").trigger("submit");
    await nextTick();

    const errorEvents = wrapper.emitted("error");
    expect(errorEvents).toBeTruthy();
    expect(errorEvents!.length).toBe(1);
    const errors = errorEvents![0]![0] as { path: string; message: string }[];
    expect(errors.some((e) => e.message === "At least one item required")).toBe(true);
  });
});
