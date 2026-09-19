import { createFormDef } from "@atscript/ui";
import { mount } from "@vue/test-utils";
import { defineComponent, h, reactive } from "vue";
import { describe, expect, it } from "vitest";
import AsForm from "../components/as-form.vue";
import type { TAsComponentProps } from "../components/types";
import { createDefaultTypes } from "../composables/create-default-types";
import { objectType, stringProp } from "./helpers";

/**
 * `<AsField>` must take the value-help target from the FIELD DEF
 * (`FormFieldDef.valueHelpInfo`, resolved once by `createFormDef`) instead of
 * re-walking the prop's `@db.rel.FK` / `.ref` chain at every mount.
 *
 * The def below is hand-adjusted so the two sources DISAGREE: the prop carries
 * no annotations at all, so an annotation walk would yield `undefined`. If the
 * `valueHelp` prop still arrives at the control, it can only have come from the
 * def.
 */
describe("AsField — value help comes from the field def", () => {
  it("forwards FormFieldDef.valueHelpInfo to the control as `valueHelp`", async () => {
    let seen: unknown = "not-rendered";
    const Capture = defineComponent({
      props: { valueHelp: { type: Object, default: undefined } },
      setup(props: Partial<TAsComponentProps>) {
        seen = props.valueHelp;
        return () => h("span", "ref-control");
      },
    });

    const def = createFormDef(objectType({ authorId: stringProp() }));
    const field = def.fields.find((f) => f.path === "authorId")!;
    // Sanity: nothing on the prop resolves to value help.
    expect(field.valueHelpInfo).toBeUndefined();
    field.type = "ref";
    field.valueHelpInfo = { url: "/authors", targetField: "id" };

    const formData = reactive({ value: { authorId: "a1" } });
    mount(AsForm as any, {
      props: {
        def,
        formData,
        types: { ...createDefaultTypes(), ref: Capture } as any,
      },
    });

    expect(seen).toEqual({ url: "/authors", targetField: "id" });
  });
});
