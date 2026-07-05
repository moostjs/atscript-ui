import { beforeAll, describe, expect, it } from "vitest";
import { createFormDef, type FormDef, type FormFieldDef } from "@atscript/ui";
import { installDynamicResolver } from "@atscript/ui-fns";
import { defineComponent, h, nextTick, type ComputedRef } from "vue";
import { useAsVisibleFields } from "../composables/use-as-visible-fields";
import { ContainerForm } from "./fixtures/container-renderer.as";
import { mountFormWithProbe } from "./helpers";

beforeAll(() => {
  installDynamicResolver();
});

/** Mount a probe that partitions `pick(def)` via useAsVisibleFields. */
function mountVisible(pick: (def: FormDef) => FormFieldDef[], initialValue?: unknown) {
  const def = createFormDef(ContainerForm);
  const fields = pick(def);
  const out: { visible?: ComputedRef<FormFieldDef[]> } = {};
  const Probe = defineComponent({
    setup() {
      out.visible = useAsVisibleFields(fields);
      return () => h("div");
    },
  });
  const { formData } = mountFormWithProbe(ContainerForm, () => h(Probe), { initialValue });
  return { visible: out.visible!, formData, def };
}

const paths = (list: FormFieldDef[]) => list.map((f) => f.path);

describe("useAsVisibleFields", () => {
  it("excludes a statically hidden (@ui.form.hidden) field", () => {
    const { visible } = mountVisible((def) => def.fields);
    expect(paths(visible.value)).not.toContain("secret");
    // A plain leaf stays visible.
    expect(paths(visible.value)).toContain("title");
  });

  it("toggles a @ui.form.fn.hidden field reactively when the controlling flag changes", async () => {
    // fn hidden on `advanced` is `(v, data) => data.showAdvanced !== true`.
    const { visible, formData } = mountVisible((def) => def.fields, { showAdvanced: false });
    expect(paths(visible.value)).not.toContain("advanced");

    formData.value.showAdvanced = true;
    await nextTick();
    expect(paths(visible.value)).toContain("advanced");

    formData.value.showAdvanced = false;
    await nextTick();
    expect(paths(visible.value)).not.toContain("advanced");
  });

  it("returns all fields when none carry fn.hidden and no form data is populated", () => {
    // Only static leaves — the computed never subscribes to form data.
    const { visible } = mountVisible((def) =>
      def.fields.filter((f) => f.path === "title" || f.path === "staticHinted"),
    );
    expect(paths(visible.value)).toEqual(["title", "staticHinted"]);
  });

  it("returns an empty array for an undefined field list", () => {
    const { visible } = mountVisible(() => undefined as unknown as FormFieldDef[]);
    expect(visible.value).toEqual([]);
  });
});
