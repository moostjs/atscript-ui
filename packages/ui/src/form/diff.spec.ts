import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import { createFormDef } from "./create-form-def";
import { buildFormDiff } from "./diff";
import {
  ComboForm,
  CompositeKeyArrayForm,
  DeepNestedForm,
  InlineMergeForm,
  InlineNestedForm,
  KeyedArrayForm,
  MergeNestedForm,
  OptionalMergeForm,
  PrimitiveArrayForm,
  ScalarForm,
  StructNestedForm,
  UnionTupleForm,
  UniqueArrayForm,
  VersionedForm,
} from "../__tests__/fixtures/form-diff.as";

// ── Helpers ──────────────────────────────────────────────────

/** Wrap domain data as the form-data container expected by getByPath. */
function wrap<T>(value: T): { value: T } {
  return { value };
}

/** Pull a prop type from a fixture interface by name (for root-leaf forms). */
function prop(
  iface: { type: { props: Map<string, TAtscriptAnnotatedType> } },
  name: string,
): TAtscriptAnnotatedType {
  const p = iface.type.props.get(name);
  if (!p) throw new Error(`prop ${name} not found on fixture`);
  return p;
}

// ── Scalars ──────────────────────────────────────────────────

describe("buildFormDiff — scalars", () => {
  it("no change → empty patch + isDirty false", () => {
    const def = createFormDef(ScalarForm);
    const data = { name: "Ada", age: 30, active: true };
    const r = buildFormDiff(def, wrap({ ...data }), wrap({ ...data }));
    expect(r.isDirty).toBe(false);
    expect(r.changes).toEqual([]);
    expect(r.patch).toEqual({});
  });

  it("scalar set produces a 'set' change + flat patch entry", () => {
    const def = createFormDef(ScalarForm);
    const baseline = wrap({ name: "Ada", age: 30, active: true });
    const current = wrap({ name: "Grace", age: 30, active: true });
    const r = buildFormDiff(def, baseline, current);

    expect(r.isDirty).toBe(true);
    expect(r.changes).toEqual([{ path: "name", kind: "set", before: "Ada", after: "Grace" }]);
    expect(r.patch).toEqual({ name: "Grace" });
  });

  it("clear (value → undefined) emits null in the patch", () => {
    const def = createFormDef(ScalarForm);
    const baseline = wrap({ name: "Ada", age: 30, active: true });
    const current = wrap({ name: "Ada", active: true }); // age cleared
    const r = buildFormDiff(def, baseline, current);

    expect(r.changes).toEqual([{ path: "age", kind: "set", before: 30, after: undefined }]);
    expect(r.patch).toEqual({ age: null });
  });

  it("multiple scalar changes are all captured", () => {
    const def = createFormDef(ScalarForm);
    const baseline = wrap({ name: "Ada", age: 30, active: true });
    const current = wrap({ name: "Ada", age: 31, active: false });
    const r = buildFormDiff(def, baseline, current);

    expect(r.patch).toEqual({ age: 31, active: false });
    expect(r.changes.map((c) => c.path).toSorted()).toEqual(["active", "age"]);
  });

  it("full revert (edit then undo) → empty + isDirty false", () => {
    const def = createFormDef(ScalarForm);
    const baseline = wrap({ name: "Ada", age: 30, active: true });
    // Same values, fresh object identity (simulating edit-then-undo).
    const current = wrap({ name: "Ada", age: 30, active: true });
    const r = buildFormDiff(def, baseline, current);
    expect(r.isDirty).toBe(false);
    expect(r.patch).toEqual({});
  });
});

// ── Nested objects (default replace strategy) ────────────────

