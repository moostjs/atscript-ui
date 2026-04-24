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

  describe("shallow ref for FK fields (refDepth: 0.5)", () => {
    it("emits roleId.ref with target identity and metadata, no nested body", async () => {
      const { InviteStartFormFixture } = await import("./fixtures/wf-forms.as");

      const schema = serializeFormSchema(InviteStartFormFixture) as TSerializedAnnotatedType;
      expect(schema.type.kind).toBe("object");
      if (schema.type.kind !== "object") return;

      const roleId = schema.type.props.roleId as {
        ref?: {
          field: string;
          type: { id: string; metadata: Record<string, unknown>; type?: unknown };
        };
      };
      expect(roleId.ref).toBeDefined();
      expect(roleId.ref!.field).toBe("id");
      expect(roleId.ref!.type.id).toBe("RolesTableFixture");
      expect(roleId.ref!.type.metadata).toBeDefined();
      expect(roleId.ref!.type.metadata["db.http.path"]).toBe("/api/db/tables/roles");
      expect(roleId.ref!.type.type).toBeUndefined();
    });

    it("leaves non-FK fields without a ref and preserves their metadata", async () => {
      const { InviteStartFormFixture } = await import("./fixtures/wf-forms.as");

      const schema = serializeFormSchema(InviteStartFormFixture) as TSerializedAnnotatedType;
      expect(schema.type.kind).toBe("object");
      if (schema.type.kind !== "object") return;

      const email = schema.type.props.email as {
        ref?: unknown;
        metadata?: Record<string, unknown>;
      };
      expect(email.ref).toBeUndefined();
      expect(email.metadata).toBeDefined();
      expect(email.metadata!["meta.label"]).toBe("Email");
      expect(email.metadata!["ui.placeholder"]).toBe("newbie@example.com");
    });

    it("continues to strip @wf.context.pass on forms containing FK refs", async () => {
      const { ContextStripForm } = await import("./fixtures/wf-forms.as");

      const schema = serializeFormSchema(ContextStripForm) as TSerializedAnnotatedType;
      const serialized = JSON.stringify(schema);
      expect(serialized).not.toContain("wf.context.pass");
    });

    it("caches results by type identity (same object returned on repeat)", async () => {
      const { InviteStartFormFixture } = await import("./fixtures/wf-forms.as");

      const first = serializeFormSchema(InviteStartFormFixture);
      const second = serializeFormSchema(InviteStartFormFixture);
      expect(second).toBe(first);
    });

    it("round-trips the shallow ref via deserializeAnnotatedType", async () => {
      const { InviteStartFormFixture } = await import("./fixtures/wf-forms.as");

      const schema = serializeFormSchema(InviteStartFormFixture) as TSerializedAnnotatedType;
      const restored = deserializeAnnotatedType(schema);

      expect(restored.type.kind).toBe("object");
      if (restored.type.kind !== "object") return;

      const roleId = restored.type.props.get("roleId");
      expect(roleId).toBeDefined();
      expect(roleId!.ref).toBeDefined();
      expect(roleId!.ref!.field).toBe("id");
      const target = roleId!.ref!.type();
      expect(target.metadata.get("db.http.path")).toBe("/api/db/tables/roles");
    });
  });
});
