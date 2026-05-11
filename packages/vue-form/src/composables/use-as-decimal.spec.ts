import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { defineAnnotatedType } from "@atscript/typescript/utils";
import { createFormDef } from "@atscript/ui";
import { defineComponent, h, nextTick, reactive, ref } from "vue";
import AsForm from "../components/as-form.vue";
import { objectType } from "../__tests__/helpers";
import { createDefaultTypes } from "./create-default-types";
import { provideAsLocale } from "./use-as-locale";
import { useAsDecimal, type UseAsDecimalReturn } from "./use-as-decimal";

function numberProp() {
  return defineAnnotatedType().designType("number").$type;
}

interface MountOpts {
  type: ReturnType<typeof objectType>;
  initialValue?: Record<string, unknown>;
  modelValue: () => string | number | null | undefined;
  scale?: () => number | undefined;
  storageScale?: () => number | undefined;
  locale?: string;
  onCommit?: (v: string | number | null) => void;
}

function mountWithProbe(opts: MountOpts) {
  const commits: (string | number | null)[] = [];
  let api!: UseAsDecimalReturn;
  const Probe = defineComponent({
    setup() {
      api = useAsDecimal({
        modelValue: opts.modelValue,
        scale: opts.scale,
        storageScale: opts.storageScale,
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

describe("useAsDecimal — scale resolution", () => {
  it("scale prop + storageScale prop both honoured", () => {
    const type = objectType({ amount: numberProp() });
    const { api } = mountWithProbe({
      type,
      modelValue: () => 0,
      scale: () => 2,
      storageScale: () => 3,
    });
    expect(api.scale.value).toBe(2);
    expect(api.storageScale.value).toBe(3);
  });

  it("scale falls back to storageScale when missing", () => {
    const type = objectType({ amount: numberProp() });
    const { api } = mountWithProbe({
      type,
      modelValue: () => 0,
      storageScale: () => 4,
    });
    expect(api.scale.value).toBe(4);
    expect(api.storageScale.value).toBe(4);
  });

  it("storageScale falls back to scale when missing", () => {
    const type = objectType({ amount: numberProp() });
    const { api } = mountWithProbe({
      type,
      modelValue: () => 0,
      scale: () => 1,
    });
    expect(api.scale.value).toBe(1);
    expect(api.storageScale.value).toBe(1);
  });

  it("neither set → fallback 2", () => {
    const type = objectType({ amount: numberProp() });
    const { api } = mountWithProbe({ type, modelValue: () => 0 });
    expect(api.scale.value).toBe(2);
    expect(api.storageScale.value).toBe(2);
  });
});

describe("useAsDecimal — commit paths preserve storage shape", () => {
  it("string in → string out, padded to storageScale", () => {
    const type = objectType({ amount: numberProp() });
    const live = ref<string | number | null | undefined>("10.5");
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      scale: () => 2,
      storageScale: () => 3,
      onCommit: (v) => {
        live.value = v as string;
      },
    });
    api.setFromInput("12.34");
    expect(commits).toEqual(["12.340"]); // storageScale=3
  });

  it("number in → number out", () => {
    const type = objectType({ amount: numberProp() });
    const live = ref<string | number | null | undefined>(10.5);
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      scale: () => 2,
      onCommit: (v) => {
        live.value = v as number;
      },
    });
    api.setFromInput("12.34");
    expect(commits).toEqual([12.34]); // number preserved
  });

  it("setFromInput accepts en-US thousands", () => {
    const type = objectType({ amount: numberProp() });
    const live = ref<string | number | null | undefined>("0");
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      scale: () => 2,
      locale: "en-US",
      onCommit: (v) => {
        live.value = v as string;
      },
    });
    api.setFromInput("1,234.56");
    expect(commits).toEqual(["1234.56"]);
  });

  it("setFromInput accepts fr-FR comma decimal", () => {
    const type = objectType({ amount: numberProp() });
    const live = ref<string | number | null | undefined>("0");
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      scale: () => 2,
      locale: "fr-FR",
      onCommit: (v) => {
        live.value = v as string;
      },
    });
    api.setFromInput("1234,56");
    expect(commits).toEqual(["1234.56"]);
  });

  it("setFromInput ignores invalid input", () => {
    const type = objectType({ amount: numberProp() });
    const live = ref<string | number | null | undefined>("0");
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      scale: () => 2,
      onCommit: (v) => {
        live.value = v as string;
      },
    });
    api.setFromInput("abc");
    expect(commits).toEqual([]);
  });

  it("setFromInput empty → null", () => {
    const type = objectType({ amount: numberProp() });
    const live = ref<string | number | null | undefined>("12.34");
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      scale: () => 2,
      onCommit: (v) => {
        live.value = v as null;
      },
    });
    api.setFromInput("");
    expect(commits).toEqual([null]);
  });

  it("setFromParts joins parts, truncates to scale, pads to storage", () => {
    const type = objectType({ amount: numberProp() });
    const live = ref<string | number | null | undefined>("0");
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      scale: () => 2,
      storageScale: () => 3,
      onCommit: (v) => {
        live.value = v as string;
      },
    });
    api.setFromParts("", "1234", "56");
    expect(commits).toEqual(["1234.560"]);
  });

  it("setFromParts strips non-digit chars (defensive)", () => {
    const type = objectType({ amount: numberProp() });
    const live = ref<string | number | null | undefined>("0");
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      scale: () => 2,
      onCommit: (v) => {
        live.value = v as string;
      },
    });
    api.setFromParts("-", "1,234", "56");
    expect(commits).toEqual(["-1234.56"]);
  });
});