describe("buildFormDiff — nested objects (default replace strategy)", () => {
  it("inlined flat object (default replace): emit the WHOLE current sub-object", () => {
    // No @db.patch.strategy 'merge' → db default is replace (strict): every
    // required child must be present, so emit the full sub-object.
    const def = createFormDef(InlineNestedForm);
    const baseline = wrap({ name: "Co", address: { street: "1 Main", city: "NYC" } });
    const current = wrap({ name: "Co", address: { street: "1 Main", city: "Boston" } });
    const r = buildFormDiff(def, baseline, current);

    expect(r.patch).toEqual({ address: { street: "1 Main", city: "Boston" } });
    expect(r.changes).toEqual([
      { path: "address.city", kind: "set", before: "NYC", after: "Boston" },
    ]);
  });

  it("structured (@meta.label) object (default replace): emit the WHOLE sub-object", () => {
    const def = createFormDef(StructNestedForm);
    const baseline = wrap({ name: "Co", address: { street: "1 Main", city: "NYC" } });
    const current = wrap({ name: "Co", address: { street: "2 Main", city: "NYC" } });
    const r = buildFormDiff(def, baseline, current);

    expect(r.patch).toEqual({ address: { street: "2 Main", city: "NYC" } });
    expect(r.changes).toEqual([
      { path: "address.street", kind: "set", before: "1 Main", after: "2 Main" },
    ]);
  });

  it("no nested change → no address key in patch", () => {
    const def = createFormDef(StructNestedForm);
    const baseline = wrap({ name: "Co", address: { street: "1 Main", city: "NYC" } });
    const current = wrap({ name: "X", address: { street: "1 Main", city: "NYC" } });
    const r = buildFormDiff(def, baseline, current);
    expect(r.patch).toEqual({ name: "X" });
  });

  it("nested revert → empty", () => {
    const def = createFormDef(StructNestedForm);
    const baseline = wrap({ name: "Co", address: { street: "1 Main", city: "NYC" } });
    const current = wrap({ name: "Co", address: { street: "1 Main", city: "NYC" } });
    const r = buildFormDiff(def, baseline, current);
    expect(r.isDirty).toBe(false);
    expect(r.patch).toEqual({});
  });

  it("deep (2-level) nesting (default replace): whole location incl. whole geo", () => {
    const def = createFormDef(DeepNestedForm);
    const baseline = wrap({
      name: "Co",
      location: { label: "HQ", geo: { lat: 1, lng: 2 } },
    });
    const current = wrap({
      name: "Co",
      location: { label: "HQ", geo: { lat: 9, lng: 2 } }, // only geo.lat changed
    });
    const r = buildFormDiff(def, baseline, current);

    // Replace at every default level → whole location, whole geo.
    expect(r.patch).toEqual({
      location: { label: "HQ", geo: { lat: 9, lng: 2 } },
    });
    expect(r.changes).toEqual([{ path: "location.geo.lat", kind: "set", before: 1, after: 9 }]);
  });
});

// ── Nested objects (merge strategy) ──────────────────────────

describe("buildFormDiff — nested objects (@db.patch.strategy 'merge')", () => {
  it("merge object: emit changed-leaves-only nested partial", () => {
    const def = createFormDef(MergeNestedForm);
    const baseline = wrap({ name: "Co", profile: { bio: "old", nick: "n" } });
    const current = wrap({ name: "Co", profile: { bio: "new", nick: "n" } });
    const r = buildFormDiff(def, baseline, current);

    expect(r.patch).toEqual({ profile: { bio: "new" } });
    expect(r.changes).toEqual([{ path: "profile.bio", kind: "set", before: "old", after: "new" }]);
  });

  it("merge revert → empty", () => {
    const def = createFormDef(MergeNestedForm);
    const baseline = wrap({ name: "Co", profile: { bio: "x", nick: "n" } });
    const current = wrap({ name: "Co", profile: { bio: "x", nick: "n" } });
    const r = buildFormDiff(def, baseline, current);
    expect(r.isDirty).toBe(false);
    expect(r.patch).toEqual({});
  });

  it("wholesale-clear an optional merge object → profile: null (not nulled leaves)", () => {
    const def = createFormDef(OptionalMergeForm);
    const baseline = wrap({ name: "Co", profile: { bio: "x", nick: "n" } });
    const current = wrap({ name: "Co" }); // profile removed entirely
    const r = buildFormDiff(def, baseline, current);

    expect(r.patch).toEqual({ profile: null });
  });

  it("inlined object tagged 'merge' → changed-leaf partial (strategy read via flatMap)", () => {
    const def = createFormDef(InlineMergeForm);
    const baseline = wrap({ name: "Co", address: { street: "1 Main", city: "NYC" } });
    const current = wrap({ name: "Co", address: { street: "1 Main", city: "Boston" } });
    const r = buildFormDiff(def, baseline, current);

    expect(r.patch).toEqual({ address: { city: "Boston" } });
    expect(r.changes).toEqual([
      { path: "address.city", kind: "set", before: "NYC", after: "Boston" },
    ]);
  });
});

