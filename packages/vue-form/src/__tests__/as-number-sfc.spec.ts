import { describe, it, expect } from "vitest";
import { nextTick } from "vue";
import { mountForm } from "./helpers";

/**
 * SFC-level coverage for the AsNumber merged-chrome path
 * (`<div class="as-number">` shell, paint when `hasAdornment` is true).
 *
 * The plain-number fallback (delegated to AsInputControl with a native
 * `<input type="number">`) inherits browser arrow-step behaviour and
 * is out of scope here.
 */

async function mountAsNumber() {
  const { NumberAdornedField } = await import("./fixtures/field-annotations.as");
  const { wrapper, formData } = mountForm(NumberAdornedField, {
    initialValue: { rate: null },
  });
  await nextTick();
  const input = wrapper.find<HTMLInputElement>(".as-number-input");
  /** Dispatch a cancelable keydown on the input; returns `true` if `preventDefault` was called. */
  const dispatchKey = (key: string): boolean => {
    const ev = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    return !input.element.dispatchEvent(ev);
  };
  return { wrapper, formData, input, dispatchKey };
}

describe("AsNumber SFC (merged-chrome path)", () => {
  it("renders the merged-chrome shell with prefix + suffix pills", async () => {
    const { wrapper } = await mountAsNumber();
    expect(wrapper.find(".as-number").exists()).toBe(true);
    expect(wrapper.find(".as-number .as-prefix").text()).toBe("+1");
    expect(wrapper.find(".as-number .as-suffix").text()).toBe("/hr");
    expect(wrapper.find(".as-number-input").exists()).toBe(true);
  });

  it("typing a decimal commits a number (not a string) — regression for null-origin shape", async () => {
    const { input, formData } = await mountAsNumber();
    await input.setValue("133.33");
    await input.trigger("blur");
    await nextTick();
    expect(formData.value.rate).toBe(133.33);
    expect(typeof formData.value.rate).toBe("number");
  });

  it("ArrowUp on an empty/null model commits 1 (preventDefault'd)", async () => {
    const { formData, dispatchKey } = await mountAsNumber();
    const prevented = dispatchKey("ArrowUp");
    await nextTick();
    expect(formData.value.rate).toBe(1);
    expect(typeof formData.value.rate).toBe("number");
    expect(prevented).toBe(true);
  });

  it("ArrowDown on an empty/null model commits -1", async () => {
    const { formData, dispatchKey } = await mountAsNumber();
    dispatchKey("ArrowDown");
    await nextTick();
    expect(formData.value.rate).toBe(-1);
  });

  it("ArrowUp increments and ArrowDown decrements the existing value", async () => {
    const { formData, dispatchKey } = await mountAsNumber();
    formData.value.rate = 5;
    await nextTick();

    dispatchKey("ArrowUp");
    await nextTick();
    expect(formData.value.rate).toBe(6);

    dispatchKey("ArrowDown");
    await nextTick();
    dispatchKey("ArrowDown");
    await nextTick();
    expect(formData.value.rate).toBe(4);
    expect(typeof formData.value.rate).toBe("number");
  });

  it("non-step keys are not intercepted (no preventDefault, no value change)", async () => {
    const { formData, dispatchKey } = await mountAsNumber();
    formData.value.rate = 7;
    await nextTick();
    const prevented = dispatchKey("Enter");
    await nextTick();
    expect(prevented).toBe(false);
    expect(formData.value.rate).toBe(7);
  });
});
