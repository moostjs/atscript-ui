import { describe, it, expect } from "vitest";
import { mountForm, objectType, stringProp } from "./helpers";
import {
  META_LABEL,
  META_DESCRIPTION,
  UI_HIDDEN,
  UI_DISABLED,
  UI_PLACEHOLDER,
  UI_HINT,
} from "@atscript/ui-core";

describe("AsField", () => {
  it("resolves label from @meta.label", () => {
    const type = objectType({
      name: stringProp({ [META_LABEL]: "Full Name" }),
    });
    const { wrapper } = mountForm(type);
    const label = wrapper.find("label");
    expect(label.exists()).toBe(true);
    expect(label.text()).toBe("Full Name");
  });

  it("applies @ui.hidden (field has display:none)", () => {
    const type = objectType({
      secret: stringProp({ [UI_HIDDEN]: true }),
    });
    const { wrapper } = mountForm(type);
    // The field shell uses v-show="!hidden", so it should be display: none
    const field = wrapper.find(".as-default-field");
    expect(field.exists()).toBe(true);
    expect(field.attributes("style")).toContain("display: none");
  });

  it("applies @ui.disabled (input has disabled attribute)", () => {
    const type = objectType({
      locked: stringProp({ [UI_DISABLED]: true }),
    });
    const { wrapper } = mountForm(type);
    const input = wrapper.find("input");
    expect(input.exists()).toBe(true);
    expect(input.attributes("disabled")).toBeDefined();
  });

  it("renders placeholder from @ui.placeholder", () => {
    const type = objectType({
      email: stringProp({ [UI_PLACEHOLDER]: "you@example.com" }),
    });
    const { wrapper } = mountForm(type);
    const input = wrapper.find("input");
    expect(input.attributes("placeholder")).toBe("you@example.com");
  });

  it("renders hint text from @ui.hint", () => {
    const type = objectType({
      password: stringProp({ [UI_HINT]: "At least 8 characters" }),
    });
    const { wrapper } = mountForm(type);
    expect(wrapper.text()).toContain("At least 8 characters");
  });

  it("renders description from @meta.description", () => {
    const type = objectType({
      bio: stringProp({ [META_DESCRIPTION]: "Tell us about yourself" }),
    });
    const { wrapper } = mountForm(type);
    expect(wrapper.text()).toContain("Tell us about yourself");
  });
});