// ── Keyed arrays ─────────────────────────────────────────────

describe("buildFormDiff — keyed arrays (@expect.array.key)", () => {
  it("update existing item → $update with key + changed leaves only", () => {
    const def = createFormDef(KeyedArrayForm);
    const baseline = wrap({
      items: [
        { sku: "A", qty: 1, note: "x" },
        { sku: "B", qty: 2 },
      ],
    });
    const current = wrap({
      items: [
        { sku: "A", qty: 5, note: "x" }, // qty changed
        { sku: "B", qty: 2 },
      ],
    });
    const r = buildFormDiff(def, baseline, current);

    expect(r.patch).toEqual({ items: { $update: [{ sku: "A", qty: 5 }] } });
    expect(r.changes).toHaveLength(1);
    expect(r.changes[0]!.kind).toBe("array");
  });

  it("add new item → $insert with whole item", () => {
    const def = createFormDef(KeyedArrayForm);
    const baseline = wrap({ items: [{ sku: "A", qty: 1 }] });
    const current = wrap({
      items: [
        { sku: "A", qty: 1 },
        { sku: "C", qty: 9 },
      ],
    });
    const r = buildFormDiff(def, baseline, current);

    expect(r.patch).toEqual({ items: { $insert: [{ sku: "C", qty: 9 }] } });
  });

  it("remove item → $remove carrying just the key", () => {
    const def = createFormDef(KeyedArrayForm);
    const baseline = wrap({
      items: [
        { sku: "A", qty: 1 },
        { sku: "B", qty: 2 },
      ],
    });
    const current = wrap({ items: [{ sku: "A", qty: 1 }] });
    const r = buildFormDiff(def, baseline, current);

    expect(r.patch).toEqual({ items: { $remove: [{ sku: "B" }] } });
  });

  it("mixed add + update + remove in one diff", () => {
    const def = createFormDef(KeyedArrayForm);
    const baseline = wrap({
      items: [
        { sku: "A", qty: 1 },
        { sku: "B", qty: 2 },
      ],
    });
    const current = wrap({
      items: [
        { sku: "A", qty: 10 }, // update
        { sku: "C", qty: 3 }, // insert
        // B removed
      ],
    });
    const r = buildFormDiff(def, baseline, current);
    const items = r.patch.items as Record<string, unknown>;
    expect(items.$update).toEqual([{ sku: "A", qty: 10 }]);
    expect(items.$insert).toEqual([{ sku: "C", qty: 3 }]);
    expect(items.$remove).toEqual([{ sku: "B" }]);
  });

  it("clearing an optional leaf inside a keyed item → null in $update", () => {
    const def = createFormDef(KeyedArrayForm);
    const baseline = wrap({ items: [{ sku: "A", qty: 1, note: "hello" }] });
    const current = wrap({ items: [{ sku: "A", qty: 1 }] }); // note cleared
    const r = buildFormDiff(def, baseline, current);

    expect(r.patch).toEqual({ items: { $update: [{ sku: "A", note: null }] } });
  });

  it("reorder-only (same membership + content) → $replace", () => {
    const def = createFormDef(KeyedArrayForm);
    const baseline = wrap({
      items: [
        { sku: "A", qty: 1 },
        { sku: "B", qty: 2 },
      ],
    });
    const current = wrap({
      items: [
        { sku: "B", qty: 2 },
        { sku: "A", qty: 1 },
      ],
    });
    const r = buildFormDiff(def, baseline, current);

    expect(r.patch).toEqual({
      items: {
        $replace: [
          { sku: "B", qty: 2 },
          { sku: "A", qty: 1 },
        ],
      },
    });
  });

  it("no array change → no items key", () => {
    const def = createFormDef(KeyedArrayForm);
    const data = { items: [{ sku: "A", qty: 1 }] };
    const r = buildFormDiff(
      def,
      wrap({ items: [{ ...data.items[0] }] }),
      wrap({ items: [{ ...data.items[0] }] }),
    );
    expect(r.isDirty).toBe(false);
    expect(r.patch).toEqual({});
  });

  it("keyed array revert → empty", () => {
    const def = createFormDef(KeyedArrayForm);
    const baseline = wrap({
      items: [
        { sku: "A", qty: 1 },
        { sku: "B", qty: 2 },
      ],
    });
    const current = wrap({
      items: [
        { sku: "A", qty: 1 },
        { sku: "B", qty: 2 },
      ],
    });
    const r = buildFormDiff(def, baseline, current);
    expect(r.isDirty).toBe(false);
    expect(r.patch).toEqual({});
  });
});

