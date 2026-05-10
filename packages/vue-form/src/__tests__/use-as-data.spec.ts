import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import AsForm from "../components/as-form.vue";
import { createAsFormDef } from "../composables/create-as-form-def";
import { createDefaultTypes } from "../composables/create-default-types";
import { useAsData, type UseAsDataReturn } from "../composables/use-as-data";
import { objectType, stringProp } from "./helpers";

/** Capture the composable result from inside <AsForm> via a child component. */
function mountWithProbe(type: ReturnType<typeof objectType>) {
  let captured!: UseAsDataReturn;
  const Probe = defineComponent({
    setup() {
      captured = useAsData();
      return () => h("div");
    },
  });
  const { def, formData } = createAsFormDef(type);
  const types = createDefaultTypes() as Record<string, unknown>;
  const wrapper = mount(AsForm as unknown as typeof AsForm, {
    props: { def, formData, types: types as never },
    slots: {
      "form.before": () => h(Probe),
    },
  });
  return {
    wrapper,
    formData,
    get probe() {
      return captured;
    },
  };
}

describe("useAsData", () => {
  it("siblingValue() returns undefined when not under a form", () => {
    let captured!: UseAsDataReturn;
    const Probe = defineComponent({
      setup() {
        captured = useAsData();
        return () => h("div");
      },
    });
    mount(Probe);
    const sibling = captured.siblingValue<number>("foo");
    expect(sibling.value).toBeUndefined();
    expect(captured.rootData.value).toBeUndefined();
  });

  it("siblingValue() returns the leaf value when mounted under <AsForm>", async () => {
    const type = objectType({ foo: stringProp() });
    const { formData, probe } = mountWithProbe(type);
    (formData.value as Record<string, unknown>).foo = "hello";
    await nextTick();
    const sibling = probe.siblingValue<string>("foo");
    expect(sibling.value).toBe("hello");
  });

  it("siblingValue() updates reactively when the underlying value mutates", async () => {
    const type = objectType({ foo: stringProp() });
    const { formData, probe } = mountWithProbe(type);
    const sibling = probe.siblingValue<string>("foo");

    (formData.value as Record<string, unknown>).foo = "first";
    await nextTick();
    expect(sibling.value).toBe("first");

    (formData.value as Record<string, unknown>).foo = "second";
    await nextTick();
    expect(sibling.value).toBe("second");
  });

  it("getValueAt() reads a nested absolute path", async () => {
    const type = objectType({
      person: objectType({ name: stringProp() }),
    });
    const { formData, probe } = mountWithProbe(type);
    const data = formData.value as Record<string, Record<string, unknown>>;
    data.person.name = "Alice";
    await nextTick();
    expect(probe.getValueAt("person.name").value).toBe("Alice");
  });

  it("rootData exposes the unwrapped domain data", async () => {
    const type = objectType({ foo: stringProp() });
    const { formData, probe } = mountWithProbe(type);
    (formData.value as Record<string, unknown>).foo = "x";
    await nextTick();
    expect(probe.rootData.value).toEqual({ foo: "x" });
  });
});
