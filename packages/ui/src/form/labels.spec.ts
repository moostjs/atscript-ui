import { defineAnnotatedType } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import { UI_FORM_LABEL_SINGULAR } from "../shared/annotation-keys";
import { resolveSingularLabel } from "./labels";

describe("resolveSingularLabel", () => {
  it('falls back to "item" when the annotation is absent', () => {
    const prop = defineAnnotatedType().designType("string").$type;
    expect(resolveSingularLabel(prop)).toBe("item");
  });

  it("returns the annotated singular when present", () => {
    const prop = defineAnnotatedType().designType("string").$type;
    prop.metadata.set(UI_FORM_LABEL_SINGULAR as keyof AtscriptMetadata, "phone number" as never);
    expect(resolveSingularLabel(prop)).toBe("phone number");
  });
});
