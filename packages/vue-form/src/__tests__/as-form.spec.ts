import { describe, it, expect } from "vitest";
import { nextTick } from "vue";
import { mountForm, objectType, stringProp } from "./helpers";

describe("AsForm", () => {
  it("renders a <form> element", () => {
    const type = objectType({
      name: stringProp(),
    });
    const { wrapper } = mountForm(type);
    expect(wrapper.find("form").exists()).toBe(true);
  });

  it('renders a submit button with default text "Submit"', () => {
    const type = objectType({
      name: stringProp(),
    });
    const { wrapper } = mountForm(type);
    const button = wrapper.find("form > button");
    expect(button.exists()).toBe(true);
    expect(button.text()).toBe("Submit");
  });

  it("renders input fields for string props", async () => {
    const { LabeledForm } = await import("./fixtures/form-features.as");
    const { wrapper } = mountForm(LabeledForm);
    const inputs = wrapper.findAll("input");
    expect(inputs.length).toBe(2);
  });

  it('emits "submit" with unwrapped domain data when validation passes', async () => {
    const type = objectType({
      name: stringProp(),
    });
    const { wrapper, formData } = mountForm(type);
    formData.value.name = "Alice";
    await nextTick();

    await wrapper.find("form").trigger("submit");
    await nextTick();

    const submitEvents = wrapper.emitted("submit");
    expect(submitEvents).toBeTruthy();
    expect(submitEvents!.length).toBe(1);
    expect(submitEvents![0]![0]).toEqual({ name: "Alice" });
  });

  it('emits "error" with error array when required field is empty', async () => {
    const { RequiredForm } = await import("./fixtures/form-features.as");
    const { wrapper } = mountForm(RequiredForm);

    await wrapper.find("form").trigger("submit");
    await nextTick();

    const errorEvents = wrapper.emitted("error");
    expect(errorEvents).toBeTruthy();
    expect(errorEvents!.length).toBe(1);
    const errors = errorEvents![0]![0] as { path: string; message: string }[];
    expect(Array.isArray(errors)).toBe(true);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message === "Name is required")).toBe(true);
  });

  it("static @ui.submit.text changes button text", async () => {
    const { SubmitTextForm } = await import("./fixtures/form-features.as");
    const { wrapper } = mountForm(SubmitTextForm);
    const button = wrapper.find("form > button");
    expect(button.text()).toBe("Save");
  });

  it('@change emitted with type "update" when field value changes and blurs', async () => {
    const type = objectType({
      name: stringProp(),
    });
    const { wrapper, formData } = mountForm(type);

    formData.value.name = "Bob";
    await nextTick();

    const input = wrapper.find("input");
    await input.trigger("blur");
    await nextTick();

    const changeEvents = wrapper.emitted("change");
    expect(changeEvents).toBeTruthy();
    expect(changeEvents!.length).toBeGreaterThanOrEqual(1);
    const [changeType, path] = changeEvents![0]!;
    expect(changeType).toBe("update");
    expect(path).toBe("name");
  });
});
