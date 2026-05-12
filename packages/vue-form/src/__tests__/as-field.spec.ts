import { describe, it, expect } from "vitest";
import { mountForm } from "./helpers";

describe("AsField", () => {
  it("resolves label from @meta.label", async () => {
    const { LabeledField } = await import("./fixtures/field-annotations.as");
    const { wrapper } = mountForm(LabeledField);
    const label = wrapper.find("label");
    expect(label.exists()).toBe(true);
    expect(label.text()).toBe("Full Name");
  });

  it("applies @ui.form.hidden (field has display:none)", async () => {
    const { HiddenField } = await import("./fixtures/field-annotations.as");
    const { wrapper } = mountForm(HiddenField);
    // The field shell uses v-show="!hidden", so it should be display: none
    const field = wrapper.find(".as-default-field");
    expect(field.exists()).toBe(true);
    expect(field.attributes("style")).toContain("display: none");
  });

  it("applies @ui.form.disabled (input has disabled attribute)", async () => {
    const { DisabledField } = await import("./fixtures/field-annotations.as");
    const { wrapper } = mountForm(DisabledField);
    const input = wrapper.find("input");
    expect(input.exists()).toBe(true);
    expect(input.attributes("disabled")).toBeDefined();
  });

  it("renders placeholder from @ui.form.placeholder", async () => {
    const { PlaceholderField } = await import("./fixtures/field-annotations.as");
    const { wrapper } = mountForm(PlaceholderField);
    const input = wrapper.find("input");
    expect(input.attributes("placeholder")).toBe("you@example.com");
  });

  it("renders hint text from @ui.form.hint", async () => {
    const { HintField } = await import("./fixtures/field-annotations.as");
    const { wrapper } = mountForm(HintField);
    expect(wrapper.text()).toContain("At least 8 characters");
  });

  it("renders description from @meta.description", async () => {
    const { DescriptionField } = await import("./fixtures/field-annotations.as");
    const { wrapper } = mountForm(DescriptionField);
    expect(wrapper.text()).toContain("Tell us about yourself");
  });

  it("surfaces @ui.form.prefix.icon as a `prefixIcon` prop on the rendered field component", async () => {
    const { IconField } = await import("./fixtures/field-annotations.as");
    const { wrapper } = mountForm(IconField);
    // Default text input forwards the resolved prefixIcon onto its merged
    // shell via the new AsAdornmentShell wrapper. We assert the underlying
    // metadata read on the prop.
    const field = wrapper.find(".as-default-field");
    expect(field.exists()).toBe(true);
    const { getFieldMeta } = await import("@atscript/ui");
    expect(getFieldMeta(IconField.type.props.get("email")!, "ui.form.prefix.icon")).toBe("mail");
    // The icon class is painted onto the span inside the shell.
    const iconSpan = wrapper.find(".as-prefix-icon");
    expect(iconSpan.exists()).toBe(true);
    expect(iconSpan.classes()).toContain("mail");
  });
});
