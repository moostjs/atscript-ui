import { ClientValidationError, ClientValidator } from "@atscript/db-client/validator";
import type { TAtscriptAnnotatedType, TAtscriptTypeObject } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import { createFormDef } from "./create-form-def";
import { buildFormDiff, deepEqual } from "./diff";
import {
  ComboForm,
  CompositeKeyArrayForm,
  DeepNestedForm,
  DissolvedHolderForm,
  InlineMergeForm,
  InlineNestedForm,
  JsonArrayForm,
  KeyedArrayForm,
  MergeCompositeKeyArrayForm,
  MergeNestedForm,
  MergeOrderLinesForm,
  MergeParcelLinesForm,
  MergePlacementsForm,
  MergeTreeNode,
  NestedKeyedArraysForm,
  OptionalMergeForm,
  OrderLinesForm,
  ParcelLinesForm,
  PrimitiveArrayForm,
  RenamedVersionForm,
  ScalarForm,
  StructNestedForm,
  UnionTupleForm,
  UniqueArrayForm,
  UnsetForm,
  VersionedForm,
} from "../__tests__/fixtures/form-diff.as";
import { CountedRow, StampedRow } from "../__tests__/fixtures/update-stamps.as";

// ── Helpers ──────────────────────────────────────────────────

/** Wrap domain data as the form-data container expected by getByPath. */
function wrap<T>(value: T): { value: T } {
  return { value };
}