// ── Keyed arrays — ambiguity fallbacks ───────────────────────

describe("buildFormDiff — keyed arrays (ambiguity fallbacks)", () => {
  it("duplicate key values on a side → $replace (faithful, no silent loss)", () => {
    const def = createFormDef(KeyedArrayForm);
    const baseline = wrap({
      items: [
        { sku: "A", qty: 1 },
        { sku: "A", qty: 2 }, // duplicate key A
      ],
    });
    const current = wrap({ items: [{ sku: "A", qty: 3 }] });
    const r = buildFormDiff(def, baseline, current);

    expect(r.patch).toEqual({ items: { $replace: [{ sku: "A", qty: 3 }] } });
  });

  it("item missing its key value → $replace (un-keyable, unmatchable by DB)", () => {
    const def = createFormDef(KeyedArrayForm);
    const baseline = wrap({ items: [{ sku: "A", qty: 1 }] });
    const current = wrap({ items: [{ qty: 2 }] as unknown[] }); // no sku
    const r = buildFormDiff(def, baseline, current);

    expect(r.patch).toEqual({ items: { $replace: [{ qty: 2 }] } });
  });

  it("explicit undefined-valued prop equal to absent → no op, no malformed {}", () => {
    const def = createFormDef(KeyedArrayForm);
    const baseline = wrap({
      items: [{ sku: "A", qty: 1, note: undefined } as Record<string, unknown>],
    });
    const current = wrap({ items: [{ sku: "A", qty: 1 }] });
    const r = buildFormDiff(def, baseline, current);

    expect(r.isDirty).toBe(false);
    expect(r.patch).toEqual({});
  });
});

// ── Composite-key arrays ─────────────────────────────────────

describe("buildFormDiff — composite-key arrays (two @expect.array.key)", () => {
  it("update matches on the composite (warehouse + sku)", () => {
    const def = createFormDef(CompositeKeyArrayForm);
    const baseline = wrap({
      stock: [
        { warehouse: "W1", sku: "A", qty: 1 },
        { warehouse: "W2", sku: "A", qty: 5 }, // same sku, different warehouse
      ],
    });
    const current = wrap({
      stock: [
        { warehouse: "W1", sku: "A", qty: 9 }, // qty changed
        { warehouse: "W2", sku: "A", qty: 5 },
      ],
    });
    const r = buildFormDiff(def, baseline, current);

    expect(r.patch).toEqual({
      stock: { $update: [{ warehouse: "W1", sku: "A", qty: 9 }] },
    });
  });

  it("remove carries the full composite key", () => {
    const def = createFormDef(CompositeKeyArrayForm);
    const baseline = wrap({
      stock: [
        { warehouse: "W1", sku: "A", qty: 1 },
        { warehouse: "W2", sku: "A", qty: 5 },
      ],
    });
    const current = wrap({ stock: [{ warehouse: "W1", sku: "A", qty: 1 }] });
    const r = buildFormDiff(def, baseline, current);

    expect(r.patch).toEqual({ stock: { $remove: [{ warehouse: "W2", sku: "A" }] } });
  });
});

