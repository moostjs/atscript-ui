import { beforeAll, describe, expect, it } from "vitest";
import { createFormDef, type FormDef, type FormFieldDef } from "@atscript/ui";
import { installDynamicResolver } from "@atscript/ui-fns";
import { defineComponent, h, nextTick } from "vue";
import {
  useAsOptionalField,
  type UseAsOptionalFieldReturn,
} from "../composables/use-as-optional-field";
import { ContainerForm } from "./fixtures/container-renderer.as";
import { mountFormWithProbe } from "./helpers";

beforeAll(() => {
  installDynamicResolver();
});

function field(def: FormDef, path: string): FormFieldDef {
  const f = def.fields.find((x) => x.path === path);
  if (!f) throw new Error(`field ${path} not found`);
  return f;
}

function mountOptional(path: string, initialValue?: unknown) {
  const def = createFormDef(ContainerForm);
  const f = field(def, path);
  const out: { handle?: UseAsOptionalFieldReturn } = {};
  const Probe = defineComponent({
    setup() {
      out.handle = useAsOptionalField(f);
      return () => h("div");
    },
  });
  const { wrapper, formData } = mountFormWithProbe(ContainerForm, () => h(Probe), {
    initialValue,
  });
  return { handle: out.handle!, wrapper, formData, def };
}

describe("useAsOptionalField", () => {
  it("reports `optional` from the field's atscript type", () => {
    const { handle } = mountOptional("optionalSection");
    expect(handle.optional).toBe(true);
  });

  it("reports `optional: false` for a required field", () => {
    const { handle } = mountOptional("profile");
    expect(handle.optional).toBe(false);
  });

  it("toggle(true) writes annotated defaults at the absolute path and emits an `update` change", async () => {
    const { handle, wrapper, formData } = mountOptional("optionalSection");
    expect(formData.value.optionalSection).toBeUndefined();
    expect(handle.enabled.value).toBe(false);

    handle.toggle(true);
    await nextTick();

    // Annotated defaults for OptionalSection → { note: "" }.
    expect(formData.value.optionalSection).toEqual({ note: "" });
    expect(handle.enabled.value).toBe(true);

    const changes = wrapper.emitted("change");
    expect(changes).toBeTruthy();
    const last = changes!.at(-1)!;
    expect(last[0]).toBe("update");
    expect(last[1]).toBe("optionalSection");
    expect(last[2]).toEqual({ note: "" });
  });

  it("toggle(false) clears the field to undefined", async () => {
    const { handle, formData } = mountOptional("optionalSection", {
      optionalSection: { note: "kept" },
    });
    expect(handle.enabled.value).toBe(true);

    handle.toggle(false);
    await nextTick();

    expect(formData.value.optionalSection).toBeUndefined();
    expect(handle.enabled.value).toBe(false);
  });

  it("treats `null` as unset (enabled === false)", async () => {
    const { handle, formData } = mountOptional("optionalSection", { optionalSection: null });
    expect(handle.enabled.value).toBe(false);

    formData.value.optionalSection = { note: "now set" };
    await nextTick();
    expect(handle.enabled.value).toBe(true);
  });
});
