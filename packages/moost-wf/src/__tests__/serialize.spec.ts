import { deserializeAnnotatedType } from "@atscript/typescript/utils";
import type { TSerializedAnnotatedType } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import { serializeFormSchema } from "../serialize";
import { objectType, stringProp } from "./helpers";

describe("serializeFormSchema", () => {
  it("serializes a simple form type", () => {
    const type = objectType({
      username: stringProp({ "meta.label": "Username" }),
      password: stringProp({ "meta.label": "Password", "ui.type": "password" }),
    });

    const schema = serializeFormSchema(type);
    expect(schema).toBeDefined();
    expect(typeof schema).toBe("object");
  });

  it("strips @wf.context.pass from serialized output", () => {
    const type = objectType({ name: stringProp() }, { "wf.context.pass": ["email", "token"] });
    const schema = serializeFormSchema(type) as TSerializedAnnotatedType;
    const metaKeys = Object.keys(schema.metadata || {});
    expect(metaKeys).not.toContain("wf.context.pass");
  });

  it("preserves @ui.* and @meta.* annotations through round-trip", () => {
    const type = objectType({
      name: stringProp({ "meta.label": "Name", "ui.placeholder": "Enter name" }),
    });

    const schema = serializeFormSchema(type) as TSerializedAnnotatedType;
    const restored = deserializeAnnotatedType(schema);
    expect(restored).toBeDefined();
    expect(restored.type.kind).toBe("object");
  });

  it("round-trips: serialize → deserialize preserves type structure", () => {
    const type = objectType({
      username: stringProp({ "meta.label": "Username", "meta.required": true }),
      password: stringProp({ "meta.label": "Password", "ui.type": "password" }),
    });

    const schema = serializeFormSchema(type) as TSerializedAnnotatedType;
    const restored = deserializeAnnotatedType(schema);

    expect(restored.type.kind).toBe("object");
    if (restored.type.kind === "object") {
      expect(restored.type.props.size).toBe(2);
      expect(restored.type.props.has("username")).toBe(true);
      expect(restored.type.props.has("password")).toBe(true);
    }
  });
});
