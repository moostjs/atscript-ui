import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref, type Ref } from "vue";
import {
  useAsTriStateCheckbox,
  type UseAsTriStateCheckboxReturn,
} from "./use-as-tri-state-checkbox";

interface ProbeCaptures {
  api: UseAsTriStateCheckboxReturn;
  model: Ref<boolean | undefined>;
}

function mountCheckboxProbe(initial: boolean | undefined): {
  wrapper: ReturnType<typeof mount>;
  captured: ProbeCaptures;
  input: () => HTMLInputElement;
} {
  const captured: { current?: ProbeCaptures } = {};

  const Probe = defineComponent({
    setup() {
      const model = ref<boolean | undefined>(initial);
      const api = useAsTriStateCheckbox({
        modelValue: () => model.value,
        onCommit: (v) => {
          model.value = v;
        },
      });
      captured.current = { api, model };
      return () =>
        h("input", {
          ref: api.inputRef,
          type: "checkbox",
          checked: api.checked.value,
          onChange: api.onChange,
        });
    },
  });

  const wrapper = mount(Probe, { attachTo: document.body });
  return {
    wrapper,
    captured: captured.current as ProbeCaptures,
    input: () => wrapper.find("input").element as HTMLInputElement,
  };
}

describe("useAsTriStateCheckbox", () => {
  it("undefined model renders indeterminate", async () => {
    const { captured, input } = mountCheckboxProbe(undefined);
    await nextTick();
    expect(captured.api.checked.value).toBe(false);
    expect(captured.api.indeterminate.value).toBe(true);
    expect(input().indeterminate).toBe(true);
    expect(input().checked).toBe(false);
  });

  it("true model renders checked, not indeterminate", async () => {
    const { captured, input } = mountCheckboxProbe(true);
    await nextTick();
    expect(captured.api.checked.value).toBe(true);
    expect(captured.api.indeterminate.value).toBe(false);
    expect(input().indeterminate).toBe(false);
    expect(input().checked).toBe(true);
  });

  it("false model renders unchecked, not indeterminate", async () => {
    const { captured, input } = mountCheckboxProbe(false);
    await nextTick();
    expect(captured.api.checked.value).toBe(false);
    expect(captured.api.indeterminate.value).toBe(false);
    expect(input().indeterminate).toBe(false);
    expect(input().checked).toBe(false);
  });

  it("clicking an indeterminate checkbox commits true (matches browser default)", async () => {
    const { captured, wrapper } = mountCheckboxProbe(undefined);
    await nextTick();
    // Simulate the browser's after-click state: checked = true.
    const el = wrapper.find("input").element as HTMLInputElement;
    el.checked = true;
    await wrapper.find("input").trigger("change");
    expect(captured.model.value).toBe(true);
  });

  it("re-syncs DOM indeterminate when the model swings back to undefined", async () => {
    const captured: { setModel?: (v: boolean | undefined) => void } = {};
    const Probe = defineComponent({
      setup() {
        const model = ref<boolean | undefined>(true);
        captured.setModel = (v) => {
          model.value = v;
        };
        const api = useAsTriStateCheckbox({
          modelValue: () => model.value,
          onCommit: (v) => {
            model.value = v;
          },
        });
        return () =>
          h("input", {
            ref: api.inputRef,
            type: "checkbox",
            checked: api.checked.value,
            onChange: api.onChange,
          });
      },
    });

    const wrapper = mount(Probe, { attachTo: document.body });
    const el = wrapper.find("input").element as HTMLInputElement;
    await nextTick();
    expect(el.indeterminate).toBe(false);
    expect(el.checked).toBe(true);

    captured.setModel!(undefined);
    await nextTick();
    expect(el.indeterminate).toBe(true);
    expect(el.checked).toBe(false);
  });
});