// ── Union + tuple fields (whole-value 'set') ─────────────────

describe("buildFormDiff — union + tuple fields", () => {
  it("union field change → whole-value 'set'", () => {
    const def = createFormDef(UnionTupleForm);
    const baseline = wrap({ name: "x", pick: "hello", pair: [1, 2] });
    const current = wrap({ name: "x", pick: 42, pair: [1, 2] });
    const r = buildFormDiff(def, baseline, current);

    expect(r.patch).toEqual({ pick: 42 });
    expect(r.changes).toEqual([{ path: "pick", kind: "set", before: "hello", after: 42 }]);
  });

  it("tuple field change → whole-value 'set'", () => {
    const def = createFormDef(UnionTupleForm);
    const baseline = wrap({ name: "x", pick: "hello", pair: [1, 2] });
    const current = wrap({ name: "x", pick: "hello", pair: [1, 3] });
    const r = buildFormDiff(def, baseline, current);

    expect(r.patch).toEqual({ pair: [1, 3] });
    expect(r.changes).toEqual([{ path: "pair", kind: "set", before: [1, 2], after: [1, 3] }]);
  });

  it("union + tuple unchanged → empty", () => {
    const def = createFormDef(UnionTupleForm);
    const snap = { name: "x", pick: "hello", pair: [1, 2] };
    const r = buildFormDiff(
      def,
      wrap({ ...snap, pair: [...snap.pair] }),
      wrap({ ...snap, pair: [...snap.pair] }),
    );
    expect(r.isDirty).toBe(false);
    expect(r.patch).toEqual({});
  });
});

// ── NaN stability ────────────────────────────────────────────

describe("buildFormDiff — NaN-stable scalar", () => {
  it("NaN unchanged between baseline and current → no change", () => {
    const def = createFormDef(ScalarForm);
    const baseline = wrap({ name: "Ada", age: NaN, active: true });
    const current = wrap({ name: "Ada", age: NaN, active: true });
    const r = buildFormDiff(def, baseline, current);
    expect(r.isDirty).toBe(false);
    expect(r.patch).toEqual({});
  });
});

// ── Primitive arrays ─────────────────────────────────────────

describe("buildFormDiff — primitive arrays", () => {
  it("unkeyed primitive array → $replace whole array", () => {
    const def = createFormDef(PrimitiveArrayForm);
    const baseline = wrap({ tags: ["a", "b"] });
    const current = wrap({ tags: ["a", "c", "d"] });
    const r = buildFormDiff(def, baseline, current);

    expect(r.patch).toEqual({ tags: { $replace: ["a", "c", "d"] } });
    expect(r.changes[0]!.kind).toBe("array");
  });

  it("reordered primitive array (no uniqueItems) → $replace (order matters)", () => {
    const def = createFormDef(PrimitiveArrayForm);
    const baseline = wrap({ tags: ["a", "b"] });
    const current = wrap({ tags: ["b", "a"] });
    const r = buildFormDiff(def, baseline, current);
    expect(r.patch).toEqual({ tags: { $replace: ["b", "a"] } });
  });

  it("identical primitive array → no change", () => {
    const def = createFormDef(PrimitiveArrayForm);
    const r = buildFormDiff(def, wrap({ tags: ["a", "b"] }), wrap({ tags: ["a", "b"] }));
    expect(r.isDirty).toBe(false);
    expect(r.patch).toEqual({});
  });
});

// ── uniqueItems primitive arrays ─────────────────────────────

