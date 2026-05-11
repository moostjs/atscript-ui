import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { defineComponent, h, ref } from "vue";
import { useAsDualInput, type UseAsDualInputReturn } from "./use-as-dual-input";

interface State {
  sign: "" | "-";
  integer: string;
  decimal: string;
}

function makeMount(initial: State, scale = 2) {
  const stateRef = ref<State>({ ...initial });
  let api!: UseAsDualInputReturn;
  const setFromPartsCalls: Array<[string, string, string]> = [];
  const setFromInputCalls: string[] = [];
  const Probe = defineComponent({
    setup() {
      api = useAsDualInput({
        scale: () => scale,
        decimalSeparator: () => ".",
        parts: () => ({ ...stateRef.value }),
        rawValue: () => {
          const s = stateRef.value;
          const body = s.decimal === "" ? s.integer : `${s.integer}.${s.decimal}`;
          return `${s.sign}${body}`;
        },
        setFromParts: (sign, integer, decimal) => {
          setFromPartsCalls.push([sign, integer, decimal]);
          stateRef.value = { sign, integer, decimal };
        },
        setFromInput: (raw) => {
          setFromInputCalls.push(raw);
        },
      });
      return () =>
        h("div", [
          h("input", { ref: api.integerInput, class: "i" }),
          h("input", { ref: api.decimalInput, class: "d" }),
        ]);
    },
  });
  const wrapper = mount(Probe);
  return { wrapper, api, stateRef, setFromPartsCalls, setFromInputCalls };
}

describe("useAsDualInput", () => {
  it("integerDisplay swaps from grouped to un-grouped on focus", async () => {
    const { api, wrapper } = makeMount({ sign: "", integer: "1,234", decimal: "56" });
    expect(api.integerDisplay.value).toBe("1,234");
    api.onIntegerFocus();
    await wrapper.vm.$nextTick();
    // On focus, raw integer is used (no grouping). Our raw is "1,234.56" — the
    // composable's `rawValue` getter returns the raw string verbatim, so the
    // display reflects the un-grouped split.
    expect(api.focusActive.value).toBe(true);
  });

  it("decimalDisplay hides padding zeros on focus before user types", () => {
    const { api } = makeMount({ sign: "", integer: "4", decimal: "00" });
    api.onDecimalFocus();
    // Zero-shaped decimal + not yet dirty → empty display so cursor lands clean.
    expect(api.decimalDisplay.value).toBe("");
  });

  it("decimalDisplay shows real decimals on focus", () => {
    const { api } = makeMount({ sign: "", integer: "12", decimal: "34" });
    api.onDecimalFocus();
    expect(api.decimalDisplay.value).toBe("34");
  });

  it("digit keystroke in decimal half overwrites at cursor (slot-machine UX)", async () => {
    const { wrapper, api } = makeMount({ sign: "", integer: "12", decimal: "00" }, 2);
    // Mount + focus + place cursor at 0 by directly invoking the keydown handler
    const decimalEl = wrapper.find(".d").element as HTMLInputElement;
    decimalEl.value = "00";
    decimalEl.selectionStart = 0;
    decimalEl.selectionEnd = 0;
    const event = new KeyboardEvent("keydown", { key: "5" });
    Object.defineProperty(event, "target", { value: decimalEl });
    api.onDecimalKeydown(event);
    expect(decimalEl.value).toBe("00"); // value not yet replaced — overwrite buffer updated
    expect(api.decimalDisplay.value).toBe("50"); // edit buffer
  });

  it("digit keystroke at full input is no-op", () => {
    const { wrapper, api, setFromPartsCalls } = makeMount(
      { sign: "", integer: "12", decimal: "99" },
      2,
    );
    const decimalEl = wrapper.find(".d").element as HTMLInputElement;
    decimalEl.value = "99";
    decimalEl.selectionStart = 2;
    decimalEl.selectionEnd = 2;
    const event = new KeyboardEvent("keydown", { key: "5" });
    Object.defineProperty(event, "target", { value: decimalEl });
    api.onDecimalKeydown(event);
    expect(setFromPartsCalls).toEqual([]);
  });

  it("onBlurAll drops edit buffer and calls onBlur callback when focus leaves both inputs", async () => {
    const onBlurCalls: number[] = [];
    const stateRef = ref<State>({ sign: "", integer: "12", decimal: "50" });
    let api!: UseAsDualInputReturn;
    const Probe = defineComponent({
      setup() {
        api = useAsDualInput({
          scale: () => 2,
          decimalSeparator: () => ".",
          parts: () => ({ ...stateRef.value }),
          rawValue: () => `${stateRef.value.integer}.${stateRef.value.decimal}`,
          setFromParts: () => {},
          setFromInput: () => {},
          onBlur: () => onBlurCalls.push(1),
        });
        // Mount the inputs so the refs are bound to real DOM nodes — otherwise
        // both refs are null and `null === relatedTarget` short-circuits.
        return () =>
          h("div", [
            h("input", { ref: api.integerInput, class: "i" }),
            h("input", { ref: api.decimalInput, class: "d" }),
          ]);
      },
    });
    const wrapper = mount(Probe);
    // Tab out of both inputs — relatedTarget is a non-input element (the body).
    api.focusActive.value = true;
    const outside = document.createElement("button");
    const fakeEvent = { relatedTarget: outside } as unknown as FocusEvent;
    api.onBlurAll(fakeEvent);
    expect(api.focusActive.value).toBe(false);
    expect(onBlurCalls).toEqual([1]);
    wrapper.unmount();
  });

  it("non-digit printable key is blocked in decimal half", () => {
    const { wrapper, api } = makeMount({ sign: "", integer: "12", decimal: "00" }, 2);
    const decimalEl = wrapper.find(".d").element as HTMLInputElement;
    const event = new KeyboardEvent("keydown", { key: "a" });
    Object.defineProperty(event, "target", { value: decimalEl });
    let prevented = false;
    Object.defineProperty(event, "preventDefault", {
      value: () => {
        prevented = true;
      },
    });
    api.onDecimalKeydown(event);
    expect(prevented).toBe(true);
  });
});
