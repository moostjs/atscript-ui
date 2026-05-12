import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { defineAnnotatedType } from "@atscript/typescript/utils";
import { createFormDef } from "@atscript/ui";
import { defineComponent, h, reactive, ref } from "vue";
import AsForm from "../components/as-form.vue";
import { objectType } from "../__tests__/helpers";
import { createDefaultTypes } from "./create-default-types";
import { provideAsLocale } from "./use-as-locale";
import { useAsNumber, type UseAsNumberReturn } from "./use-as-number";

function numberProp() {
  return defineAnnotatedType().designType("number").$type;
}

interface MountOpts {
  type: ReturnType<typeof objectType>;
  initialValue?: Record<string, unknown>;
  modelValue: () => string | number | null | undefined;
  locale?: string;
  onCommit?: (v: number | null) => void;
}

function mountWithProbe(opts: MountOpts) {
  const commits: (number | null)[] = [];
  let api!: UseAsNumberReturn;
  const Probe = defineComponent({
    setup() {
      api = useAsNumber({
        modelValue: opts.modelValue,
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

describe("useAsNumber", () => {
  it("displayValue is separator swap only — no grouping, no padding", () => {
    const type = objectType({ weight: numberProp() });
    const { api } = mountWithProbe({
      type,
      modelValue: () => "1234.5",
      locale: "en-US",
    });
    expect(api.displayValue.value).toBe("1234.5");
  });

  it("setFromInput parses and commits as a number (typeof number)", () => {
    const type = objectType({ weight: numberProp() });
    const live = ref<string | number | null | undefined>("5.5");
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      onCommit: (v) => {
        live.value = v;
      },
    });
    api.setFromInput("9.876");
    expect(commits).toEqual([9.876]);
    expect(typeof commits[0]).toBe("number");
  });

  it("setFromInput number-in → number-out", () => {
    const type = objectType({ weight: numberProp() });
    const live = ref<string | number | null | undefined>(5.5);
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      onCommit: (v) => {
        live.value = v;
      },
    });
    api.setFromInput("9.876");
    expect(commits).toEqual([9.876]);
  });

  it("setFromInput commits a number even when the prior model was null (regression)", () => {
    // Pre-fix: `preserveShape(null, "133.33")` returned the canonical
    // string `"133.33"`, which propagated to the model and tripped
    // validators expecting a `number`. Now `null`-origin still commits
    // as `number`.
    const type = objectType({ weight: numberProp() });
    const live = ref<string | number | null | undefined>(null);
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      onCommit: (v) => {
        live.value = v;
      },
    });
    api.setFromInput("133.33");
    expect(commits).toEqual([133.33]);
    expect(typeof commits[0]).toBe("number");
  });

  it("setFromInput empty → null", () => {
    const type = objectType({ weight: numberProp() });
    const live = ref<string | number | null | undefined>("5.5");
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      onCommit: (v) => {
        live.value = v;
      },
    });
    api.setFromInput("");
    expect(commits).toEqual([null]);
  });

  it("setFromInput rejects non-numeric input (no commit)", () => {
    const type = objectType({ weight: numberProp() });
    const live = ref<string | number | null | undefined>("5.5");
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      onCommit: (v) => {
        live.value = v;
      },
    });
    api.setFromInput("abc");
    expect(commits).toEqual([]);
  });

  it("locale-aware decimal input (fr-FR)", () => {
    const type = objectType({ weight: numberProp() });
    const live = ref<string | number | null | undefined>("0");
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      locale: "fr-FR",
      onCommit: (v) => {
        live.value = v;
      },
    });
    api.setFromInput("4,25");
    expect(commits).toEqual([4.25]);
  });

  it("no scale enforcement — value committed verbatim (as number)", () => {
    const type = objectType({ weight: numberProp() });
    const live = ref<string | number | null | undefined>("0");
    const { api, commits } = mountWithProbe({
      type,
      modelValue: () => live.value,
      onCommit: (v) => {
        live.value = v;
      },
    });
    api.setFromInput("2");
    expect(commits).toEqual([2]); // not padded
    api.setFromInput("4");
    expect(commits).toEqual([2, 4]);
  });

  it("displayValue swaps `.` to `,` in fr-FR", () => {
    const type = objectType({ weight: numberProp() });
    const { api } = mountWithProbe({
      type,
      modelValue: () => "9.5",
      locale: "fr-FR",
    });
    expect(api.displayValue.value).toBe("9,5");
  });
});
