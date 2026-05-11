import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { defineAnnotatedType } from "@atscript/typescript/utils";
import { createFormDef } from "@atscript/ui";
import { defineComponent, h, nextTick, reactive, ref } from "vue";
import AsForm from "../components/as-form.vue";
import { objectType, stringProp } from "../__tests__/helpers";
import { createDefaultTypes } from "./create-default-types";
import { provideAsLocale } from "./use-as-locale";
import { useAsAmount, type UseAsAmountReturn } from "./use-as-amount";

function numberProp(meta?: Record<string, unknown>) {
  const h = defineAnnotatedType().designType("number");
  if (meta) {
    for (const [k, v] of Object.entries(meta)) h.annotate(k as keyof AtscriptMetadata, v as never);
  }
  return h.$type;
}

interface MountOpts {
  type: ReturnType<typeof objectType>;
  initialValue?: Record<string, unknown>;
  modelValue: () => string | number | null | undefined;
  currencyCode?: () => string | undefined;
  currencyRefField?: () => string | undefined;
  precisionScale?: () => number | undefined;
  locale?: string;
  /** Optional model writer (so probes can stash commits back into formData). */
  onCommit?: (v: string | number | null) => void;
}

function mountWithProbe(opts: MountOpts) {
  const commits: (string | number | null)[] = [];
  let api!: UseAsAmountReturn;
  const Probe = defineComponent({
    setup() {
      api = useAsAmount({
        modelValue: opts.modelValue,
        currencyCode: opts.currencyCode,
        currencyRefField: opts.currencyRefField,
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
  // Mount AsForm so `useAsData()` can find a form context (the composable
  // reads sibling currency via `useAsData`).
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

describe("useAsAmount — resolved data", () => {
  it("static currencyCode wins over sibling reference", () => {
    const type = objectType({ currency: stringProp(), amount: numberProp() });
    const { api } = mountWithProbe({
      type,
      initialValue: { currency: "EUR", amount: 10 },
      modelValue: () => 10,
      currencyCode: () => "USD",
      currencyRefField: () => "currency",
    });
    expect(api.currency.value).toBe("USD");
    expect(api.currencySymbol.value).toBeDefined();
    expect(api.currencySymbol.value!.length).toBeGreaterThan(0);
  });

  it("siblingValue() resolves reactively", async () => {
    const type = objectType({ currency: stringProp(), amount: numberProp() });
    const { api, formData } = mountWithProbe({
      type,
      initialValue: { currency: "EUR", amount: 10 },
      modelValue: () => 10,
      currencyRefField: () => "currency",
    });
    expect(api.currency.value).toBe("EUR");
    formData.value.currency = "GBP";
    await nextTick();
    expect(api.currency.value).toBe("GBP");
  });

  it("returns undefined currency when neither static nor ref resolves", () => {
    const type = objectType({ amount: numberProp() });
    const { api } = mountWithProbe({ type, modelValue: () => 1 });
    expect(api.currency.value).toBeUndefined();
    expect(api.currencySymbol.value).toBeUndefined();
  });
});

describe("useAsAmount — scale resolution", () => {
  it("EUR + db3 → effective 2 (currency wins; cap by min)", () => {
    const type = objectType({ amount: numberProp() });
    const { api } = mountWithProbe({
      type,
      modelValue: () => 0,
      currencyCode: () => "EUR",
      precisionScale: () => 3,
    });
    expect(api.scale.value).toBe(2);
    expect(api.storageScale.value).toBe(3);
  });

  it("JPY + db3 → effective 0", () => {
    const type = objectType({ amount: numberProp() });
    const { api } = mountWithProbe({
      type,
      modelValue: () => 0,
      currencyCode: () => "JPY",
      precisionScale: () => 3,
    });
    expect(api.scale.value).toBe(0);
    expect(api.storageScale.value).toBe(3);
  });

  it("BHD + db3 → effective 3", () => {
    const type = objectType({ amount: numberProp() });
    const { api } = mountWithProbe({
      type,
      modelValue: () => 0,
      currencyCode: () => "BHD",
      precisionScale: () => 3,
    });
    expect(api.scale.value).toBe(3);
    expect(api.storageScale.value).toBe(3);
  });

  it("USD + db1 → effective 1 (db wins as the smaller cap)", () => {
    const type = objectType({ amount: numberProp() });
    const { api } = mountWithProbe({
      type,
      modelValue: () => 0,
      currencyCode: () => "USD",
      precisionScale: () => 1,
    });
    expect(api.scale.value).toBe(1);
    expect(api.storageScale.value).toBe(1);
  });

  it("undefined + undefined → fallback 2", () => {
    const type = objectType({ amount: numberProp() });
    const { api } = mountWithProbe({ type, modelValue: () => 0 });
    expect(api.scale.value).toBe(2);
    expect(api.storageScale.value).toBe(2);
  });
});

describe("useAsAmount — commit paths preserve storage shape", () => {
  it("string in → string out, padded to storageScale", () => {
    const type = objectType({ amount: numberProp() });
    const live = ref<string | number | null | undefined>("10.5");
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      currencyCode: () => "USD",
      precisionScale: () => 3,
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
      currencyCode: () => "USD",
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
      currencyCode: () => "USD",
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
      currencyCode: () => "EUR",
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
      currencyCode: () => "USD",
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
      currencyCode: () => "USD",
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
      currencyCode: () => "USD",
      precisionScale: () => 3,
      onCommit: (v) => {
        live.value = v as string;
      },
    });
    api.setFromParts("", "1234", "56");
    // scale=2 (USD wins), storage=3 → "1234.560"
    expect(commits).toEqual(["1234.560"]);
  });

  it("setFromParts strips non-digit chars (defensive)", () => {
    const type = objectType({ amount: numberProp() });
    const live = ref<string | number | null | undefined>("0");
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      currencyCode: () => "USD",
      onCommit: (v) => {
        live.value = v as string;
      },
    });
    api.setFromParts("-", "1,234", "56");
    expect(commits).toEqual(["-1234.56"]);
  });
});

describe("useAsAmount — currency-change re-rounding", () => {
  it("EUR → JPY (scale shrinks 2→0) re-commits truncated value", async () => {
    const type = objectType({ amount: numberProp() });
    const live = ref<string | number | null | undefined>("10.99");
    const curr = ref<string | undefined>("EUR");
    const { commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      currencyCode: () => curr.value,
      precisionScale: () => 3,
      onCommit: (v) => {
        live.value = v as string;
      },
    });
    expect(commits).toEqual([]);
    curr.value = "JPY";
    await nextTick();
    // scale shrinks 2→0; storage stays 3 → "10.000"
    expect(commits).toEqual(["10.000"]);
  });

  it("EUR → BHD (scale grows 2→3) does NOT re-commit", async () => {
    const type = objectType({ amount: numberProp() });
    const live = ref<string | number | null | undefined>("10.99");
    const curr = ref<string | undefined>("EUR");
    const { commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      currencyCode: () => curr.value,
      precisionScale: () => 3,
      onCommit: (v) => {
        live.value = v as string;
      },
    });
    curr.value = "BHD";
    await nextTick();
    expect(commits).toEqual([]);
  });
});

