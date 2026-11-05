import { describe, expect, it } from "vitest";
import { defineAnnotatedType } from "@atscript/typescript/utils";
import { mountForm, objectType } from "./helpers";

function booleanProp(labels?: Record<string, string>, readonly = true) {
  const h = defineAnnotatedType().designType("boolean");
  if (readonly) h.annotate("meta.readonly" as never, true as never);
  for (const [value, label] of Object.entries(labels ?? {})) {
    h.annotate("ui.literalLabel" as never, { value, label } as never, true);
  }
  return h.$type;
}

describe("AsCheckbox — booleans keep the checkbox; read-only shows the label", () => {
  const type = objectType({
    active: booleanProp({ true: "Active", false: "Inactive" }),
    plain: booleanProp(),
    editable: booleanProp({ true: "Active" }, false),
  });

  it("a read-only boolean reads as its @ui.literalLabel label, Yes / No by default", () => {
    const { wrapper } = mountForm(type, {
      initialValue: { active: true, plain: false, editable: true },
    });
    const values = wrapper.findAll(".as-checkbox-value").map((v) => v.text());
    expect(values).toEqual(["Active", "No"]);
    // no toggleable checkbox for a read-only field
    expect(wrapper.find('input[name="active"]').exists()).toBe(false);
    // the value is labelled by the field label
    const value = wrapper.find(".as-checkbox-value");
    const labelId = value.attributes("aria-labelledby");
    expect(wrapper.find(`[id="${labelId}"]`).text()).toBe("active");
    expect(wrapper.find('input[name="plain"]').exists()).toBe(false);
  });

  it("an editable boolean stays a checkbox (not a select)", () => {
    const { wrapper } = mountForm(type, {
      initialValue: { active: false, plain: true, editable: true },
    });
    const input = wrapper.find('input[name="editable"]');
    expect(input.attributes("type")).toBe("checkbox");
    expect((input.element as HTMLInputElement).checked).toBe(true);
    expect(wrapper.find('select[name="editable"]').exists()).toBe(false);
    const values = wrapper.findAll(".as-checkbox-value").map((v) => v.text());
    expect(values).toEqual(["Inactive", "Yes"]);
  });
});

/** Read-only, labelled Active / Inactive. */
function labelled(h: ReturnType<typeof defineAnnotatedType>) {
  h.annotate("meta.readonly" as never, true as never);
  h.annotate("ui.literalLabel" as never, { value: "true", label: "Active" } as never, true);
  h.annotate("ui.literalLabel" as never, { value: "false", label: "Inactive" } as never, true);
  return h.$type;
}

describe("AsCheckbox — labels of the enclosing prop (boolean | null, boolean[])", () => {
  const bool = () => defineAnnotatedType().designType("boolean").$type;

  it("a read-only `boolean | null` shows the union prop's label", () => {
    const type = objectType({
      maybe: labelled(
        defineAnnotatedType("union")
          .item(bool())
          .item(defineAnnotatedType().designType("null").$type),
      ),
    });
    const { wrapper } = mountForm(type, { initialValue: { maybe: false } });
    expect(wrapper.findAll(".as-checkbox-value").map((v) => v.text())).toEqual(["Inactive"]);
  });

  it("read-only `boolean[]` items show the array prop's labels", () => {
    // `@meta.readonly` on the array does not reach its items: mark the element read-only
    const item = defineAnnotatedType().designType("boolean");
    item.annotate("meta.readonly" as never, true as never);
    const type = objectType({ flags: labelled(defineAnnotatedType("array").of(item.$type)) });
    const { wrapper } = mountForm(type, { initialValue: { flags: [true, false] } });
    expect(wrapper.findAll(".as-checkbox-value").map((v) => v.text())).toEqual([
      "Active",
      "Inactive",
    ]);
  });
});

describe("select / radio over a boolean or a number union write the typed value", () => {
  it("a radio on a boolean writes `false`, not `'false'`, with the labels", async () => {
    const flag = defineAnnotatedType().designType("boolean");
    flag.annotate("ui.form.type" as never, "radio" as never);
    flag.annotate("ui.literalLabel" as never, { value: "false", label: "Inactive" } as never, true);
    const { wrapper, formData } = mountForm(objectType({ active: flag.$type }), {
      initialValue: { active: true },
    });
    const labels = wrapper.findAll(".as-radio-group label").map((l) => l.text());
    expect(labels).toEqual(["Yes", "Inactive"]);
    const radios = wrapper.findAll('input[type="radio"]');
    expect((radios[0].element as HTMLInputElement).checked).toBe(true);
    await radios[1].setValue(true);
    expect(formData.value.active).toBe(false);
  });

  it("a select on a number literal union writes a number", async () => {
    const level = defineAnnotatedType("union")
      .item(defineAnnotatedType().designType("number").value(1).$type)
      .item(defineAnnotatedType().designType("number").value(2).$type).$type;
    const { wrapper, formData } = mountForm(objectType({ level }), {
      initialValue: { level: 1 },
    });
    const select = wrapper.find("select");
    expect((select.element as HTMLSelectElement).selectedIndex).toBeGreaterThanOrEqual(0);
    await select.setValue("2"); // the DOM value is text; the model gets the typed literal
    expect(formData.value.level).toBe(2);
  });
});

describe("AsCheckbox — a read-only optional boolean offers no clear button", () => {
  it("hides the optional clear when read-only", () => {
    const h = defineAnnotatedType().designType("boolean").optional();
    h.annotate("meta.readonly" as never, true as never);
    const { wrapper } = mountForm(objectType({ opt: h.$type }), { initialValue: { opt: true } });
    expect(wrapper.find(".as-checkbox-value").text()).toBe("Yes");
    expect(wrapper.findAll(".as-checkbox-row button")).toHaveLength(0);
  });
});
