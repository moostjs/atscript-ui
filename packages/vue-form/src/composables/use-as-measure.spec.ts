import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { defineAnnotatedType } from "@atscript/typescript/utils";
import { createFormDef } from "@atscript/ui";
import { defineComponent, h, nextTick, reactive, ref } from "vue";
import AsForm from "../components/as-form.vue";
import { objectType, stringProp } from "../__tests__/helpers";
import { createDefaultTypes } from "./create-default-types";
import { provideAsLocale } from "./use-as-locale";
import { useAsMeasure, type UseAsMeasureReturn } from "./use-as-measure";

function numberProp() {
  return defineAnnotatedType().designType("number").$type;
}

interface MountOpts {
  type: ReturnType<typeof objectType>;
  initialValue?: Record<string, unknown>;
  modelValue: () => string | number | null | undefined;
  unitCode?: () => string | undefined;
  unitRefField?: () => string | undefined;
  precisionScale?: () => number | undefined;
  locale?: string;
  onCommit?: (v: string | number | null) => void;
}

function mountWithProbe(opts: MountOpts) {
  const commits: (string | number | null)[] = [];
  let api!: UseAsMeasureReturn;
  const Probe = defineComponent({
    setup() {
      api = useAsMeasure({
        modelValue: opts.modelValue,
        unitCode: opts.unitCode,
        unitRefField: opts.unitRefField,
        precisionScale: opts.precisionScale,
        onCommit: (v) => {
          commits.push(v);
          opts.onCommit?.(v);
        },
      });
      return () => h("div");
    },
  });
  const Root = defineComponent({
    setup() {
      if (opts.locale) provideAsLocale(() => opts.locale);
      return () => h(Probe);
    },
  });
  const def = createFormDef(opts.type);
  const formData = reactive({ value: opts.initialValue ?? {} }) as {
    value: Record<string, unknown>;
  };
  const types = createDefaultTypes() as Record<string, unknown>;
  mount(AsForm as unknown as typeof AsForm, {
    props: { def, formData, types: types as never },
    slots: { "form.before": () => h(Root) },
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
  it("static unitCode wins over sibling reference", () => {
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

  it("displayValue formats with locale and scale", () => {
    const type = objectType({ weight: numberProp() });
    const { api } = mountWithProbe({
      type,
      modelValue: () => "1234.5",
      precisionScale: () => 2,
      locale: "en-US",
    });
    expect(api.displayValue.value).toBe("1,234.50");
  });

  it("setFromInput parses, truncates to scale, preserves shape", () => {
    const type = objectType({ weight: numberProp() });
    const live = ref<string | number | null | undefined>("5.5");
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      precisionScale: () => 1,
      onCommit: (v) => {
        live.value = v as string;
      },
    });
    api.setFromInput("9.876");
    expect(commits).toEqual(["9.8"]); // truncate at scale=1, string in → string out
  });

  it("setFromInput number-in → number-out preserves shape", () => {
    const type = objectType({ weight: numberProp() });
    const live = ref<string | number | null | undefined>(5.5);
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      precisionScale: () => 1,
      onCommit: (v) => {
        live.value = v as number;
      },
    });
    api.setFromInput("9.876");
    expect(commits).toEqual([9.8]);
  });

  it("setFromInput empty → null", () => {
    const type = objectType({ weight: numberProp() });
    const live = ref<string | number | null | undefined>("5.5");
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      precisionScale: () => 1,
      onCommit: (v) => {
        live.value = v as null;
      },
    });
    api.setFromInput("");
    expect(commits).toEqual([null]);
  });

  it("returns undefined unit when neither static nor ref resolves", () => {
    const type = objectType({ weight: numberProp() });
    const { api } = mountWithProbe({ type, modelValue: () => 1 });
    expect(api.unit.value).toBeUndefined();
  });

  it("undefined precisionScale → no padding, raw value committed verbatim", () => {
    // Measures aren't currency — a weight field with no `@db.column.precision`
    // and no unit must commit "4" as "4", not pad to "4.00" the way amounts
    // do. Locks in `storageScale` being absent on the measure side.
    const type = objectType({ weight: numberProp() });
    const live = ref<string | number | null | undefined>("0");
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      onCommit: (v) => {
        live.value = v as string;
      },
    });
    api.setFromInput("4");
    expect(commits).toEqual(["4"]);
    // rawValue also doesn't pad when scale is undefined.
    live.value = "9.123";
    expect(api.rawValue.value).toBe("9.123");
  });

  it("locale-aware decimal input (fr-FR)", () => {
    const type = objectType({ weight: numberProp() });
    const live = ref<string | number | null | undefined>("0");
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      precisionScale: () => 2,
      locale: "fr-FR",
      onCommit: (v) => {
        live.value = v as string;
      },
    });
    api.setFromInput("4,25");
    expect(commits).toEqual(["4.25"]);
  });
});