/** The patch of `KeyedArrayForm` for an `items` baseline → current. */
function diffItems(before: unknown[], after: unknown[]) {
  return buildFormDiff(
    createFormDef(KeyedArrayForm),
    wrap({ items: before }),
    wrap({ items: after }),
  ).patch;
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

  // No leaf differs (every one is unset on both sides), yet the object goes
  // from stored to removed: the removal is the change, so a save gated on
  // `isDirty` can send the clear.
  it.each([
    ["all leaves null", { bio: null, nick: null }],
    ["no leaves", {}],
  ])("wholesale-clear an optional object with %s → dirty, profile: null", (_name, profile) => {
    const def = createFormDef(OptionalMergeForm);
    const baseline = wrap({ name: "Co", profile });
    const current = wrap({ name: "Co" });
    const r = buildFormDiff(def, baseline, current);

    expect(r.isDirty).toBe(true);
    expect(r.changes).toEqual([
      { path: "profile", kind: "set", before: profile, after: undefined },
    ]);
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
  it("update existing item (default replace strategy) → $update carries the whole current element", () => {
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

    expect(r.patch).toStrictEqual({ items: { $update: [{ sku: "A", qty: 5, note: "x" }] } });
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

  it("mixed add + update + remove in one diff (the update is the whole element)", () => {
    const def = createFormDef(KeyedArrayForm);
    const baseline = wrap({
      items: [
        { sku: "A", qty: 1, note: "keep" },
        { sku: "B", qty: 2 },
      ],
    });
    const current = wrap({
      items: [
        { sku: "A", qty: 10, note: "keep" }, // update (note unchanged)
        { sku: "C", qty: 3 }, // insert
        // B removed
      ],
    });
    const r = buildFormDiff(def, baseline, current);
    expect(r.patch).toStrictEqual({
      items: {
        $update: [{ sku: "A", qty: 10, note: "keep" }],
        $insert: [{ sku: "C", qty: 3 }],
        $remove: [{ sku: "B" }],
      },
    });
  });

  it("clearing an optional leaf inside a keyed item (default replace strategy) → the whole element without it", () => {
    const def = createFormDef(KeyedArrayForm);
    const baseline = wrap({ items: [{ sku: "A", qty: 1, note: "hello" }] });
    const current = wrap({ items: [{ sku: "A", qty: 1 }] }); // note cleared
    const r = buildFormDiff(def, baseline, current);

    expect(r.patch).toStrictEqual({ items: { $update: [{ sku: "A", qty: 1 }] } });
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

// ── Unset values ─────────────────────────────────────────────

// Since 0.1.176 `null`, `undefined` and an absent prop are one value (unset):
// a field stored as `null` that the form holds as `undefined` (an emptied input
// of an optional field) is no change, at every depth. A stored `""` is a value.
describe("buildFormDiff — unset values", () => {
  const diff = (before: unknown, after: unknown) =>
    buildFormDiff(createFormDef(UnsetForm), wrap(before), wrap(after));

  it("stored null, held undefined → no change at the top level, in a nested object, an unkeyed and a keyed row", () => {
    const r = diff(
      {
        note: null,
        profile: { bio: "b", nick: null },
        lines: [{ label: "L", note: null }],
        items: [{ sku: "A", qty: 1, note: null }],
      },
      {
        note: undefined,
        profile: { bio: "b", nick: undefined },
        lines: [{ label: "L", note: undefined }],
        items: [{ sku: "A", qty: 1, note: undefined }],
      },
    );
    expect(r.isDirty).toBe(false);
    expect(r.changes).toEqual([]);
    expect(r.patch).toEqual({});
  });

  it("an optional prop emptied to undefined in an unkeyed row equals the absent prop → no no-op $replace", () => {
    const base = { profile: { bio: "b" }, lines: [{ label: "L" }], items: [] };
    const r = diff(base, { ...base, lines: [{ label: "L", note: undefined }] });
    expect(r.isDirty).toBe(false);
    expect(r.patch).toEqual({});
  });

  it('a stored "" held as undefined is a change — cleared (null / left out of the row), at every depth', () => {
    const r = diff(
      {
        note: "",
        profile: { bio: "b", nick: "" },
        lines: [{ label: "L", note: "" }],
        items: [{ sku: "A", qty: 1, note: "" }],
      },
      {
        profile: { bio: "b" },
        lines: [{ label: "L" }],
        items: [{ sku: "A", qty: 1 }],
      },
    );
    expect(r.patch).toStrictEqual({
      note: null,
      profile: { nick: null },
      lines: { $replace: [{ label: "L" }] },
      items: { $update: [{ sku: "A", qty: 1 }] },
    });
  });

  it('deepEqual: null, undefined and an absent prop are equal; "", 0 and {} are values', () => {
    expect(deepEqual(null, undefined)).toBe(true);
    expect(deepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: null })).toBe(true);
    expect(deepEqual([{ a: null }], [{}])).toBe(true);
    expect(deepEqual({ a: "" }, {})).toBe(false);
    expect(deepEqual({}, { a: "" })).toBe(false);
    expect(deepEqual("", undefined)).toBe(false);
    expect(deepEqual({ a: 0 }, { a: null })).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual({ constructor: 1 }, {})).toBe(false);
    expect(deepEqual({}, { constructor: 1 })).toBe(false);
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

  // Pins the single-key behaviour, unchanged by 0.1.176 (there one missing key
  // value is all of them).
  it("single key (unchanged): a null key value on either side → $replace; complete keys keep the key operators", () => {
    const nullKey = { sku: null, qty: 2 };
    expect(diffItems([{ sku: "A", qty: 1 }], [{ sku: "A", qty: 1 }, nullKey])).toStrictEqual({
      items: { $replace: [{ sku: "A", qty: 1 }, nullKey] },
    });
    expect(diffItems([nullKey], [{ sku: "A", qty: 1 }])).toStrictEqual({
      items: { $replace: [{ sku: "A", qty: 1 }] },
    });
    expect(diffItems([{ sku: "A", qty: 1 }], [{ sku: "A", qty: 4 }])).toStrictEqual({
      items: { $update: [{ sku: "A", qty: 4 }] },
    });
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

// ── Keyed arrays — order the key operators cannot express ────

describe("buildFormDiff — keyed arrays (order: key operators or $replace)", () => {
  const A = { sku: "A", qty: 1 };
  const B = { sku: "B", qty: 2 };
  const C = { sku: "C", qty: 3 };

  it("a reorder whose only other difference is an undefined-valued prop vs an absent one → $replace (the reorder is kept)", () => {
    expect(diffItems([A, { ...B, note: undefined }], [B, A])).toStrictEqual({
      items: { $replace: [B, A] },
    });
  });

  it("editing the key of a row that is not last → $replace (a remove + insert would store it last)", () => {
    const after = [{ sku: "A2", qty: 1 }, B];
    expect(diffItems([A, B], after)).toStrictEqual({ items: { $replace: after } });
  });

  it("editing the key of the last row stays $remove + $insert", () => {
    expect(diffItems([A, B], [A, C])).toStrictEqual({
      items: { $insert: [C], $remove: [{ sku: "B" }] },
    });
  });

  it("a row removed and a new row with its key added at the end → $replace ($update would keep its old place)", () => {
    const after = [B, { sku: "A", qty: 9 }];
    expect(diffItems([A, B], after)).toStrictEqual({ items: { $replace: after } });
  });

  it("a new row inserted at the start → $replace", () => {
    expect(diffItems([A, B], [C, A, B])).toStrictEqual({ items: { $replace: [C, A, B] } });
  });

  it("a new row inserted in the middle → $replace", () => {
    expect(diffItems([A, B], [A, C, B])).toStrictEqual({ items: { $replace: [A, C, B] } });
  });

  it("a new row appended at the end stays $insert, next to a removal", () => {
    const D = { sku: "D", qty: 4 };
    expect(diffItems([A, B, C], [A, C, D])).toStrictEqual({
      items: { $insert: [D], $remove: [{ sku: "B" }] },
    });
  });
});

// ── Keyed arrays — $update item per patch strategy ───────────

describe("buildFormDiff — keyed array $update item follows the array's @db.patch.strategy", () => {
  const lineA = { sku: "A", qty: 1, price: 10, note: "gift" };
  const lineB = { sku: "B", qty: 2, price: 5 };
  const diffLines = (form: TAtscriptAnnotatedType, before: unknown[], after: unknown[]) =>
    buildFormDiff(createFormDef(form), wrap({ lines: before }), wrap({ lines: after }));

  describe("default (replace) strategy — the whole current element", () => {
    it("one field of one element changed → $update carries every leaf of it, unchanged required and optional ones included", () => {
      const r = diffLines(
        OrderLinesForm,
        [{ ...lineA }, { ...lineB }],
        [{ ...lineA, qty: 3 }, { ...lineB }],
      );

      expect(r.patch).toStrictEqual({
        lines: { $update: [{ sku: "A", qty: 3, price: 10, note: "gift" }] },
      });
      expect(r.changes).toHaveLength(1);
      expect(r.changes[0]!.path).toBe("lines");
    });

    it("only an optional leaf changed → the item still carries the unchanged required fields", () => {
      const r = diffLines(
        OrderLinesForm,
        [{ ...lineA }, { ...lineB }],
        [{ ...lineA }, { ...lineB, note: "rush" }],
      );

      expect(r.patch).toStrictEqual({
        lines: { $update: [{ sku: "B", qty: 2, price: 5, note: "rush" }] },
      });
    });

    it("an optional leaf set to undefined (the optional toggle, an emptied optional number/date input) → the item lacks the leaf", () => {
      const r = diffLines(OrderLinesForm, [{ ...lineA }], [{ ...lineA, note: undefined }]);

      const item = (r.patch.lines as { $update: Record<string, unknown>[] }).$update[0]!;
      expect(item).toStrictEqual({ sku: "A", qty: 1, price: 10 });
      expect(item).not.toHaveProperty("note");
    });

    it("a leaf cleared to null (an emptied required number/date input) → the item carries the null", () => {
      const r = diffLines(OrderLinesForm, [{ ...lineA }], [{ ...lineA, qty: null, note: null }]);

      expect(r.patch).toStrictEqual({
        lines: { $update: [{ sku: "A", qty: null, price: 10, note: null }] },
      });
    });

    it("a leaf inside an element's nested object changed → the whole element, the nested object whole", () => {
      const r = diffLines(
        ParcelLinesForm,
        [{ sku: "P", qty: 1, size: { w: 1, h: 2 } }],
        [{ sku: "P", qty: 1, size: { w: 9, h: 2 } }],
      );

      expect(r.patch).toStrictEqual({
        lines: { $update: [{ sku: "P", qty: 1, size: { w: 9, h: 2 } }] },
      });
    });

    it("an optional leaf removed from the element → the item lacks the leaf, never null", () => {
      const { note: _note, ...withoutNote } = lineA;
      const r = diffLines(OrderLinesForm, [{ ...lineA }], [withoutNote]);

      expect(r.patch).toStrictEqual({ lines: { $update: [{ sku: "A", qty: 1, price: 10 }] } });
    });

    it("an explicit undefined-valued prop vs an absent one is no change → no op", () => {
      const r = diffLines(OrderLinesForm, [{ ...lineB }], [{ ...lineB, note: undefined }]);

      expect(r.isDirty).toBe(false);
      expect(r.patch).toEqual({});
    });
  });

  describe("@db.patch.strategy 'merge' — the key + the changed leaves", () => {
    it("one field of one element changed → $update carries the key + that leaf only", () => {
      const r = diffLines(
        MergeOrderLinesForm,
        [{ ...lineA }, { ...lineB }],
        [{ ...lineA, qty: 3 }, { ...lineB }],
      );

      expect(r.patch).toStrictEqual({ lines: { $update: [{ sku: "A", qty: 3 }] } });
    });

    it("an optional leaf cleared (own prop set to undefined) → the key + the leaf as null", () => {
      const r = diffLines(MergeOrderLinesForm, [{ ...lineA }], [{ ...lineA, note: undefined }]);

      expect(r.patch).toStrictEqual({ lines: { $update: [{ sku: "A", note: null }] } });
    });

    it("a leaf inside an element's nested object changed → the key + the whole nested object (the db merges one level deep)", () => {
      const r = diffLines(
        MergeParcelLinesForm,
        [{ sku: "P", qty: 1, size: { w: 1, h: 2 } }],
        [{ sku: "P", qty: 1, size: { w: 9, h: 2 } }],
      );

      expect(r.patch).toStrictEqual({ lines: { $update: [{ sku: "P", size: { w: 9, h: 2 } }] } });
    });

    it("an explicit undefined-valued prop vs an absent one is no change → no op", () => {
      const r = diffLines(MergeOrderLinesForm, [{ ...lineB, note: undefined }], [{ ...lineB }]);

      expect(r.isDirty).toBe(false);
      expect(r.patch).toEqual({});
    });

    it("$insert stays the whole new item and $remove the key only", () => {
      const lineC = { sku: "C", qty: 4, price: 1 };
      const r = diffLines(
        MergeOrderLinesForm,
        [{ ...lineA }, { ...lineB }],
        [{ ...lineA, price: 12 }, lineC],
      );

      expect(r.patch).toStrictEqual({
        lines: {
          $update: [{ sku: "A", price: 12 }],
          $insert: [lineC],
          $remove: [{ sku: "B" }],
        },
      });
    });

    it("a pure reorder still falls back to $replace", () => {
      const r = diffLines(
        MergeOrderLinesForm,
        [{ ...lineA }, { ...lineB }],
        [{ ...lineB }, { ...lineA }],
      );

      expect(r.patch).toStrictEqual({ lines: { $replace: [lineB, lineA] } });
    });
  });

  it("root-array form (patch under 'value'): default strategy → whole element, merge → changed leaves", () => {
    const baseline = wrap([{ ...lineA }, { ...lineB }]);
    const current = wrap([{ ...lineA, qty: 3 }, { ...lineB }]);

    const replaced = buildFormDiff(createFormDef(prop(OrderLinesForm, "lines")), baseline, current);
    expect(replaced.patch).toStrictEqual({
      value: { $update: [{ sku: "A", qty: 3, price: 10, note: "gift" }] },
    });

    const merged = buildFormDiff(
      createFormDef(prop(MergeOrderLinesForm, "lines")),
      baseline,
      current,
    );
    expect(merged.patch).toStrictEqual({ value: { $update: [{ sku: "A", qty: 3 }] } });
  });

  it("keyed arrays inside a merge object: each array's own strategy picks its $update item shape", () => {
    const r = buildFormDiff(
      createFormDef(NestedKeyedArraysForm),
      wrap({ order: { lines: [{ ...lineA }], mergedLines: [{ ...lineA }] } }),
      wrap({ order: { lines: [{ ...lineA, qty: 3 }], mergedLines: [{ ...lineA, qty: 3 }] } }),
    );

    expect(r.patch).toStrictEqual({
      order: {
        lines: { $update: [{ sku: "A", qty: 3, price: 10, note: "gift" }] },
        mergedLines: { $update: [{ sku: "A", qty: 3 }] },
      },
    });
  });
});

// ── Composite-key arrays ─────────────────────────────────────

describe("buildFormDiff — composite-key arrays (two @expect.array.key)", () => {
  it("update matches on the composite (warehouse + sku); default strategy → whole element", () => {
    const def = createFormDef(CompositeKeyArrayForm);
    const baseline = wrap({
      stock: [
        { warehouse: "W1", sku: "A", qty: 1, bin: "B7" },
        { warehouse: "W2", sku: "A", qty: 5 }, // same sku, different warehouse
      ],
    });
    const current = wrap({
      stock: [
        { warehouse: "W1", sku: "A", qty: 9, bin: "B7" }, // qty changed
        { warehouse: "W2", sku: "A", qty: 5 },
      ],
    });
    const r = buildFormDiff(def, baseline, current);

    expect(r.patch).toStrictEqual({
      stock: { $update: [{ warehouse: "W1", sku: "A", qty: 9, bin: "B7" }] },
    });
  });

  it("two key tuples whose values would join into the same string stay different elements", () => {
    const def = createFormDef(CompositeKeyArrayForm);
    // Joined with a space, both tuples would read `s:a s:b s:c`.
    const first = { warehouse: "a s:b", sku: "c", qty: 1 };
    const second = { warehouse: "a", sku: "b s:c", qty: 2 };
    const r = buildFormDiff(
      def,
      wrap({ stock: [first, second] }),
      wrap({ stock: [first, { ...second, qty: 5 }] }),
    );

    expect(r.patch).toStrictEqual({ stock: { $update: [{ ...second, qty: 5 }] } });
  });

  it("merge strategy on a composite-key array → $update carries both keys + the changed leaves only", () => {
    const def = createFormDef(MergeCompositeKeyArrayForm);
    const baseline = wrap({
      stock: [
        { warehouse: "W1", sku: "A", qty: 1, bin: "B7" },
        { warehouse: "W2", sku: "A", qty: 5, bin: "C1" },
      ],
    });
    const current = wrap({
      stock: [
        { warehouse: "W1", sku: "A", qty: 9, bin: "B7" }, // qty changed
        { warehouse: "W2", sku: "A", qty: 5 }, // bin cleared
      ],
    });
    const r = buildFormDiff(def, baseline, current);

    expect(r.patch).toStrictEqual({
      stock: {
        $update: [
          { warehouse: "W1", sku: "A", qty: 9 },
          { warehouse: "W2", sku: "A", bin: null },
        ],
      },
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

  // Since 0.1.176: an element a key operator would name must carry every key
  // value — before, such an item went out and the db refused the patch
  // (`PATCH_KEY_REQUIRED`). An untouched row with an incomplete key names no
  // operator and leaves the other rows' operators alone, as before.
  describe("an element with an incomplete composite key", () => {
    const diffStock = (before: unknown[], after: unknown[]) =>
      buildFormDiff(
        createFormDef(CompositeKeyArrayForm),
        wrap({ stock: before }),
        wrap({ stock: after }),
      ).patch;
    const W1 = { warehouse: "W1", sku: "A", qty: 1 };
    const W2 = { warehouse: "W2", sku: "A", qty: 5 };
    const noWarehouse = { sku: "B", qty: 3 };

    it("a new row without its sku → $replace (not an $insert)", () => {
      const after = [W1, W2, { warehouse: "W3", qty: 2 }];
      expect(diffStock([W1, W2], after)).toStrictEqual({ stock: { $replace: after } });
    });

    it("a row whose sku was cleared to null → $replace (not a $remove + $insert)", () => {
      const after = [W1, { ...W2, sku: null, qty: 6 }];
      expect(diffStock([W1, W2], after)).toStrictEqual({ stock: { $replace: after } });
    });

    it("an edited stored row without its warehouse → $replace (not an $update)", () => {
      const after = [W1, { ...noWarehouse, qty: 9 }];
      expect(diffStock([W1, noWarehouse], after)).toStrictEqual({ stock: { $replace: after } });
    });

    it("a removed stored row whose warehouse is undefined → $replace (not a $remove)", () => {
      const partial = { warehouse: undefined, sku: "B", qty: 3 };
      expect(diffStock([W1, partial], [W1])).toStrictEqual({ stock: { $replace: [W1] } });
    });

    it("an untouched stored row without its warehouse leaves an edit of another row a $update", () => {
      expect(diffStock([W1, noWarehouse], [{ ...W1, qty: 9 }, noWarehouse])).toStrictEqual({
        stock: { $update: [{ ...W1, qty: 9 }] },
      });
    });

    it("an untouched stored row without its warehouse leaves an appended row an $insert", () => {
      const W3 = { warehouse: "W3", sku: "C", qty: 2 };
      expect(diffStock([W1, noWarehouse], [W1, noWarehouse, W3])).toStrictEqual({
        stock: { $insert: [W3] },
      });
    });

    it("a stored row missing ALL its key values is ambiguous → $replace even untouched (unchanged)", () => {
      const keyless = { qty: 3 };
      const after = [{ ...W1, qty: 9 }, keyless];
      expect(diffStock([W1, keyless], after)).toStrictEqual({ stock: { $replace: after } });
    });

    it("an unchanged array holding such a row → no patch entry", () => {
      expect(diffStock([W1, noWarehouse], [{ ...W1 }, { ...noWarehouse }])).toStrictEqual({});
    });
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

// ── @db.json arrays ──────────────────────────────────────────

describe("buildFormDiff — @db.json arrays (whole values, no array operations)", () => {
  const base = {
    name: "n",
    synonyms: ["a", "b"],
    lines: [{ sku: "x", qty: 1 }],
    doc: { tags: ["t1"], note: "keep" },
    settings: { flags: ["f1"], mode: "m" },
    meta: { labels: ["l1"], note: "keep" },
    plain: { items: ["i1"], note: "keep" },
  };
  const diff = (current: Partial<typeof base>) =>
    buildFormDiff(createFormDef(JsonArrayForm), wrap(base), wrap({ ...base, ...current })).patch;

  it("a @db.json uniqueItems array sends the whole array", () => {
    expect(diff({ synonyms: ["a", "c"] })).toEqual({ synonyms: ["a", "c"] });
  });

  it("a @db.json keyed array sends the whole array", () => {
    const lines = [
      { sku: "x", qty: 2 },
      { sku: "y", qty: 1 },
    ];
    expect(diff({ lines })).toEqual({ lines });
  });

  it("a cleared @db.json array sends null", () => {
    expect(diff({ synonyms: undefined })).toEqual({ synonyms: null });
  });

  it("an array inside an inlined @db.json object sends the whole object", () => {
    expect(diff({ doc: { tags: ["t1", "t2"], note: "keep" } })).toEqual({
      doc: { tags: ["t1", "t2"], note: "keep" },
    });
  });

  it("an array inside a structured @db.json object sends the whole object", () => {
    expect(diff({ settings: { flags: ["f2"], mode: "m" } })).toEqual({
      settings: { flags: ["f2"], mode: "m" },
    });
  });

  it("an array inside a plain merge object keeps its operations", () => {
    expect(diff({ meta: { labels: ["l1", "l2"], note: "keep" } })).toEqual({
      meta: { labels: { $insert: ["l2"] } },
    });
  });

  it("an array inside an inlined replace object sends the whole object", () => {
    expect(diff({ plain: { items: ["i2"], note: "keep" } })).toEqual({
      plain: { items: ["i2"], note: "keep" },
    });
  });
});

// ── Where the merge strategy applies ─────────────────────────

/** A changed `geo.lat` of `PlacedPrefs` / `PlacedLine`, as sent whole. */
const GEO_SENT_WHOLE = { lat: 9, lng: 2, note: "n" };

/** A stored `PlacedPrefs`. */
function placedPrefs() {
  return { theme: "t", geo: { lat: 1, lng: 2, note: "n" } };
}

/** `MergePlacementsForm` data: a stored `geo` in every placement. */
function placements() {
  return {
    prefs: placedPrefs(),
    profile: placedPrefs(),
    card: placedPrefs(),
    contact: placedPrefs(),
    saved: placedPrefs(),
    sealed: placedPrefs(),
    lines: [{ sku: "A", qty: 1, geo: { lat: 1, lng: 2, note: "n" } }],
    mergedLines: [{ sku: "A", qty: 1, geo: { lat: 1, lng: 2, note: "n" } }],
    trail: [placedPrefs()],
    pair: [placedPrefs(), placedPrefs()],
    pick: placedPrefs(),
  };
}

type Placement = keyof ReturnType<typeof placements>;

/**
 * The patch of `MergePlacementsForm` once `edit` (by default: `lat` became 9)
 * changed the `geo` at `key` (of its first element).
 */
function editGeo(
  key: Placement,
  edit = (geo: { lat: number; note?: string }) => {
    geo.lat = 9;
  },
): Record<string, unknown> {
  const after = placements();
  const target = after[key];
  edit((Array.isArray(target) ? target[0]! : target).geo);
  return buildFormDiff(createFormDef(MergePlacementsForm), wrap(placements()), wrap(after)).patch;
}

/** `MergeTreeNode` data three nodes deep: `r` → `second` → `third`. */
function tree(second = "c", third = "g") {
  return {
    name: "r",
    kind: "k",
    child: { name: second, kind: "k", child: { name: third, kind: "k" } },
  };
}

/** `DissolvedHolderForm` data. */
function holder() {
  return {
    box: { label: "L", geo: { lat: 1, lng: 2 } },
    mergedBox: { label: "M", geo: { lat: 1, lng: 2 } },
  };
}

/**
 * The paths the db-client patch preflight rejects — the server's own patch
 * rules.
 */
function rejectedPaths(type: TAtscriptAnnotatedType, patch: Record<string, unknown>): string[] {
  try {
    new ClientValidator(type as TAtscriptAnnotatedType<TAtscriptTypeObject>).validate(
      patch,
      "patch",
    );
    return [];
  } catch (e) {
    if (!(e instanceof ClientValidationError)) throw e;
    return e.errors.map((err) => err.path);
  }
}

describe("buildFormDiff — a partial object only where the merge strategy applies", () => {
  it.each<[string, Placement, Record<string, unknown>]>([
    [
      "a merge object reached by its own path, holding a merge object → partial at both levels",
      "prefs",
      { prefs: { geo: { lat: 9 } } },
    ],
    [
      "a merge object inside a replaced parent → the whole parent, the merge object whole",
      "profile",
      { profile: { theme: "t", geo: GEO_SENT_WHOLE } },
    ],
    [
      "a merge object inside a dissolved replaced parent → the whole parent, the merge object whole",
      "card",
      { card: { theme: "t", geo: GEO_SENT_WHOLE } },
    ],
    [
      "a merge `T | null` object (a union field of the form) → the whole object",
      "contact",
      { contact: { theme: "t", geo: GEO_SENT_WHOLE } },
    ],
    [
      "a merge object inside a @db.json field (merge on the field through annotate) → the whole field",
      "saved",
      { saved: { theme: "t", geo: GEO_SENT_WHOLE } },
    ],
    [
      "a merge object inside a @db.encrypted field (merge on the field through annotate) → the whole field",
      "sealed",
      { sealed: { theme: "t", geo: GEO_SENT_WHOLE } },
    ],
    [
      "a merge object inside a keyed array item (replace array) → $update carries the whole element",
      "lines",
      { lines: { $update: [{ sku: "A", qty: 1, geo: GEO_SENT_WHOLE }] } },
    ],
    [
      "a merge object inside a keyed array item (merge array) → $update carries the key + the whole merge object",
      "mergedLines",
      { mergedLines: { $update: [{ sku: "A", geo: GEO_SENT_WHOLE }] } },
    ],
    [
      "a merge object inside an unkeyed array item → $replace with whole elements",
      "trail",
      { trail: { $replace: [{ theme: "t", geo: GEO_SENT_WHOLE }] } },
    ],
    [
      "a merge object inside a tuple element → the whole tuple",
      "pair",
      {
        pair: [
          { theme: "t", geo: GEO_SENT_WHOLE },
          { theme: "t", geo: { lat: 1, lng: 2, note: "n" } },
        ],
      },
    ],
    [
      "a merge object inside a union member → the whole member",
      "pick",
      { pick: { theme: "t", geo: GEO_SENT_WHOLE } },
    ],
  ])("%s", (_name, key, expected) => {
    const patch = editGeo(key);
    expect(patch).toStrictEqual(expected);
    expect(rejectedPaths(MergePlacementsForm, patch)).toEqual([]);
  });

  // The server keeps what a patch leaves out of a merge object, also inside an
  // object sent whole, so a cleared child must go out as `null` there.
  it.each<[string, Placement, Record<string, unknown>]>([
    ["a merge object reached by its own path", "prefs", { prefs: { geo: { note: null } } }],
    [
      "a merge object inside a replaced parent",
      "profile",
      { profile: { theme: "t", geo: { lat: 1, lng: 2, note: null } } },
    ],
    [
      "a merge object inside a dissolved replaced parent",
      "card",
      { card: { theme: "t", geo: { lat: 1, lng: 2, note: null } } },
    ],
    [
      "a merge object inside a merge `T | null` object",
      "contact",
      { contact: { theme: "t", geo: { lat: 1, lng: 2, note: null } } },
    ],
    [
      "a merge object inside a @db.json field (no merge applies) → left out",
      "saved",
      { saved: { theme: "t", geo: { lat: 1, lng: 2 } } },
    ],
  ])("a child cleared in %s → null", (_name, key, expected) => {
    const patch = editGeo(key, (geo) => {
      delete geo.note;
    });
    expect(patch).toStrictEqual(expected);
    expect(rejectedPaths(MergePlacementsForm, patch)).toEqual([]);
  });

  it("a recursive merge type → partial down to where the type repeats, the whole object below it", () => {
    const def = createFormDef(MergeTreeNode);
    const second = buildFormDiff(def, wrap(tree()), wrap(tree("X"))).patch;
    const third = buildFormDiff(def, wrap(tree()), wrap(tree("c", "X"))).patch;
    expect(second).toStrictEqual({ child: { name: "X" } });
    expect(third).toStrictEqual({ child: { child: { name: "X", kind: "k" } } });
    expect(rejectedPaths(MergeTreeNode, second)).toEqual([]);
    expect(rejectedPaths(MergeTreeNode, third)).toEqual([]);
  });

  it.each<[string, Record<string, unknown>, Record<string, unknown>, string[]]>([
    [
      "an object field inside a dissolved replace object → the whole dissolved object",
      { box: { label: "L", geo: { lat: 9, lng: 2 } } },
      { box: { label: "L", geo: { lat: 9, lng: 2 } } },
      ["box.geo.lat"],
    ],
    [
      "an object field cleared inside a dissolved replace object → the whole dissolved object without it",
      { box: { label: "L" } },
      { box: { label: "L" } },
      ["box.geo.lat", "box.geo.lng"],
    ],
    [
      "an object field inside a dissolved merge object → the dissolved object partial, the replace object whole",
      { mergedBox: { label: "M", geo: { lat: 9, lng: 2 } } },
      { mergedBox: { geo: { lat: 9, lng: 2 } } },
      ["mergedBox.geo.lat"],
    ],
  ])("%s", (_name, edit, expected, changed) => {
    const def = createFormDef(DissolvedHolderForm);
    const r = buildFormDiff(def, wrap(holder()), wrap({ ...holder(), ...edit }));
    expect(r.patch).toStrictEqual(expected);
    expect(r.changes.map((c) => c.path)).toEqual(changed);
    expect(rejectedPaths(DissolvedHolderForm, r.patch)).toEqual([]);
  });

  // The places above where the diff sends an object whole: a partial object
  // there is rejected, so the acceptance checks above are not vacuous.
  it.each<[string, TAtscriptAnnotatedType, Record<string, unknown>, string]>([
    [
      "a keyed array item (replace array)",
      MergePlacementsForm,
      { lines: { $update: [{ sku: "A", qty: 1, geo: { lat: 9 } }] } },
      "lines.$update[0].geo.lng",
    ],
    [
      "a keyed array item (merge array)",
      MergePlacementsForm,
      { mergedLines: { $update: [{ sku: "A", geo: { lat: 9 } }] } },
      "mergedLines.$update[0].geo.lng",
    ],
    [
      "a @db.encrypted field with merge through annotate",
      MergePlacementsForm,
      { sealed: { geo: { lat: 9 } } },
      "sealed.geo.lng",
    ],
    [
      "a recursive merge type below where it repeats",
      MergeTreeNode,
      { child: { child: { name: "X" } } },
      "child.child.kind",
    ],
    [
      "a dissolved replace object",
      DissolvedHolderForm,
      { box: { geo: { lat: 9, lng: 2 } } },
      "box.label",
    ],
  ])("a partial object in %s → rejected", (_name, type, patch, path) => {
    expect(rejectedPaths(type, patch)).toEqual([path]);
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

// ── Renamed version + derived ────────────────────────────────

describe("buildFormDiff — renamed version + derived fields", () => {
  it("a storage-renamed version field lifts to $cas by its LOGICAL name, never a SET", () => {
    const def = createFormDef(RenamedVersionForm, { versionColumn: "rev" });
    const baseline = wrap({ name: "Ada", rev: 3, customerId: "c1" });
    const current = wrap({ name: "Grace", rev: 4, customerId: "c1" });
    const r = buildFormDiff(def, baseline, current);
    expect(r.patch).toEqual({ name: "Grace", $cas: { rev: 3 } });
  });

  it("the engine finds the renamed version on its own (no versionColumn opt)", () => {
    const def = createFormDef(RenamedVersionForm);
    const r = buildFormDiff(
      def,
      wrap({ name: "Ada", rev: 3, customerId: "c1" }),
      wrap({ name: "Grace", rev: 3, customerId: "c1" }),
    );
    expect(r.patch).toEqual({ name: "Grace", $cas: { rev: 3 } });
  });

  it("a @db.column.derived field is never a change or a SET", () => {
    const def = createFormDef(RenamedVersionForm, { versionColumn: "rev" });
    const r = buildFormDiff(
      def,
      wrap({ name: "Ada", rev: 3, customerId: "c1" }),
      wrap({ name: "Ada", rev: 3, customerId: "c2" }),
    );
    expect(r.isDirty).toBe(false);
    expect(r.patch).toEqual({});

    const withEdit = buildFormDiff(
      def,
      wrap({ name: "Ada", rev: 3, customerId: "c1" }),
      wrap({ name: "Grace", rev: 3, customerId: "c2" }),
    );
    expect(withEdit.changes.map((c) => c.path)).toEqual(["name"]);
    expect(withEdit.patch).toEqual({ name: "Grace", $cas: { rev: 3 } });
  });
});

// ── Update stamps (@db.onUpdate.now) ─────────────────────────

describe("buildFormDiff — @db.onUpdate.now fields", () => {
  const before = { name: "Ada", updatedAt: 1, editedAt: 1, trace: { updatedAt: 1 } };
  const after = { name: "Ada", updatedAt: 2, editedAt: 2, trace: { updatedAt: 2 } };

  it("an edit form never sends a stamp — the server sets it on every update", () => {
    const def = createFormDef(StampedRow, { mode: "edit" });
    const r = buildFormDiff(def, wrap(before), wrap(after));
    expect(r.isDirty).toBe(false);
    expect(r.patch).toEqual({});

    const withEdit = buildFormDiff(def, wrap(before), wrap({ ...after, name: "Grace" }));
    expect(withEdit.patch).toEqual({ name: "Grace" });
  });

  it("a create-mode def diffs it like any field", () => {
    const r = buildFormDiff(createFormDef(StampedRow), wrap(before), wrap(after));
    expect(r.changes.map((c) => c.path)).toEqual(["updatedAt", "editedAt", "trace.updatedAt"]);
  });
});

describe("buildFormDiff — @db.onUpdate.inc fields", () => {
  it("an edit form never sends a change counter", () => {
    const def = createFormDef(CountedRow, { mode: "edit" });
    const r = buildFormDiff(
      def,
      wrap({ name: "Ada", revision: 3 }),
      wrap({ name: "Grace", revision: 4 }),
    );
    expect(r.patch).toEqual({ name: "Grace" });
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
