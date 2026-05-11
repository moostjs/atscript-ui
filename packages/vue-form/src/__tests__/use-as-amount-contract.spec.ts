import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { defineAnnotatedType } from "@atscript/typescript/utils";
import { createFormDef } from "@atscript/ui";
import { defineComponent, h, nextTick, reactive } from "vue";
import AsForm from "../components/as-form.vue";
import type { TAsComponentProps } from "../components/types";
import { createDefaultTypes } from "../composables/create-default-types";
import { useAsAmount } from "../composables/use-as-amount";
import { objectType, stringProp } from "./helpers";

/**
 * Customer-reuse contract — a third-party component built against
 * `TAsComponentProps` should be able to call `useAsAmount` without any
 * support from `<AsAmount>`. Proves the composable surface stands on its
 * own and a customer's design system swap is a one-import change.
 *
 * Two cases are covered:
 *
 * 1. **Single-input swap** — only consumes
 *    `{ currency, currencySymbol, displayValue, setFromInput }`. Proves the
 *    composable is render-choice-agnostic: customers building their own
 *    one-input UX don't need any of the parts/parts-based commit path.
 *
 * 2. **Two-input swap** — consumes
 *    `{ scale, decimalSeparator, parts, setFromParts }` for the bank UX
 *    shape that our default ships. Both swaps run through the same
 *    composable, just consuming different slices of the API.
 */

const MySingleInputMoneyField = defineComponent({
  props: {
    model: { type: Object, required: true },
    currencyCode: { type: String, default: undefined },
    currencyRefField: { type: String, default: undefined },
    precisionScale: { type: Number, default: undefined },
    inputId: { type: String, default: undefined },
  },
  setup(props: TAsComponentProps<string | number | null | undefined>) {
    const { currency, currencySymbol, displayValue, setFromInput } = useAsAmount({
      modelValue: () => props.model.value,
      currencyCode: () => props.currencyCode,
      currencyRefField: () => props.currencyRefField,
      precisionScale: () => props.precisionScale,
      onCommit: (v) => {
        props.model.value = v;
      },
    });
    return () =>
      h("div", { class: "my-money-field" }, [
        h("span", { class: "my-money-symbol" }, currencySymbol.value ?? ""),
        h("span", { class: "my-money-code" }, currency.value ?? ""),
        h("input", {
          class: "my-money-input",
          value: displayValue.value,
          onInput: (e: Event) => setFromInput((e.target as HTMLInputElement).value),
        }),
      ]);
  },
});

const MyTwoInputMoneyField = defineComponent({
  props: {
    model: { type: Object, required: true },
    currencyCode: { type: String, default: undefined },
    currencyRefField: { type: String, default: undefined },
    precisionScale: { type: Number, default: undefined },
    inputId: { type: String, default: undefined },
  },
  setup(props: TAsComponentProps<string | number | null | undefined>) {
    const { currencySymbol, scale, decimalSeparator, parts, setFromParts } = useAsAmount({
      modelValue: () => props.model.value,
      currencyCode: () => props.currencyCode,
      currencyRefField: () => props.currencyRefField,
      precisionScale: () => props.precisionScale,
      onCommit: (v) => {
        props.model.value = v;
      },
    });
    return () =>
      h("div", { class: "my-two-input-money" }, [
        h("span", { class: "my-two-symbol" }, currencySymbol.value ?? ""),
        h("input", {
          class: "my-two-integer",
          value: parts.value.integer,
          onInput: (e: Event) => {
            const intDigits = (e.target as HTMLInputElement).value.replace(/\D/g, "");
            setFromParts(parts.value.sign, intDigits, parts.value.decimal);
          },
        }),
        scale.value > 0 ? h("span", { class: "my-two-sep" }, decimalSeparator.value) : null,
        scale.value > 0
          ? h("input", {
              class: "my-two-decimal",
              value: parts.value.decimal,
              onInput: (e: Event) => {
                const decDigits = (e.target as HTMLInputElement).value
                  .replace(/\D/g, "")
                  .slice(0, scale.value);
                setFromParts(parts.value.sign, parts.value.integer, decDigits);
              },
            })
          : null,
      ]);
  },
});

function amountProp() {
  return defineAnnotatedType()
    .designType("number")
    .tags("number")
    .annotate("db.amount.currency.ref" as keyof AtscriptMetadata, "currency" as never).$type;
}

describe("useAsAmount — customer-reuse contract", () => {
  it("single-input swap proves render-choice-agnostic composable", async () => {
    const type = objectType({
      currency: stringProp(),
      total: amountProp(),
    });
    const def = createFormDef(type);
    const totalField = def.fields.find((f) => f.name === "total");
    expect(totalField?.type).toBe("amount");
    const formData = reactive({ value: { currency: "EUR", total: 99.5 } }) as {
      value: Record<string, unknown>;
    };
    const types = {
      ...createDefaultTypes(),
      amount: MySingleInputMoneyField,
      text: defineComponent({
        props: ["model"] as unknown as never,
        setup(props: TAsComponentProps) {
          return () =>
            h("input", {
              class: "currency-input",
              value: props.model.value as string,
              onInput: (e: Event) => {
                props.model.value = (e.target as HTMLInputElement).value;
              },
            });
        },
      }),
    };

    const wrapper = mount(AsForm as unknown as typeof AsForm, {
      props: { def, formData, types: types as never },
    });

    const symbol = wrapper.find(".my-money-symbol");
    const code = wrapper.find(".my-money-code");
    expect(symbol.exists()).toBe(true);
    expect(code.text()).toBe("EUR");

    formData.value.currency = "GBP";
    await nextTick();
    expect(code.text()).toBe("GBP");

    const amountInput = wrapper.find(".my-money-input").element as HTMLInputElement;
    amountInput.value = "12.34";
    await wrapper.find(".my-money-input").trigger("input");
    expect(formData.value.total).toBe(12.34);
  });

  it("two-input swap commits through setFromParts", async () => {
    const type = objectType({
      currency: stringProp(),
      total: amountProp(),
    });
    const def = createFormDef(type);
    const formData = reactive({ value: { currency: "EUR", total: 0 } }) as {
      value: Record<string, unknown>;
    };
    const types = {
      ...createDefaultTypes(),
      amount: MyTwoInputMoneyField,
      text: defineComponent({
        props: ["model"] as unknown as never,
        setup(props: TAsComponentProps) {
          return () =>
            h("input", {
              class: "currency-input-2",
              value: props.model.value as string,
              onInput: (e: Event) => {
                props.model.value = (e.target as HTMLInputElement).value;
              },
            });
        },
      }),
    };

    const wrapper = mount(AsForm as unknown as typeof AsForm, {
      props: { def, formData, types: types as never },
    });

    const intInput = wrapper.find(".my-two-integer").element as HTMLInputElement;
    intInput.value = "42";
    await wrapper.find(".my-two-integer").trigger("input");
    expect(formData.value.total).toBe(42);

    const decInput = wrapper.find(".my-two-decimal").element as HTMLInputElement;
    decInput.value = "50";
    await wrapper.find(".my-two-decimal").trigger("input");
    expect(formData.value.total).toBe(42.5);
  });
});