describe("useAsDecimal — scale-shrink re-rounding", () => {
  it("scale shrinks 2→0 (e.g. EUR→JPY) re-commits truncated value", async () => {
    const type = objectType({ amount: numberProp() });
    const live = ref<string | number | null | undefined>("10.99");
    const sc = ref<number | undefined>(2);
    const { commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      scale: () => sc.value,
      storageScale: () => 3,
      onCommit: (v) => {
        live.value = v as string;
      },
    });
    expect(commits).toEqual([]);
    sc.value = 0;
    await nextTick();
    // scale shrinks 2→0; storage stays 3 → "10.000"
    expect(commits).toEqual(["10.000"]);
  });

  it("scale grows 2→3 (e.g. EUR→BHD) does NOT re-commit", async () => {
    const type = objectType({ amount: numberProp() });
    const live = ref<string | number | null | undefined>("10.99");
    const sc = ref<number | undefined>(2);
    const { commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      scale: () => sc.value,
      storageScale: () => 3,
      onCommit: (v) => {
        live.value = v as string;
      },
    });
    sc.value = 3;
    await nextTick();
    expect(commits).toEqual([]);
  });
});

describe("useAsDecimal — initial mount does not auto-correct", () => {
  it("model='10.999' + scale=2: model stays untouched, rawValue truncates", () => {
    const type = objectType({ amount: numberProp() });
    const live = ref<string | number | null | undefined>("10.999");
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      scale: () => 2,
      storageScale: () => 3,
      onCommit: (v) => {
        live.value = v as string;
      },
    });
    expect(commits).toEqual([]);
    expect(live.value).toBe("10.999");
    expect(api.rawValue.value).toBe("10.99");
  });
});

describe("useAsDecimal — display + parts", () => {
  it("displayValue uses locale grouping", () => {
    const type = objectType({ amount: numberProp() });
    const { api } = mountWithProbe({
      type,
      modelValue: () => "1234.5",
      scale: () => 2,
      locale: "en-US",
    });
    expect(api.displayValue.value).toBe("1,234.50");
  });

  it("parts splits and groups", () => {
    const type = objectType({ amount: numberProp() });
    const { api } = mountWithProbe({
      type,
      modelValue: () => "1234.5",
      scale: () => 2,
      locale: "en-US",
    });
    expect(api.parts.value).toEqual({ sign: "", integer: "1,234", decimal: "50" });
  });

  it("scale=0 → no decimal part rendered", () => {
    const type = objectType({ amount: numberProp() });
    const { api } = mountWithProbe({
      type,
      modelValue: () => "42",
      scale: () => 0,
      locale: "en-US",
    });
    expect(api.parts.value).toEqual({ sign: "", integer: "42", decimal: "" });
  });
});
