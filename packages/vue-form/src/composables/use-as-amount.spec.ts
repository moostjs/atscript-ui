import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, reactive, ref } from "vue";
import AsForm from "../components/as-form.vue";
import { createFormDef } from "@atscript/ui";
import { createDefaultTypes } from "./create-default-types";
import { useAsAmount, type UseAsAmountReturn } from "./use-as-amount";
import { objectType, stringProp } from "../__tests__/helpers";
import { defineAnnotatedType } from "@atscript/typescript/utils";

function numberProp(meta?: Record<string, unknown>) {
  const h = defineAnnotatedType().designType("number");
  if (meta) {
    for (const [k, v] of Object.entries(meta)) h.annotate(k as keyof AtscriptMetadata, v as never);
  }
  return h.$type;
}

/** Mount a `<AsForm>` plus a probe that runs `useAsAmount` and exposes the API. */
function mountWithProbe(opts: {
  type: ReturnType<typeof objectType>;
  initialValue?: Record<string, unknown>;
  modelValue: () => number | null | undefined;
  currencyCode?: () => string | undefined;
  currencyRefField?: () => string | undefined;
  precisionScale?: () => number | undefined;
}) {
  const commits: (number | null)[] = [];
  let api!: UseAsAmountReturn;
  const Probe = defineComponent({
    setup() {
      api = useAsAmount({
        modelValue: opts.modelValue,
        currencyCode: opts.currencyCode,
        currencyRefField: opts.currencyRefField,
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
  const wrapper = mount(AsForm as unknown as typeof AsForm, {
    props: { def, formData, types: types as never },
    slots: { "form.before": () => h(Probe) },
  });

  return {
    wrapper,
    formData,
    commits,
    get api() {
      return api;
    },
  };
}

describe("useAsAmount", () => {
  it("static currencyCode wins over the sibling reference", () => {
    const type = objectType({
      currency: stringProp(),
      amount: numberProp(),
    });
    const { api } = mountWithProbe({
      type,
      initialValue: { currency: "EUR", amount: 10 },
      modelValue: () => 10,
      currencyCode: () => "USD",
      currencyRefField: () => "currency",
    });
    expect(api.currency.value).toBe("USD");
    // narrowSymbol resolves to "$" / "€" / etc — non-empty string in any locale
    expect(api.currencySymbol.value).toBeDefined();
    expect(api.currencySymbol.value!.length).toBeGreaterThan(0);
  });

  it("falls back to siblingValue() when no static currencyCode is set", async () => {
    const type = objectType({
      currency: stringProp(),
      amount: numberProp(),
    });
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

  it("returns undefined currency when neither static nor ref resolve", () => {
    const type = objectType({ amount: numberProp() });
    const { api } = mountWithProbe({
      type,
      modelValue: () => 1,
    });
    expect(api.currency.value).toBeUndefined();
    expect(api.currencySymbol.value).toBeUndefined();
  });

  it("step derives from precisionScale", () => {
    const type = objectType({ amount: numberProp() });
    const probe2 = mountWithProbe({
      type,
      modelValue: () => 1,
      precisionScale: () => 2,
    });
    expect(probe2.api.step.value).toBe("0.01");

    const probe0 = mountWithProbe({
      type,
      modelValue: () => 1,
      precisionScale: () => 0,
    });
    expect(probe0.api.step.value).toBe("1");

    const probeNone = mountWithProbe({
      type,
      modelValue: () => 1,
    });
    expect(probeNone.api.step.value).toBeUndefined();
  });

  it("displayValue stringifies number, blanks for null/undefined", () => {
    const type = objectType({ amount: numberProp() });
    const live = ref<number | null | undefined>(42.5);
    const { api } = mountWithProbe({
      type,
      modelValue: () => live.value,
    });
    expect(api.displayValue.value).toBe("42.5");

    live.value = null;
    expect(api.displayValue.value).toBe("");

    live.value = undefined;
    expect(api.displayValue.value).toBe("");
  });

  it("setFromInput parses, rounds to scale, commits", () => {
    const type = objectType({ amount: numberProp() });
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => 0,
      precisionScale: () => 2,
    });

    api.setFromInput("12.345");
    expect(commits).toEqual([12.35]);

    api.setFromInput("");
    expect(commits).toEqual([12.35, null]);

    // Invalid input is ignored — preserves the model.
    api.setFromInput("abc");
    expect(commits).toEqual([12.35, null]);
  });

  it("setFromInput without precisionScale commits the parsed number unchanged", () => {
    const type = objectType({ amount: numberProp() });
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => 0,
    });
    api.setFromInput("1234.5678");
    expect(commits).toEqual([1234.5678]);
  });

  it("handles negative values respecting precision rounding", () => {
    const type = objectType({ amount: numberProp() });
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => 0,
      precisionScale: () => 2,
    });
    api.setFromInput("-7.999");
    expect(commits).toEqual([-8]);
  });
});
