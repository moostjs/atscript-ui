import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AsCopy from "../components/as-copy.vue";

function baseProps(overrides: Record<string, unknown> = {}) {
  // Read-only display field: `model.value` is the string the user copies.
  // Same prop surface as sibling wf defaults so tests stay homogeneous.
  return {
    onBlur: () => {},
    model: { value: "magic-token-abc123" as string | undefined },
    type: "copy",
    path: "magicLink",
    inputId: "copy-input",
    errorId: "copy-input-err",
    descId: "copy-input-desc",
    ...overrides,
  };
}

let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  writeText = vi.fn(async () => {});
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AsCopy", () => {
  it("renders the value in the input", () => {
    // WHY: the input IS the value display surface. If the readonly
    // input doesn't reflect `model.value`, the user can't even fall
    // back to manual selection when clipboard fails.
    const wrapper = mount(AsCopy, {
      props: baseProps({ model: { value: "hello" } }),
    });
    const input = wrapper.find<HTMLInputElement>("input.as-copy-input");
    expect(input.element.value).toBe("hello");
    expect(input.attributes("readonly")).toBeDefined();
  });

  it("clicking the button calls clipboard.writeText with the value", async () => {
    // WHY: the whole point of the component is the one-click copy.
    // If we don't pipe the value to the clipboard API, the user is
    // stuck doing manual select+copy on every magic link.
    const wrapper = mount(AsCopy, {
      props: baseProps({ model: { value: "secret-token" } }),
    });
    await wrapper.find("button.as-copy-btn").trigger("click");
    expect(writeText).toHaveBeenCalledWith("secret-token");
  });

  it("swaps to the Copied label + check icon after a successful copy", async () => {
    // WHY: the visual feedback IS the confirmation that the copy
    // succeeded — without it, users re-click and lose confidence.
    const wrapper = mount(AsCopy, {
      props: baseProps(),
    });
    await wrapper.find("button.as-copy-btn").trigger("click");
    await nextTick();
    await nextTick();
    const label = wrapper.find(".as-copy-label");
    expect(label.text()).toBe("Copied");
    expect(wrapper.find(".as-copy-icon").classes()).toContain("i-as-check-circle");
  });

  it("reverts back to Copy after the 1500 ms timer", async () => {
    // WHY: the label has to revert so a second copy attempt reads as
    // a new action. A stuck "Copied" hides whether the second click
    // actually fired.
    vi.useFakeTimers();
    const wrapper = mount(AsCopy, {
      props: baseProps(),
    });
    await wrapper.find("button.as-copy-btn").trigger("click");
    // flush the writeText microtask before advancing timers
    await vi.advanceTimersByTimeAsync(0);
    expect(wrapper.find(".as-copy-label").text()).toBe("Copied");
    await vi.advanceTimersByTimeAsync(1500);
    expect(wrapper.find(".as-copy-label").text()).toBe("Copy");
    expect(wrapper.find(".as-copy-icon").classes()).toContain("i-as-copy");
  });

  it("disables the button when value is empty", () => {
    // WHY: copying an empty string is a no-op that still flashes the
    // success label — a clear lie. The disabled state prevents the
    // misleading affordance entirely.
    const wrapper = mount(AsCopy, {
      props: baseProps({ model: { value: "" } }),
    });
    const btn = wrapper.find<HTMLButtonElement>("button.as-copy-btn");
    expect(btn.element.disabled).toBe(true);
  });

  it("renders props.value (phantom path) when model.value is undefined", async () => {
    // WHY: the canonical use-case is a phantom field driven by
    // `@ui.form.fn.value` — AsField writes the resolved value to
    // `props.value`, leaving `model.value` undefined. If we ever
    // regress to reading model first, the wf-demo flow goes blank.
    const wrapper = mount(AsCopy, {
      props: baseProps({
        model: { value: undefined },
        value: "phantom-magic-link",
      }),
    });
    const input = wrapper.find<HTMLInputElement>("input.as-copy-input");
    expect(input.element.value).toBe("phantom-magic-link");
    await wrapper.find("button.as-copy-btn").trigger("click");
    expect(writeText).toHaveBeenCalledWith("phantom-magic-link");
  });
});
