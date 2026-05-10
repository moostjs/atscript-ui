import { describe, it, expect } from "vitest";
import { mountForm, objectType, stringProp } from "./helpers";

describe("AsForm loading state", () => {
  it("does not render the loading overlay by default", () => {
    const type = objectType({ name: stringProp() });
    const { wrapper } = mountForm(type);
    expect(wrapper.find(".as-form-overlay").exists()).toBe(false);
    // No `inert` attribute when not loading.
    expect(wrapper.find("form").attributes("inert")).toBeUndefined();
  });

  it("does not render the loading overlay when loading=false", async () => {
    const type = objectType({ name: stringProp() });
    const { wrapper } = mountForm(type);
    await wrapper.setProps({ loading: false });
    expect(wrapper.find(".as-form-overlay").exists()).toBe(false);
    expect(wrapper.find("form").attributes("inert")).toBeUndefined();
  });

  it("renders the loading overlay when loading=true", async () => {
    const type = objectType({ name: stringProp() });
    const { wrapper } = mountForm(type);
    await wrapper.setProps({ loading: true });

    const overlay = wrapper.find(".as-form-overlay");
    expect(overlay.exists()).toBe(true);
    // Default slot paints the spinner icon.
    expect(overlay.find(".as-form-overlay-icon").exists()).toBe(true);
  });

  it("applies the `inert` attribute to the form while loading", async () => {
    const type = objectType({ name: stringProp() });
    const { wrapper } = mountForm(type);
    await wrapper.setProps({ loading: true });
    // `inert` is rendered as a present (boolean) attribute.
    expect(wrapper.find("form").attributes("inert")).toBeDefined();
  });

  it("toggles the overlay reactively when loading flips", async () => {
    const type = objectType({ name: stringProp() });
    const { wrapper } = mountForm(type);

    await wrapper.setProps({ loading: true });
    expect(wrapper.find(".as-form-overlay").exists()).toBe(true);

    await wrapper.setProps({ loading: false });
    expect(wrapper.find(".as-form-overlay").exists()).toBe(false);
    expect(wrapper.find("form").attributes("inert")).toBeUndefined();
  });
});
