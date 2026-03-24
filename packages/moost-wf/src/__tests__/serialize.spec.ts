import { deserializeAnnotatedType } from "@atscript/typescript/utils";
import type { TSerializedAnnotatedType } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import { serializeFormSchema } from "../serialize";

describe("serializeFormSchema", () => {
  it("serializes a simple form type", async () => {
    const { LoginForm } = await import("./fixtures/wf-forms.as");

    const schema = serializeFormSchema(LoginForm);
    expect(schema).toBeDefined();
    expect(typeof schema).toBe("object");
  });

  it("strips @wf.context.pass from serialized output", async () => {
    const { ContextStripForm } = await import("./fixtures/wf-forms.as");
    const schema = serializeFormSchema(ContextStripForm) as TSerializedAnnotatedType;
    const metaKeys = Object.keys(schema.metadata || {});
    expect(metaKeys).not.toContain("wf.context.pass");
  });

  it("preserves @ui.* and @meta.* annotations through round-trip", async () => {
    const { ContextStripForm } = await import("./fixtures/wf-forms.as");

    const schema = serializeFormSchema(ContextStripForm) as TSerializedAnnotatedType;
    const restored = deserializeAnnotatedType(schema);
    expect(restored).toBeDefined();
    expect(restored.type.kind).toBe("object");
  });

  it("round-trips: serialize → deserialize preserves type structure", async () => {
    const { LoginForm } = await import("./fixtures/wf-forms.as");

    const schema = serializeFormSchema(LoginForm) as TSerializedAnnotatedType;
    const restored = deserializeAnnotatedType(schema);

    expect(restored.type.kind).toBe("object");
    if (restored.type.kind === "object") {
      expect(restored.type.props.size).toBe(2);
      expect(restored.type.props.has("username")).toBe(true);
      expect(restored.type.props.has("password")).toBe(true);
    }
  });
});
