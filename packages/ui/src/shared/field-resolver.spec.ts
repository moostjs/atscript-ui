import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import { HiddenObject, SimpleObject } from "../__tests__/fixtures/create-form-def.as";
import { UI_FORM_HIDDEN } from "./annotation-keys";
import { hasFieldMeta, isFieldHidden } from "./field-resolver";

/** Pull a prop type from a fixture interface by name. */
function prop(
  iface: { type: { props: Map<string, TAtscriptAnnotatedType> } },
  name: string,
): TAtscriptAnnotatedType {
  const p = iface.type.props.get(name);
  if (!p) throw new Error(`prop ${name} not found on fixture`);
  return p;
}

// Static resolution only — no dynamic resolver installed, so these exercise
// the StaticFieldResolver / direct-metadata paths (`@ui.form.hidden` presence).

describe("hasFieldMeta", () => {
  it("returns true when the metadata key is present", () => {
    expect(hasFieldMeta(prop(HiddenObject, "secret"), UI_FORM_HIDDEN)).toBe(true);
  });

  it("returns false when the metadata key is absent", () => {
    expect(hasFieldMeta(prop(HiddenObject, "visible"), UI_FORM_HIDDEN)).toBe(false);
    expect(hasFieldMeta(prop(SimpleObject, "name"), UI_FORM_HIDDEN)).toBe(false);
  });
});

describe("isFieldHidden (static path)", () => {
  it("returns true for a prop carrying static @ui.form.hidden", () => {
    expect(isFieldHidden(prop(HiddenObject, "secret"), {})).toBe(true);
  });

  it("returns false for a prop without the hidden annotation", () => {
    expect(isFieldHidden(prop(HiddenObject, "visible"), {})).toBe(false);
    expect(isFieldHidden(prop(SimpleObject, "name"), {})).toBe(false);
  });
});
