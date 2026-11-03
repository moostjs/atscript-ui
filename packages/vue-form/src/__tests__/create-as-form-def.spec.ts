import { describe, expect, it } from "vitest";
import { isReactive } from "vue";
import { createAsFormDef } from "../composables/create-as-form-def";
import { objectType, stringProp } from "./helpers";

const paths = (def: { fields: { path: string }[] }) => def.fields.map((f) => f.path);

describe("createAsFormDef", () => {
  it("returns def with correct fields for a simple object type", async () => {
    const { MultiFieldForm } = await import("./fixtures/defaults-form.as");
    const { def } = createAsFormDef(MultiFieldForm);

    expect(def.fields).toHaveLength(2);
    expect(def.fields[0]!.path).toBe("name");
    expect(def.fields[1]!.path).toBe("age");
  });

  it("returns reactive formData with { value: domainData } wrapper", () => {
    const type = objectType({ name: stringProp() });
    const { formData } = createAsFormDef(type);

    expect(formData).toHaveProperty("value");
    expect(isReactive(formData)).toBe(true);
    expect(typeof formData.value).toBe("object");
  });

  it("populates string default as empty string", () => {
    const type = objectType({ name: stringProp() });
    const { formData } = createAsFormDef(type);
    const data = formData.value as Record<string, unknown>;

    expect(data.name).toBe("");
  });

  it("populates @meta.default values", async () => {
    const { DefaultsForm } = await import("./fixtures/defaults-form.as");
    const { formData } = createAsFormDef(DefaultsForm);
    const data = formData.value as Record<string, unknown>;

    expect(data.name).toBe("Alice");
  });

  it("creates formData without context", async () => {
    const { MultiFieldForm } = await import("./fixtures/defaults-form.as");
    const { formData } = createAsFormDef(MultiFieldForm);
    const data = formData.value as Record<string, unknown>;

    expect(data.name).toBe("");
    expect(data.age).toBe(0);
  });

  it("forwards createFormDef options (mode, versionColumn) as the third argument", async () => {
    const { PatchVersionedForm } = await import("./fixtures/patch-forms.as");
    expect(paths(createAsFormDef(PatchVersionedForm).def)).toContain("version");
    // Edit mode: the @db.column.version field is the version column by default.
    const edit = createAsFormDef(PatchVersionedForm, undefined, { mode: "edit" });
    expect(paths(edit.def)).not.toContain("version");
    const explicit = createAsFormDef(PatchVersionedForm, {}, { versionColumn: "version" });
    expect(paths(explicit.def)).not.toContain("version");
    // The data keeps the column either way (it travels in `$cas`).
    expect(edit.formData.value).toHaveProperty("version");
  });
});
