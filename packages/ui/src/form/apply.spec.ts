import { describe, expect, it } from "vitest";
import { createFormDef } from "./create-form-def";
import { buildFormDiff } from "./diff";
import { applyFormChanges } from "./apply";
import {
  RebaseArrayForm,
  RebaseComboForm,
  RebaseScalarForm,
} from "../__tests__/fixtures/form-rebase.as";

/** Wrap domain data as the form-data container expected by getByPath. */
function wrap<T>(value: T): { value: T } {
  return { value };
}

describe("applyFormChanges — set", () => {
  it("applies a scalar 'set' change onto a clone", () => {
    const def = createFormDef(RebaseScalarForm);
    const data = wrap<Record<string, unknown>>({ name: "Ada", age: 30 });
    applyFormChanges(def, data, [{ path: "name", kind: "set", before: "Ada", after: "Grace" }]);
    expect(data.value).toEqual({ name: "Grace", age: 30 });
  });

  it("mutates the supplied container in place and returns it", () => {
    const def = createFormDef(RebaseScalarForm);
    const data = wrap<Record<string, unknown>>({ name: "Ada" });
    const out = applyFormChanges(def, data, [
      { path: "name", kind: "set", before: "Ada", after: "Bob" },
    ]);
    expect(out).toBe(data);
    expect(data.value).toEqual({ name: "Bob" });
  });

  it("sets a nested leaf (vivifies intermediate object)", () => {
    const def = createFormDef(RebaseComboForm);
    const data = wrap<Record<string, unknown>>({ name: "Co", profile: { bio: "x", nick: "n" } });
    applyFormChanges(def, data, [{ path: "profile.bio", kind: "set", before: "x", after: "y" }]);
    expect(data.value).toEqual({ name: "Co", profile: { bio: "y", nick: "n" } });
  });
});

describe("applyFormChanges — undefined → delete (own-key discipline)", () => {
  it("deletes the own key rather than leaving a present undefined", () => {
    const def = createFormDef(RebaseScalarForm);
    const data = wrap<Record<string, unknown>>({ name: "Ada", age: 30 });
    applyFormChanges(def, data, [{ path: "age", kind: "set", before: 30, after: undefined }]);
    // Key is GONE — not present-with-undefined.
    expect("age" in (data.value as Record<string, unknown>)).toBe(false);
    expect(data.value).toEqual({ name: "Ada" });
  });

  it("a cleared leaf re-diffs identically to a never-present field (deepEqual stays in sync)", () => {
    const def = createFormDef(RebaseScalarForm);
    // Baseline never had `age`; current cleared it via applyFormChanges.
    const cleared = wrap<Record<string, unknown>>({ name: "Ada", age: 30 });
    applyFormChanges(def, cleared, [{ path: "age", kind: "set", before: 30, after: undefined }]);
    const neverHad = wrap<Record<string, unknown>>({ name: "Ada" });
    // Diffing the two must be clean — both structurally lack `age`.
    expect(buildFormDiff(def, neverHad, cleared).isDirty).toBe(false);
  });

  it("deletes a nested leaf own-key", () => {
    const def = createFormDef(RebaseComboForm);
    const data = wrap<Record<string, unknown>>({ name: "Co", profile: { bio: "x", nick: "n" } });
    applyFormChanges(def, data, [
      { path: "profile.nick", kind: "set", before: "n", after: undefined },
    ]);
    expect(
      "nick" in ((data.value as Record<string, unknown>).profile as Record<string, unknown>),
    ).toBe(false);
    expect(data.value).toEqual({ name: "Co", profile: { bio: "x" } });
  });

  it("delete on a missing ancestor is a no-op (no vivification)", () => {
    const def = createFormDef(RebaseComboForm);
    const data = wrap<Record<string, unknown>>({ name: "Co" });
    applyFormChanges(def, data, [
      { path: "profile.bio", kind: "set", before: "x", after: undefined },
    ]);
    // No `profile` key conjured.
    expect(data.value).toEqual({ name: "Co" });
  });
});

describe("applyFormChanges — array (whole-array set)", () => {
  it("replaces the whole array with change.after", () => {
    const def = createFormDef(RebaseArrayForm);
    const data = wrap<Record<string, unknown>>({ items: [{ sku: "A", qty: 1 }] });
    const after = [
      { sku: "A", qty: 1 },
      { sku: "B", qty: 2 },
    ];
    applyFormChanges(def, data, [
      { path: "items", kind: "array", before: [{ sku: "A", qty: 1 }], after },
    ]);
    expect(data.value).toEqual({ items: after });
  });
});

describe("applyFormChanges — multiple changes", () => {
  it("applies a batch of changes in order", () => {
    const def = createFormDef(RebaseScalarForm);
    const data = wrap<Record<string, unknown>>({ name: "Ada", nick: "A", age: 30 });
    applyFormChanges(def, data, [
      { path: "name", kind: "set", before: "Ada", after: "Grace" },
      { path: "nick", kind: "set", before: "A", after: undefined },
      { path: "age", kind: "set", before: 30, after: 31 },
    ]);
    expect(data.value).toEqual({ name: "Grace", age: 31 });
  });
});
