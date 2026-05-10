import { describe, expect, it } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import AsForm from "../components/as-form.vue";
import { createAsFormDef } from "../composables/create-as-form-def";
import { createDefaultTypes } from "../composables/create-default-types";
import { useAsErrorDismiss, type AsErrorDismiss } from "../composables/use-as-error-dismiss";
import { useAsPath, type UseAsPathReturn } from "../composables/use-as-path";
import { useAsTypeMap, type UseAsTypeMapReturn } from "../composables/use-as-type-map";
import { objectType, stringProp } from "./helpers";

/** Mount a Probe component that captures the result of `useFn()`. */
function mountProbe<T>(useFn: () => T): { captured: T } {
  const out: { captured?: T } = {};
  const Probe = defineComponent({
    setup() {
      out.captured = useFn();
      return () => h("div");
    },
  });
  mount(Probe);
  return out as { captured: T };
}

/** Mount the Probe inside an `<AsForm>` so `inject()` resolves to the form's providers. */
function mountProbeInForm<T>(
  useFn: () => T,
  formProps: Record<string, unknown> = {},
): { captured: T; wrapper: VueWrapper } {
  const out: { captured?: T } = {};
  const Probe = defineComponent({
    setup() {
      out.captured = useFn();
      return () => h("div");
    },
  });
  const type = objectType({ name: stringProp() });
  const { def, formData } = createAsFormDef(type);
  const wrapper = mount(AsForm as unknown as typeof AsForm, {
    props: { def, formData, types: createDefaultTypes() as never, ...formProps },
    slots: { "form.before": () => h(Probe) },
  });
  return { captured: out.captured as T, wrapper };
}

describe("useAsPath", () => {
  it("returns '' when called outside a form", () => {
    const { captured } = mountProbe<UseAsPathReturn>(() => useAsPath());
    expect(captured.path.value).toBe("");
  });

  it("returns the form's prefix when mounted under <AsForm>", () => {
    const { captured } = mountProbeInForm<UseAsPathReturn>(() => useAsPath());
    // Root prefix is the empty string per as-form.vue:124-126.
    expect(captured.path.value).toBe("");
  });
});

describe("useAsTypeMap", () => {
  it("returns the provided types map when mounted under <AsForm>", () => {
    const { captured } = mountProbeInForm<UseAsTypeMapReturn>(() => useAsTypeMap());
    const types = createDefaultTypes();
    // The injected ComputedRef unwraps the same map AsForm published; compare
    // by content (Vue may wrap in a reactive proxy, breaking reference identity).
    expect(captured.types.value).toEqual(types);
    expect(Object.keys(captured.types.value).toSorted()).toEqual(Object.keys(types).toSorted());
  });

  it("returns an empty object outside a form", () => {
    const { captured } = mountProbe<UseAsTypeMapReturn>(() => useAsTypeMap());
    expect(captured.types.value).toEqual({});
  });
});

describe("useAsErrorDismiss", () => {
  it("returns a no-op when called outside a form (does not throw)", () => {
    const { captured } = mountProbe<AsErrorDismiss>(() => useAsErrorDismiss());
    expect(typeof captured).toBe("function");
    expect(() => captured("some.path")).not.toThrow();
  });

  it("calls the form's dismissExternalAt provider, hiding the dismissed leaf error", async () => {
    const { captured, wrapper } = mountProbeInForm<AsErrorDismiss>(() => useAsErrorDismiss(), {
      errors: { name: "Server says no" },
    });

    // Sanity: the input renders the server error.
    expect(wrapper.html()).toContain("Server says no");

    captured("name");
    await nextTick();
    expect(wrapper.html()).not.toContain("Server says no");
  });
});