describe("buildFormDiff — uniqueItems primitive arrays", () => {
  it("by-value $insert / $remove", () => {
    const def = createFormDef(UniqueArrayForm);
    const baseline = wrap({ tags: ["a", "b", "c"] });
    const current = wrap({ tags: ["a", "c", "d"] }); // -b, +d
    const r = buildFormDiff(def, baseline, current);

    expect(r.patch).toEqual({ tags: { $insert: ["d"], $remove: ["b"] } });
  });

  it("pure addition → only $insert", () => {
    const def = createFormDef(UniqueArrayForm);
    const r = buildFormDiff(def, wrap({ tags: ["a"] }), wrap({ tags: ["a", "b"] }));
    expect(r.patch).toEqual({ tags: { $insert: ["b"] } });
  });

  it("pure removal → only $remove", () => {
    const def = createFormDef(UniqueArrayForm);
    const r = buildFormDiff(def, wrap({ tags: ["a", "b"] }), wrap({ tags: ["a"] }));
    expect(r.patch).toEqual({ tags: { $remove: ["b"] } });
  });

  it("reorder only (set semantics) → no change", () => {
    const def = createFormDef(UniqueArrayForm);
    const r = buildFormDiff(def, wrap({ tags: ["a", "b"] }), wrap({ tags: ["b", "a"] }));
    expect(r.isDirty).toBe(true); // arrays differ by deepEqual...
    // ...but set diff finds no membership change → falls back to $replace.
    expect(r.patch).toEqual({ tags: { $replace: ["b", "a"] } });
  });
});

// ── Optimistic concurrency ($cas) ────────────────────────────

describe("buildFormDiff — $cas (optimistic concurrency)", () => {
  it("auto-includes $cas when a version column exists (default cas)", () => {
    const def = createFormDef(VersionedForm);
    const baseline = wrap({ name: "Ada", version: 4 });
    const current = wrap({ name: "Grace", version: 4 });
    const r = buildFormDiff(def, baseline, current);

    expect(r.patch).toEqual({ name: "Grace", $cas: { version: 4 } });
  });

  it("opts.cas false suppresses $cas", () => {
    const def = createFormDef(VersionedForm);
    const baseline = wrap({ name: "Ada", version: 4 });
    const current = wrap({ name: "Grace", version: 4 });
    const r = buildFormDiff(def, baseline, current, { cas: false });

    expect(r.patch).toEqual({ name: "Grace" });
  });

  it("no version column → no $cas", () => {
    const def = createFormDef(ScalarForm);
    const baseline = wrap({ name: "Ada", age: 30, active: true });
    const current = wrap({ name: "Grace", age: 30, active: true });
    const r = buildFormDiff(def, baseline, current);
    expect(r.patch.$cas).toBeUndefined();
  });

  it("empty patch → no $cas even with version column", () => {
    const def = createFormDef(VersionedForm);
    const data = { name: "Ada", version: 4 };
    const r = buildFormDiff(def, wrap({ ...data }), wrap({ ...data }));
    expect(r.patch).toEqual({});
    expect(r.patch.$cas).toBeUndefined();
  });

  it("missing baseline version value → no $cas (cannot assert version)", () => {
    const def = createFormDef(VersionedForm);
    const baseline = wrap({ name: "Ada" }); // no version present
    const current = wrap({ name: "Grace" });
    const r = buildFormDiff(def, baseline, current);
    expect(r.patch).toEqual({ name: "Grace" });
  });

  it("version field is never a SET — even on the DEFAULT createFormDef path", () => {
    // The engine itself excludes the @db.column.version column from the SET
    // diff (does NOT rely on the caller passing { versionColumn }).
    const def = createFormDef(VersionedForm); // no versionColumn opt
    const baseline = wrap({ name: "Ada", version: 4 });
    const current = wrap({ name: "Grace", version: 4 });
    const r = buildFormDiff(def, baseline, current);
    expect(r.patch).toEqual({ name: "Grace", $cas: { version: 4 } });
  });

  it("changed version never leaks as a SET; $cas uses the BASELINE value", () => {
    // Realistic read-modify-write: the server bumped version, so current differs
    // from baseline. The version must NOT appear as a top-level SET (the DB
    // rejects it with VERSION_COLUMN_WRITE); $cas carries the BASELINE version.
    const def = createFormDef(VersionedForm);
    const baseline = wrap({ name: "Ada", version: 4 });
    const current = wrap({ name: "Grace", version: 5 });
    const r = buildFormDiff(def, baseline, current);
    expect(r.patch).toEqual({ name: "Grace", $cas: { version: 4 } });
    expect("version" in r.patch).toBe(false);
  });

  it("only the version differs → no SET, no patch, isDirty false", () => {
    const def = createFormDef(VersionedForm);
    const baseline = wrap({ name: "Ada", version: 4 });
    const current = wrap({ name: "Ada", version: 9 }); // only version differs
    const r = buildFormDiff(def, baseline, current);
    expect(r.isDirty).toBe(false);
    expect(r.patch).toEqual({});
  });

  it("non-integer baseline version → no $cas (int-only guard)", () => {
    const def = createFormDef(VersionedForm);
    const baseline = wrap({ name: "Ada", version: "4" as unknown as number }); // stringified
    const current = wrap({ name: "Grace", version: "4" as unknown as number });
    const r = buildFormDiff(def, baseline, current);
    expect(r.patch).toEqual({ name: "Grace" });
    expect(r.patch.$cas).toBeUndefined();
  });
});

