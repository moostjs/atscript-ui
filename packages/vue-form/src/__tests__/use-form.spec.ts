import { describe, expect, it } from "vitest";
import { isReactive } from "vue";
import { META_DEFAULT } from "@atscript/ui-core";
import { useForm } from "../composables/use-form";
import { numberProp, objectType, stringProp } from "./helpers";

describe("useForm", () => {
  it("returns def with correct fields for a simple object type", () => {
    const type = objectType({
      name: stringProp(),
      age: numberProp(),
    });
    const { def } = useForm(type);

    expect(def.fields).toHaveLength(2);
    expect(def.fields[0]!.path).toBe("name");
    expect(def.fields[1]!.path).toBe("age");
  });

  it("returns reactive formData with { value: domainData } wrapper", () => {
    const type = objectType({ name: stringProp() });
    const { formData } = useForm(type);

    expect(formData).toHaveProperty("value");
    expect(isReactive(formData)).toBe(true);
    expect(typeof formData.value).toBe("object");
  });

  it("populates string default as empty string", () => {
    const type = objectType({ name: stringProp() });
    const { formData } = useForm(type);
    const data = formData.value as Record<string, unknown>;

    expect(data.name).toBe("");
  });

  it("populates @meta.default values", () => {
    const type = objectType({
      name: stringProp({ [META_DEFAULT]: "Alice" }),
    });
    const { formData } = useForm(type);
    const data = formData.value as Record<string, unknown>;

    expect(data.name).toBe("Alice");
  });

  it("creates formData without context", () => {
    const type = objectType({
      name: stringProp(),
      count: numberProp(),
    });
    const { formData } = useForm(type);
    const data = formData.value as Record<string, unknown>;

    expect(data.name).toBe("");
    expect(data.count).toBe(0);
  });
});