describe("useAsAmount — initial mount does not auto-correct", () => {
  it("model='10.999' + EUR + db3: model stays untouched, rawValue truncates for display", () => {
    const type = objectType({ amount: numberProp() });
    const live = ref<string | number | null | undefined>("10.999");
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      currencyCode: () => "EUR",
      precisionScale: () => 3,
      onCommit: (v) => {
        live.value = v as string;
      },
    });
    expect(commits).toEqual([]);
    // Model is untouched.
    expect(live.value).toBe("10.999");
    // rawValue is truncated to effective scale (EUR=2) for display only.
    expect(api.rawValue.value).toBe("10.99");
  });
});

describe("useAsAmount — display + parts", () => {
  it("displayValue uses locale grouping", () => {
    const type = objectType({ amount: numberProp() });
    const { api } = mountWithProbe({
      type,
      modelValue: () => "1234.5",
      currencyCode: () => "USD",
      locale: "en-US",
    });
    expect(api.displayValue.value).toBe("1,234.50");
  });

  it("parts splits and groups", () => {
    const type = objectType({ amount: numberProp() });
    const { api } = mountWithProbe({
      type,
      modelValue: () => "1234.5",
      currencyCode: () => "USD",
      locale: "en-US",
    });
    expect(api.parts.value).toEqual({ sign: "", integer: "1,234", decimal: "50" });
  });
});
