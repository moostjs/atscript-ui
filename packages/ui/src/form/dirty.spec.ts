import { describe, expect, it } from "vitest";
import {
  ComboForm,
  InlineNestedForm,
  KeyedArrayForm,
  ScalarForm,
  StructNestedForm,
} from "../__tests__/fixtures/form-diff.as";
import { createFormDef } from "./create-form-def";
import { buildFormDiff, type FormFieldChange } from "./diff";
import { collectDirtyPaths, isPathDirty } from "./dirty";

/** Wrap domain data as the form-data container expected by getByPath. */
function wrap<T>(value: T): { value: T } {
  return { value };
}

// ── Exact leaf match ─────────────────────────────────────────

describe("isPathDirty — exact leaf match", () => {
  it("a changed scalar leaf is dirty; a sibling is not", () => {
    const def = createFormDef(ScalarForm);
    const { changes } = buildFormDiff(
      def,
      wrap({ name: "Ada", age: 30, active: true }),
      wrap({ name: "Grace", age: 30, active: true }),
    );
    expect(isPathDirty(changes, "name")).toBe(true);
    expect(isPathDirty(changes, "age")).toBe(false);
    expect(isPathDirty(changes, "active")).toBe(false);
  });
});

// ── Nested leaf + object container via prefix ────────────────

describe("isPathDirty — nested leaf + object container", () => {
  it("nested leaf matches exactly and its container matches via prefix", () => {
    const def = createFormDef(StructNestedForm);
    const { changes } = buildFormDiff(
      def,
      wrap({ name: "Co", address: { street: "1 Main", city: "NYC" } }),
      wrap({ name: "Co", address: { street: "2 Main", city: "NYC" } }),
    );
    // The diff records the leaf change `address.street` (no entry at `address`).
    expect(changes.map((c) => c.path)).toEqual(["address.street"]);

    // Exact match on the nested leaf.
    expect(isPathDirty(changes, "address.street")).toBe(true);
    // Object/section container lights up via the prefix branch (no own entry).
    expect(isPathDirty(changes, "address")).toBe(true);
    // An unchanged sibling leaf inside the same container is clean.
    expect(isPathDirty(changes, "address.city")).toBe(false);
    // An unrelated top-level field is clean.
    expect(isPathDirty(changes, "name")).toBe(false);
  });

  it("inlined (dot-path) object container is dirty via prefix", () => {
    const def = createFormDef(InlineNestedForm);
    const { changes } = buildFormDiff(
      def,
      wrap({ name: "Co", address: { street: "1 Main", city: "NYC" } }),
      wrap({ name: "Co", address: { street: "1 Main", city: "Boston" } }),
    );
    expect(isPathDirty(changes, "address")).toBe(true);
    expect(isPathDirty(changes, "address.city")).toBe(true);
    expect(isPathDirty(changes, "address.street")).toBe(false);
  });
});

// ── Whole-array exact + array-item leaf returns false ────────

describe("isPathDirty — arrays (whole-array exact, item leaf false)", () => {
  it("the array container matches exactly; an item leaf is NOT detectable", () => {
    const def = createFormDef(KeyedArrayForm);
    const { changes } = buildFormDiff(
      def,
      wrap({ items: [{ sku: "A", qty: 1 }] }),
      wrap({ items: [{ sku: "A", qty: 5 }] }),
    );
    // The array diff emits a single whole-array change at the array root.
    expect(changes.map((c) => c.path)).toEqual(["items"]);

    // Whole-array field → exact match.
    expect(isPathDirty(changes, "items")).toBe(true);
    // Array-ITEM leaf → known limitation: no per-item path exists → false.
    expect(isPathDirty(changes, "items.0.qty")).toBe(false);
    expect(isPathDirty(changes, "items.0")).toBe(false);
  });
});

// ── No false positive: 'item' vs 'items' ─────────────────────

describe("isPathDirty — no prefix false positives", () => {
  it("a change at 'items' does NOT make a sibling field 'item' dirty", () => {
    // Hand-built change list isolating the prefix boundary: a whole-array change
    // at `items` must not satisfy the prefix check for `item`.
    const changes = [{ path: "items", kind: "array" as const, before: [], after: [1] }];
    expect(isPathDirty(changes, "items")).toBe(true);
    expect(isPathDirty(changes, "item")).toBe(false);
  });
});

// ── No changes → false (and root handling) ───────────────────

describe("isPathDirty — no changes + root", () => {
  it("an empty change list is never dirty for any path", () => {
    expect(isPathDirty([], "name")).toBe(false);
    expect(isPathDirty([], "address")).toBe(false);
    expect(isPathDirty([], "")).toBe(false);
  });

  it("the wrapped root '' is dirty iff there are ANY changes", () => {
    const def = createFormDef(ComboForm);
    const { changes } = buildFormDiff(
      def,
      wrap({
        title: "Order 1",
        address: { street: "1 Main", city: "NYC" },
        lines: [{ sku: "A", qty: 1 }],
        version: 7,
      }),
      wrap({
        title: "Order 2",
        address: { street: "1 Main", city: "NYC" },
        lines: [{ sku: "A", qty: 1 }],
        version: 7,
      }),
    );
    expect(changes.length).toBeGreaterThan(0);
    expect(isPathDirty(changes, "")).toBe(true);
    expect(isPathDirty([], "")).toBe(false);
  });
});

// ── collectDirtyPaths precomputes the SAME predicate as isPathDirty ──

describe("collectDirtyPaths — locked to isPathDirty", () => {
  // Varied change list: a scalar leaf, a nested object leaf, a whole-array
  // change, plus another top-level scalar — exercises exact paths, ancestor
  // containers, array-item leaves, the 'item' vs 'items' boundary, and root.
  const changes: FormFieldChange[] = [
    { path: "name", kind: "set", before: "Ada", after: "Grace" },
    { path: "address.city", kind: "set", before: "NYC", after: "Boston" },
    { path: "items", kind: "array", before: [], after: [{ sku: "A", qty: 1 }] },
  ];

  it("Set membership equals isPathDirty for a spread of probe paths", () => {
    const dirty = collectDirtyPaths(changes);
    const probes = [
      "", // wrapped root → dirty (has changes)
      "name", // exact scalar leaf → dirty
      "age", // untouched sibling → clean
      "address", // ancestor container of a changed leaf → dirty (prefix)
      "address.city", // exact nested leaf → dirty
      "address.street", // untouched sibling leaf → clean
      "items", // whole-array exact → dirty
      "item", // 'item' must NOT match 'items' → clean
      "items.0", // array-item leaf → not detectable → clean
      "items.0.qty", // array-item leaf → not detectable → clean
    ];
    for (const p of probes) {
      expect(dirty.has(p)).toBe(isPathDirty(changes, p));
    }
    // Spot-check the resolved values so the invariant isn't vacuously true.
    expect(dirty.has("")).toBe(true);
    expect(dirty.has("address")).toBe(true);
    expect(dirty.has("item")).toBe(false);
    expect(dirty.has("items.0.qty")).toBe(false);
  });

  it("an empty change list yields an empty set (root '' clean)", () => {
    const dirty = collectDirtyPaths([]);
    expect(dirty.size).toBe(0);
    expect(dirty.has("")).toBe(false);
    expect(dirty.has("")).toBe(isPathDirty([], ""));
  });
});
