import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, reactive } from "vue";
import AsForm from "../components/as-form.vue";
import { createFormDef } from "@atscript/ui";
import { createDefaultTypes } from "./create-default-types";
import { useAsMeasure, type UseAsMeasureReturn } from "./use-as-measure";
import { objectType, stringProp } from "../__tests__/helpers";
import { defineAnnotatedType } from "@atscript/typescript/utils";

function numberProp() {
  return defineAnnotatedType().designType("number").$type;
}

function mountWithProbe(opts: {
  type: ReturnType<typeof objectType>;
  initialValue?: Record<string, unknown>;
  modelValue: () => number | null | undefined;
  unitCode?: () => string | undefined;
  unitRefField?: () => string | undefined;
  precisionScale?: () => number | undefined;
}) {
  const commits: (number | null)[] = [];
  let api!: UseAsMeasureReturn;
  const Probe = defineComponent({
    setup() {
      api = useAsMeasure({
        modelValue: opts.modelValue,
        unitCode: opts.unitCode,
        unitRefField: opts.unitRefField,
        precisionScale: opts.precisionScale,
        onCommit: (v) => commits.push(v),
      });
      return () => h("div");
    },
  });
  const def = createFormDef(opts.type);
  const formData = reactive({ value: opts.initialValue ?? {} }) as {
    value: Record<string, unknown>;
  };
  const types = createDefaultTypes() as Record<string, unknown>;
  mount(AsForm as unknown as typeof AsForm, {
    props: { def, formData, types: types as never },
    slots: { "form.before": () => h(Probe) },
  });
  return {
    formData,
    commits,
    get api() {
      return api;
    },
  };
}

describe("useAsMeasure", () => {
  it("static unitCode wins over the sibling reference", () => {
    const type = objectType({ unit: stringProp(), weight: numberProp() });
    const { api } = mountWithProbe({
      type,
      initialValue: { unit: "lb", weight: 10 },
      modelValue: () => 10,
      unitCode: () => "kg",
      unitRefField: () => "unit",
    });
    expect(api.unit.value).toBe("kg");
  });

  it("siblingValue() resolves and re-resolves on mutation", async () => {
    const type = objectType({ unit: stringProp(), weight: numberProp() });
    const { api, formData } = mountWithProbe({
      type,
      initialValue: { unit: "kg", weight: 10 },
      modelValue: () => 10,
      unitRefField: () => "unit",
    });
    expect(api.unit.value).toBe("kg");
    formData.value.unit = "lb";
    await nextTick();
    expect(api.unit.value).toBe("lb");
  });

  it("step derives from precisionScale", () => {
    const type = objectType({ weight: numberProp() });
    const { api } = mountWithProbe({
      type,
      modelValue: () => 1,
      precisionScale: () => 3,
    });
    expect(api.step.value).toBe("0.001");
  });

  it("displayValue and setFromInput round-trip via precisionScale", () => {
    const type = objectType({ weight: numberProp() });
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => 5.5,
      precisionScale: () => 1,
    });
    expect(api.displayValue.value).toBe("5.5");
    api.setFromInput("9.876");
    expect(commits).toEqual([9.9]);
    api.setFromInput("");
    expect(commits).toEqual([9.9, null]);
  });

  it("returns undefined unit when neither static nor ref resolve", () => {
    const type = objectType({ weight: numberProp() });
    const { api } = mountWithProbe({ type, modelValue: () => 1 });
    expect(api.unit.value).toBeUndefined();
  });
});
