import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, reactive } from "vue";
import { createFormDef } from "@atscript/ui";
import AsForm from "../components/as-form.vue";
import { createDefaultTypes } from "../composables/create-default-types";
import { useAsAmount } from "../composables/use-as-amount";
import type { TAsComponentProps } from "../components/types";
import { objectType, stringProp } from "./helpers";
import { defineAnnotatedType } from "@atscript/typescript/utils";

/**
 * Customer-reuse contract — a third-party component built against
 * `TAsComponentProps` should be able to call `useAsAmount` without any
 * support from `<AsAmount>`. Proves the composable surface stands on its
 * own and a customer's design system swap is a one-import change.
 */
const MyMoneyField = defineComponent({
  // Accept the full TAsComponentProps surface — AsField passes ~25 keys; we
  // can't list them all by hand, so declare the runtime keys we read.
  props: {
    model: { type: Object, required: true },
    currencyCode: { type: String, default: undefined },
    currencyRefField: { type: String, default: undefined },
    precisionScale: { type: Number, default: undefined },
    inputId: { type: String, default: undefined },
  },
  setup(props: TAsComponentProps<number | null | undefined>) {
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

function amountProp() {
  // Build the field's annotated type with the @db.amount.currency.ref
  // annotation up-front so `createFormDef` dispatches it to the `amount`
  // slot — the customer-reuse contract is what `<AsField>` does once
  // dispatch resolves.
  return defineAnnotatedType()
    .designType("number")
    .tags("number")
    .annotate("db.amount.currency.ref" as keyof AtscriptMetadata, "currency" as never).$type;
}

describe("useAsAmount — customer-reuse contract", () => {
  it("a custom component built against useAsAmount renders inside AsForm", async () => {
    const type = objectType({
      currency: stringProp(),
      total: amountProp(),
    });
    const def = createFormDef(type);
    // Sanity check — dispatch must resolve `total` to the `amount` slot;
    // otherwise AsField would render the default `text` / `number` input
    // and the rest of the assertions would silently target the wrong DOM.
    const totalField = def.fields.find((f) => f.name === "total");
    expect(totalField?.type).toBe("amount");
    const formData = reactive({ value: { currency: "EUR", total: 99.5 } }) as {
      value: Record<string, unknown>;
    };
    const types = {
      ...createDefaultTypes(),
      // Customer overrides the `amount` slot with their own component.
      // No AsAmount wrapper, no AsFieldShell wiring — just useAsAmount.
      amount: MyMoneyField,
      // Currency picker is `text` here (no @ui.type 'select'), but the
      // dispatch only matters for `total`. Stub `text` so the test focuses
      // on the amount-side behaviour.
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

    // Live re-format when the sibling currency mutates.
    formData.value.currency = "GBP";
    await nextTick();
    expect(code.text()).toBe("GBP");

    // Type into the amount input — round-trips through useAsAmount.
    const amountInput = wrapper.find(".my-money-input").element as HTMLInputElement;
    amountInput.value = "12.34";
    await wrapper.find(".my-money-input").trigger("input");
    expect(formData.value.total).toBe(12.34);
  });
});
