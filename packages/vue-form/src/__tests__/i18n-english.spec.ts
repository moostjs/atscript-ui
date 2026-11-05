import { describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { defineAnnotatedType } from "@atscript/typescript/utils";
import { mountForm, objectType, stringProp, arrayType } from "./helpers";

/**
 * Untranslated (no provider, no served texts) the built-in texts render
 * exactly as they always did: the snapshots were recorded before the texts
 * moved to `AS_UI_MESSAGES`. Whitespace at the very start / end of an
 * element's content is not compared (it does not render, and a template
 * interpolation on its own line has none).
 */
const edges = (html: string) =>
  html.replace(/(<[a-zA-Z][^>]*>)\s+/g, "$1").replace(/\s+(<\/)/g, "$1");
function booleanProp() {
  const h = defineAnnotatedType().designType("boolean");
  h.annotate("meta.readonly" as never, true as never);
  return h.$type;
}

describe("built-in English texts are unchanged", () => {
  it("arrays: add / remove / clear", async () => {
    const { PhonesArrayForm, OptionalLabelArrayForm, RequiredArrayForm } =
      await import("./fixtures/array-forms.as");
    const phones = mountForm(PhonesArrayForm);
    await phones.wrapper.find(".as-array-add-btn").trigger("click");
    await nextTick();
    expect(edges(phones.wrapper.html())).toMatchSnapshot();
    expect(edges(mountForm(OptionalLabelArrayForm).wrapper.html())).toMatchSnapshot();
    const required = mountForm(RequiredArrayForm);
    required.formData.value.tags = ["a"];
    await nextTick();
    expect(edges(required.wrapper.html())).toMatchSnapshot();
    const items = mountForm(objectType({ items: arrayType(stringProp()) }));
    items.formData.value.items = ["a", "b"];
    await nextTick();
    expect(edges(items.wrapper.html())).toMatchSnapshot();
  });

  it("unions and tuples: variant picker, add, unset", async () => {
    const { RequiredObjectUnionForm, OptionalObjectUnionForm, PrimitiveUnionForm, UnionArrayForm } =
      await import("./fixtures/union-forms.as");
    const { RequiredTupleForm, OptionalTupleForm } = await import("./fixtures/array-forms.as");
    for (const type of [
      RequiredObjectUnionForm,
      OptionalObjectUnionForm,
      PrimitiveUnionForm,
      UnionArrayForm,
      RequiredTupleForm,
      OptionalTupleForm,
    ]) {
      expect(edges(mountForm(type).wrapper.html())).toMatchSnapshot();
    }
  });

  it("multiselect, optional fields, read-only booleans, the form banner", async () => {
    const { LiteralUnionMultiselect, OptionalMultiselect, TagsForm } =
      await import("./fixtures/multiselect-forms.as");
    const ms = mountForm(LiteralUnionMultiselect);
    expect(edges(ms.wrapper.html())).toMatchSnapshot();
    expect(edges(mountForm(OptionalMultiselect).wrapper.html())).toMatchSnapshot();
    expect(edges(mountForm(TagsForm).wrapper.html())).toMatchSnapshot();
    const { OptionalStringField } = await import("./fixtures/optional-init.as");
    expect(edges(mountForm(OptionalStringField).wrapper.html())).toMatchSnapshot();
    const bools = mountForm(objectType({ yes: booleanProp(), no: booleanProp() }), {
      initialValue: { yes: true, no: false },
      errors: { __form: "Account is suspended" },
    });
    expect(edges(bools.wrapper.html())).toMatchSnapshot();
  });

  it("the dirty status", async () => {
    const { PatchScalarForm } = await import("./fixtures/patch-forms.as");
    const { wrapper } = mountForm(PatchScalarForm, {
      initialValue: { name: "Cart", age: 3 },
      trackChanges: true,
    });
    await wrapper
      .findAll("input")
      .find((i) => i.attributes("name") === "name")!
      .setValue("Basket");
    await nextTick();
    expect(edges(wrapper.html())).toMatchSnapshot();
  });
});