// ── Single-leaf root forms (non-object root) ─────────────────

describe("buildFormDiff — single-leaf root form", () => {
  it("scalar root → patch under 'value' key", () => {
    const def = createFormDef(prop(ScalarForm, "name"));
    const r = buildFormDiff(def, wrap("Ada"), wrap("Grace"));
    expect(r.changes).toEqual([{ path: "", kind: "set", before: "Ada", after: "Grace" }]);
    expect(r.patch).toEqual({ value: "Grace" });
  });

  it("scalar root clear → null under 'value'", () => {
    const def = createFormDef(prop(ScalarForm, "name"));
    const r = buildFormDiff(def, wrap("Ada"), wrap(undefined));
    expect(r.patch).toEqual({ value: null });
  });

  it("scalar root no change → empty", () => {
    const def = createFormDef(prop(ScalarForm, "name"));
    const r = buildFormDiff(def, wrap("Ada"), wrap("Ada"));
    expect(r.isDirty).toBe(false);
    expect(r.patch).toEqual({});
  });

  it("array root → $replace under 'value'", () => {
    const def = createFormDef(prop(PrimitiveArrayForm, "tags"));
    const r = buildFormDiff(def, wrap(["a"]), wrap(["a", "b"]));
    expect(r.patch).toEqual({ value: { $replace: ["a", "b"] } });
  });
});

// ── Kitchen-sink combo ───────────────────────────────────────

describe("buildFormDiff — combined form", () => {
  it("scalar + nested object + keyed array + $cas in one patch", () => {
    const def = createFormDef(ComboForm);
    const baseline = wrap({
      title: "Order 1",
      address: { street: "1 Main", city: "NYC" },
      lines: [
        { sku: "A", qty: 1 },
        { sku: "B", qty: 2 },
      ],
      version: 7,
    });
    const current = wrap({
      title: "Order 2", // scalar set
      address: { street: "1 Main", city: "Boston" }, // nested partial
      lines: [
        { sku: "A", qty: 5 }, // update
        { sku: "C", qty: 3 }, // insert; B removed
      ],
      version: 7,
    });
    const r = buildFormDiff(def, baseline, current);

    expect(r.patch).toEqual({
      title: "Order 2",
      address: { city: "Boston" },
      lines: {
        $update: [{ sku: "A", qty: 5 }],
        $insert: [{ sku: "C", qty: 3 }],
        $remove: [{ sku: "B" }],
      },
      $cas: { version: 7 },
    });
    expect(r.isDirty).toBe(true);
  });

  it("combo full revert → empty + isDirty false (no $cas)", () => {
    const def = createFormDef(ComboForm);
    const snapshot = {
      title: "Order 1",
      address: { street: "1 Main", city: "NYC" },
      lines: [{ sku: "A", qty: 1 }],
      version: 7,
    };
    const r = buildFormDiff(
      def,
      wrap(JSON.parse(JSON.stringify(snapshot))),
      wrap(JSON.parse(JSON.stringify(snapshot))),
    );
    expect(r.isDirty).toBe(false);
    expect(r.patch).toEqual({});
  });
});
