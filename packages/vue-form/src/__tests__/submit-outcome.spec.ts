import { installDynamicResolver } from "@atscript/ui-fns";
import { createFormData, createFormDef } from "@atscript/ui";
import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { mount } from "@vue/test-utils";
import { beforeAll, describe, expect, it } from "vitest";
import { defineComponent, h, reactive, type ComputedRef } from "vue";
import type { AsFormExposed } from "../components/types";
import {
  useAsForm,
  type TAsFormSubmitResult,
  type UseAsFormReturn,
} from "../composables/use-as-form";
import { useAsTypeMap } from "../composables/use-as-type-map";
import type { TAsFormError, TFormState } from "../composables/types";
import { RequiredForm } from "./fixtures/form-features.as";
import { NormalizedSignup } from "./fixtures/normalized-emits.as";
import { mountForm } from "./helpers";

beforeAll(() => installDynamicResolver());

// A submit emits `submit` or `error` AND returns the same outcome, so a page
// that validates several forms before one save reads each result directly.
describe("<AsForm> submit() returns its outcome", () => {
  it("returns { ok: true, data } with the normalized data `submit` carries", () => {
    const { wrapper, formData } = mountForm(NormalizedSignup, {
      initialValue: { login: "  Ann ", repeat: "ANN" },
    });
    const result = (wrapper.vm as unknown as AsFormExposed).submit();
    expect(result).toEqual({ ok: true, data: { login: "ann", repeat: "ann" } });
    expect(wrapper.emitted("submit")).toEqual([[{ login: "ann", repeat: "ann" }]]);
    expect(wrapper.emitted("error")).toBeUndefined();
    // the form keeps what was typed
    expect(formData.value.login).toBe("  Ann ");
  });

  it("returns { ok: false, errors } with the errors `error` carries", () => {
    const { wrapper } = mountForm(RequiredForm, { initialValue: { name: "" } });
    const result = (wrapper.vm as unknown as AsFormExposed).submit();
    const emitted = wrapper.emitted("error")?.[0]?.[0] as TAsFormError[];
    expect(result).toEqual({ ok: false, errors: emitted });
    expect(emitted.some((e) => e.path === "name" && e.message === "Name is required")).toBe(true);
    expect(wrapper.emitted("submit")).toBeUndefined();
  });

  it("the slot props' submit returns the outcome too", () => {
    let slotSubmit: (() => TAsFormSubmitResult<unknown>) | undefined;
    mountForm(RequiredForm, {
      initialValue: { name: "Bob" },
      slot: (props: { submit: () => TAsFormSubmitResult<unknown> }) => {
        slotSubmit = props.submit;
        return [];
      },
    });
    expect(slotSubmit?.()).toEqual({ ok: true, data: { name: "Bob" } });
  });
});

/** A form root built on `useAsForm` that renders no fields of its own. */
function mountHeadless(
  type: TAtscriptAnnotatedType,
  value: Record<string, unknown>,
  firstValidation?: TFormState["firstValidation"],
) {
  const def = createFormDef(type);
  const formData = reactive({ ...createFormData(type), value });
  const submitted: unknown[] = [];
  const errors: TAsFormError[][] = [];
  let api!: UseAsFormReturn<typeof formData>;
  let typeMap!: ComputedRef<Record<string, unknown>>;

  const Probe = defineComponent({
    setup() {
      typeMap = useAsTypeMap().types;
      return () => h("span");
    },
  });
  const Root = defineComponent({
    setup() {
      // no `types`: nothing here renders through `<AsField>`
      api = useAsForm({
        def: () => def,
        formData: () => formData,
        firstValidation: () => firstValidation,
        emits: {
          submit: (data) => submitted.push(data),
          error: (errs) => errors.push(errs),
        },
      });
      return () => h("form", [h(Probe)]);
    },
  });
  mount(Root);
  return { api, typeMap, submitted, errors };
}

describe("useAsForm without `types`", () => {
  it("provides an empty type map", () => {
    const { typeMap } = mountHeadless(RequiredForm, { name: "Ann" });
    expect(typeMap.value).toEqual({});
  });

  it("onSubmit() returns the outcome it emits", () => {
    const ok = mountHeadless(RequiredForm, { name: "Ann" });
    expect(ok.api.onSubmit()).toEqual({ ok: true, data: { name: "Ann" } });
    expect(ok.submitted).toEqual([{ name: "Ann" }]);

    const failed = mountHeadless(RequiredForm, { name: "" });
    const result = failed.api.onSubmit();
    expect(result.ok).toBe(false);
    expect(result).toEqual({ ok: false, errors: failed.errors[0] });
    expect(failed.submitted).toEqual([]);
  });
});

describe('submit() with firstValidation "none"', () => {
  it("validates nothing: returns ok with the data and emits `submit`", () => {
    const { api, submitted, errors } = mountHeadless(RequiredForm, { name: "" }, "none");
    expect(api.onSubmit()).toEqual({ ok: true, data: { name: "" } });
    expect(submitted).toEqual([{ name: "" }]);
    expect(errors).toEqual([]);
  });
});
