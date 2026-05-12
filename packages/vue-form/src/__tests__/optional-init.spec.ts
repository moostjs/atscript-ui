import { describe, it, expect } from "vitest";
import { nextTick } from "vue";
import { mountForm } from "./helpers";

// Regression: clicking the AsFieldShell empty-state placeholder on an
// optional LEAF field must transition the field to an editable state.
//
// Before the fix in `createFormData`, the structural default for the
// `decimal` design type was `undefined` (atscript's `finalDefault` table
// doesn't enumerate it). `toggleOptional(true)` would commit that
// `undefined` back to the model, and AsFieldShell's
// `optionalEnabled = model.value != null` check would stay `false` — so
// the placeholder never went away and the input chrome never appeared.

describe("optional-init: clicking the empty-state placeholder", () => {
  it("decimal: model goes from undefined → '0' (input chrome appears)", async () => {
    const { OptionalDecimalField } = await import("./fixtures/optional-init.as");
    const { wrapper, formData } = mountForm(OptionalDecimalField);
    expect(formData.value.amount).toBeUndefined();
    expect(wrapper.find(".as-no-data").exists()).toBe(true);

    await wrapper.find(".as-no-data").trigger("click");
    await nextTick();

    // Model must be defined (so AsFieldShell stops painting the placeholder).
    expect(formData.value.amount).toBeDefined();
    // Canonical zero — atscript runtime validator (≥ 0.1.54) rejects ""
    // for decimal, so init commits "0" and useAsDecimal pads display to scale.
    expect(formData.value.amount).toBe("0");
    // Placeholder gone — input chrome rendered.
    expect(wrapper.find(".as-no-data").exists()).toBe(false);
    expect(wrapper.find(".as-decimal").exists()).toBe(true);
  });

  it("number: model goes from undefined → 0 (input chrome appears)", async () => {
    const { OptionalNumberField } = await import("./fixtures/optional-init.as");
    const { wrapper, formData } = mountForm(OptionalNumberField);
    expect(formData.value.count).toBeUndefined();
    expect(wrapper.find(".as-no-data").exists()).toBe(true);

    await wrapper.find(".as-no-data").trigger("click");
    await nextTick();

    expect(formData.value.count).toBe(0);
    expect(wrapper.find(".as-no-data").exists()).toBe(false);
  });

  it("string: model goes from undefined → '' (input chrome appears)", async () => {
    const { OptionalStringField } = await import("./fixtures/optional-init.as");
    const { wrapper, formData } = mountForm(OptionalStringField);
    expect(formData.value.note).toBeUndefined();
    expect(wrapper.find(".as-no-data").exists()).toBe(true);

    await wrapper.find(".as-no-data").trigger("click");
    await nextTick();

    expect(formData.value.note).toBe("");
    expect(wrapper.find(".as-no-data").exists()).toBe(false);
  });

  it("decimal with adornments: placeholder click reveals the AsDecimal merged shell", async () => {
    const { OptionalDecimalWithAdornments } = await import("./fixtures/optional-init.as");
    const { wrapper, formData } = mountForm(OptionalDecimalWithAdornments);
    expect(formData.value.price).toBeUndefined();
    expect(wrapper.find(".as-no-data").exists()).toBe(true);

    await wrapper.find(".as-no-data").trigger("click");
    await nextTick();

    expect(formData.value.price).toBe("0");
    // The adornment-driven `.as-decimal` shell paints; prefix + suffix render.
    expect(wrapper.find(".as-decimal").exists()).toBe(true);
    expect(wrapper.find(".as-prefix").text()).toBe("$");
    expect(wrapper.find(".as-suffix").text()).toBe("USD");
  });
});
