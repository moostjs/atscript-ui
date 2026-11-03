import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { computed, defineComponent, h, nextTick, provide } from "vue";
import AsForm from "../components/as-form.vue";
import { createAsFormDef } from "../composables/create-as-form-def";
import { createDefaultTypes } from "../composables/create-default-types";
import { useAsData, type UseAsDataReturn } from "../composables/use-as-data";
import { useAsFormPatch } from "../composables/use-as-form-patch";
import { PATH_PREFIX_KEY } from "../composables/internal-keys";
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

  it("setSibling() writes next to the current path prefix; the write is tracked and rendered", async () => {
    const type = objectType({
      person: objectType({ name: stringProp(), code: stringProp() }),
    });
    let data!: UseAsDataReturn;
    let patch!: ReturnType<typeof useAsFormPatch>;
    // A custom control inside `person` (its fields render with that prefix).
    const Probe = defineComponent({
      setup() {
        provide(
          PATH_PREFIX_KEY,
          computed(() => "person"),
        );
        const Inner = defineComponent({
          setup() {
            data = useAsData();
            return () => h("div");
          },
        });
        patch = useAsFormPatch();
        return () => h(Inner);
      },
    });
    const { def, formData } = createAsFormDef(type);
    const wrapper = mount(AsForm as unknown as typeof AsForm, {
      props: {
        def,
        formData,
        types: createDefaultTypes() as never,
        trackChanges: true,
      } as never,
      slots: { "form.before": () => h(Probe) },
    });

    data.setSibling("code", "C-1");
    await nextTick();
    expect((formData.value as { person: { code: string } }).person.code).toBe("C-1");
    expect(patch?.isDirtyPath("person.code")).toBe(true);
    expect(patch?.isDirtyPath("person.name")).toBe(false);
    const values = wrapper.findAll("input").map((i) => (i.element as HTMLInputElement).value);
    expect(values).toContain("C-1");
  });

  it("setValueAt() writes an absolute path, creating missing parents", async () => {
    const type = objectType({ foo: stringProp() });
    const { formData, probe } = mountWithProbe(type);
    probe.setValueAt("foo", "set");
    probe.setValueAt("extra.deep", 1);
    await nextTick();
    expect(formData.value).toEqual({ foo: "set", extra: { deep: 1 } });
  });

  it("a write emits AsForm's change event like a committed user edit", async () => {
    const type = objectType({ foo: stringProp() });
    const { wrapper, probe } = mountWithProbe(type);
    probe.setSibling("foo", "picked");
    await nextTick();
    expect(wrapper.emitted("change")?.[0]?.slice(0, 3)).toEqual(["update", "foo", "picked"]);
  });

  it("setValueAt() creates arrays for index segments and an empty root", async () => {
    const type = objectType({ foo: stringProp() });
    const { formData, probe } = mountWithProbe(type);
    probe.setValueAt("rows.0.name", "a");
    await nextTick();
    expect((formData.value as { rows: unknown }).rows).toEqual([{ name: "a" }]);
    (formData as { value: unknown }).value = undefined;
    expect(() => probe.setValueAt("x", 1)).not.toThrow();
    expect(formData.value).toEqual({ x: 1 });
  });

  it("the writers are no-ops outside a form", () => {
    let captured!: UseAsDataReturn;
    const Probe = defineComponent({
      setup() {
        captured = useAsData();
        return () => h("div");
      },
    });
    mount(Probe);
    expect(() => captured.setSibling("foo", 1)).not.toThrow();
    expect(() => captured.setValueAt("foo", 1)).not.toThrow();
  });
});
