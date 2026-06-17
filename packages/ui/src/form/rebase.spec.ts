import { describe, expect, it } from "vitest";
import { createFormDef } from "./create-form-def";
import { buildFormRebase } from "./rebase";
import {
  RebaseArrayForm,
  RebaseComboForm,
  RebaseNestedForm,
  RebaseScalarForm,
} from "../__tests__/fixtures/form-rebase.as";

/** Wrap domain data as the form-data container expected by getByPath. */
function wrap<T>(value: T): { value: T } {
  return { value };
}

/** Sorted paths from a change list (order-insensitive assertions). */
function paths(changes: { path: string }[]): string[] {
  return changes.map((c) => c.path).toSorted();
}

// ── Local-only + upstream-only (no conflict) ─────────────────

describe("buildFormRebase — disjoint local + upstream edits", () => {
  it("local edit X + upstream edit sibling Y → both survive", () => {
    const def = createFormDef(RebaseScalarForm);
    const baseline = wrap({ name: "Ada", nick: "A", age: 30 });
    const current = wrap({ name: "Grace", nick: "A", age: 30 }); // local: name
    const upstream = wrap({ name: "Ada", nick: "A", age: 31 }); // upstream: age

    const { next, conflicts, reapplied } = buildFormRebase(def, baseline, current, upstream);

    expect(conflicts).toEqual([]);
    // name = local edit, age = upstream value.
    expect(next.value).toEqual({ name: "Grace", nick: "A", age: 31 });
    // reapplied = diff(next vs upstream) = just the local name edit.
    expect(reapplied).toEqual([{ path: "name", kind: "set", before: "Ada", after: "Grace" }]);
  });

  it("no local edits, upstream changed → adopt upstream, nothing reapplied", () => {
    const def = createFormDef(RebaseScalarForm);
    const baseline = wrap({ name: "Ada", age: 30 });
    const current = wrap({ name: "Ada", age: 30 });
    const upstream = wrap({ name: "Ada", age: 99 });

    const { next, conflicts, reapplied } = buildFormRebase(def, baseline, current, upstream);

    expect(conflicts).toEqual([]);
    expect(next.value).toEqual({ name: "Ada", age: 99 });
    expect(reapplied).toEqual([]);
  });

  it("local-only clear of an optional scalar survives (undefined → deleted key)", () => {
    const def = createFormDef(RebaseScalarForm);
    const baseline = wrap<Record<string, unknown>>({ name: "Ada", age: 30 });
    const current = wrap<Record<string, unknown>>({ name: "Ada" }); // local cleared age
    const upstream = wrap<Record<string, unknown>>({ name: "Bob", age: 30 }); // upstream edited name

    const { next, conflicts, reapplied } = buildFormRebase(def, baseline, current, upstream);

    expect(conflicts).toEqual([]);
    // name = upstream, age cleared by local. Key must be ABSENT, not undefined.
    expect("age" in (next.value as Record<string, unknown>)).toBe(false);
    expect(next.value).toEqual({ name: "Bob" });
    expect(reapplied).toEqual([{ path: "age", kind: "set", before: 30, after: undefined }]);
  });
});

// ── Same-path conflicts ──────────────────────────────────────

describe("buildFormRebase — same-path conflicts", () => {
  it("different value on both sides → conflict; 'ours' keeps local", () => {
    const def = createFormDef(RebaseScalarForm);
    const baseline = wrap({ name: "Ada", age: 30 });
    const current = wrap({ name: "Grace", age: 30 }); // local: name → Grace
    const upstream = wrap({ name: "Bob", age: 30 }); // upstream: name → Bob

    const r = buildFormRebase(def, baseline, current, upstream); // default 'ours'

    expect(r.conflicts).toEqual(["name"]);
    expect(r.next.value).toEqual({ name: "Grace", age: 30 });
    expect(r.reapplied).toEqual([{ path: "name", kind: "set", before: "Bob", after: "Grace" }]);
  });

  it("different value on both sides → conflict; 'theirs' takes upstream", () => {
    const def = createFormDef(RebaseScalarForm);
    const baseline = wrap({ name: "Ada", age: 30 });
    const current = wrap({ name: "Grace", age: 30 });
    const upstream = wrap({ name: "Bob", age: 30 });

    const r = buildFormRebase(def, baseline, current, upstream, { conflict: "theirs" });

    expect(r.conflicts).toEqual(["name"]);
    expect(r.next.value).toEqual({ name: "Bob", age: 30 });
    // next === upstream → clean.
    expect(r.reapplied).toEqual([]);
  });

  it("SAME value on both sides (parallel edit) → NO conflict, drops out clean", () => {
    const def = createFormDef(RebaseScalarForm);
    const baseline = wrap({ name: "Ada", age: 30 });
    // Both local and upstream set name → "Bob".
    const current = wrap({ name: "Bob", age: 30 });
    const upstream = wrap({ name: "Bob", age: 30 });

    const r = buildFormRebase(def, baseline, current, upstream);

    expect(r.conflicts).toEqual([]);
    expect(r.next.value).toEqual({ name: "Bob", age: 30 });
    // next === upstream → no surviving diff.
    expect(r.reapplied).toEqual([]);
  });
});

// ── Nested-object leaf granularity ───────────────────────────

describe("buildFormRebase — nested object leaf granularity", () => {
  it("local edits one leaf, upstream edits the sibling leaf → BOTH survive", () => {
    const def = createFormDef(RebaseComboForm);
    const baseline = wrap({ name: "Co", profile: { bio: "b0", nick: "n0" } });
    const current = wrap({ name: "Co", profile: { bio: "b1", nick: "n0" } }); // local: bio
    const upstream = wrap({ name: "Co", profile: { bio: "b0", nick: "n1" } }); // upstream: nick

    const r = buildFormRebase(def, baseline, current, upstream);

    expect(r.conflicts).toEqual([]);
    // bio = local, nick = upstream.
    expect(r.next.value).toEqual({ name: "Co", profile: { bio: "b1", nick: "n1" } });
    expect(paths(r.reapplied)).toEqual(["profile.bio"]);
  });

  it("same nested leaf edited differently on both sides → conflict at the leaf path", () => {
    const def = createFormDef(RebaseComboForm);
    const baseline = wrap({ name: "Co", profile: { bio: "b0", nick: "n0" } });
    const current = wrap({ name: "Co", profile: { bio: "local", nick: "n0" } });
    const upstream = wrap({ name: "Co", profile: { bio: "upstream", nick: "n0" } });

    const ours = buildFormRebase(def, baseline, current, upstream);
    expect(ours.conflicts).toEqual(["profile.bio"]);
    expect((ours.next.value as { profile: { bio: string } }).profile.bio).toBe("local");

    const theirs = buildFormRebase(def, baseline, current, upstream, { conflict: "theirs" });
    expect(theirs.conflicts).toEqual(["profile.bio"]);
    expect((theirs.next.value as { profile: { bio: string } }).profile.bio).toBe("upstream");
  });
});

// ── Keyed array (whole-array conflict) ───────────────────────

describe("buildFormRebase — keyed array", () => {
  it("local-only array edit survives when upstream untouched", () => {
    const def = createFormDef(RebaseArrayForm);
    const baseline = wrap({ items: [{ sku: "A", qty: 1 }] });
    const current = wrap({ items: [{ sku: "A", qty: 5 }] }); // local edit
    const upstream = wrap({ items: [{ sku: "A", qty: 1 }] }); // unchanged

    const r = buildFormRebase(def, baseline, current, upstream);

    expect(r.conflicts).toEqual([]);
    expect(r.next.value).toEqual({ items: [{ sku: "A", qty: 5 }] });
    expect(paths(r.reapplied)).toEqual(["items"]);
  });

  it("both sides touch the same array → whole-array conflict, resolved by opts", () => {
    const def = createFormDef(RebaseArrayForm);
    const baseline = wrap({ items: [{ sku: "A", qty: 1 }] });
    const current = wrap({ items: [{ sku: "A", qty: 5 }] }); // local: qty 5
    const upstream = wrap({
      items: [
        { sku: "A", qty: 1 },
        { sku: "B", qty: 2 }, // upstream appended B
      ],
    });

    const ours = buildFormRebase(def, baseline, current, upstream);
    expect(ours.conflicts).toEqual(["items"]);
    // 'ours' → whole local array wins (LOCKED Option A, no per-element merge).
    expect(ours.next.value).toEqual({ items: [{ sku: "A", qty: 5 }] });

    const theirs = buildFormRebase(def, baseline, current, upstream, { conflict: "theirs" });
    expect(theirs.conflicts).toEqual(["items"]);
    expect(theirs.next.value).toEqual({
      items: [
        { sku: "A", qty: 1 },
        { sku: "B", qty: 2 },
      ],
    });
    expect(theirs.reapplied).toEqual([]);
  });

  it("reapplied does not alias next (survives a post-rebase mutation of next)", () => {
    const def = createFormDef(RebaseArrayForm);
    const baseline = wrap({ items: [{ sku: "A", qty: 1 }] });
    const current = wrap({ items: [{ sku: "A", qty: 5 }] }); // local: qty 1 → 5
    const upstream = wrap({ items: [{ sku: "A", qty: 1 }] }); // unchanged

    const r = buildFormRebase(def, baseline, current, upstream);

    // The surviving local edit produces an ARRAY-valued reapplied change.
    const itemsChange = r.reapplied.find((c) => c.path === "items");
    expect(itemsChange?.after).toEqual([{ sku: "A", qty: 5 }]);
    // Snapshot the reapplied `after` BEFORE mutating `next`.
    const snapshot = JSON.parse(JSON.stringify(itemsChange?.after));

    // The caller installs `next` as LIVE form data; a later edit pushes a row.
    (r.next.value as { items: { sku: string; qty: number }[] }).items.push({ sku: "Z", qty: 9 });

    // `reapplied[].after` must be UNCHANGED — it must NOT alias the mutated `next`.
    expect(itemsChange?.after).toEqual(snapshot);
    expect(itemsChange?.after).toEqual([{ sku: "A", qty: 5 }]);
  });
});

// ── Ancestor-clear conflict ──────────────────────────────────

describe("buildFormRebase — ancestor-clear", () => {
  it("upstream nulls a nested object while local edited a leaf under it → conflict at ancestor", () => {
    const def = createFormDef(RebaseNestedForm);
    const baseline = wrap<Record<string, unknown>>({
      name: "Co",
      address: { street: "1 Main", city: "NYC" },
    });
    // local edits a leaf under address.
    const current = wrap<Record<string, unknown>>({
      name: "Co",
      address: { street: "2 Main", city: "NYC" },
    });
    // upstream removed the whole address object.
    const upstream = wrap<Record<string, unknown>>({ name: "Co", address: null });

    // 'ours' → restore the WHOLE local subtree (no partial object).
    const ours = buildFormRebase(def, baseline, current, upstream);
    expect(ours.conflicts).toEqual(["address"]);
    expect(ours.next.value).toEqual({ name: "Co", address: { street: "2 Main", city: "NYC" } });

    // 'theirs' → keep upstream's null.
    const theirs = buildFormRebase(def, baseline, current, upstream, { conflict: "theirs" });
    expect(theirs.conflicts).toEqual(["address"]);
    expect(theirs.next.value).toEqual({ name: "Co", address: null });
    expect(theirs.reapplied).toEqual([]);
  });

  it("dedupes the ancestor when multiple leaves under a cleared object were edited", () => {
    const def = createFormDef(RebaseNestedForm);
    const baseline = wrap<Record<string, unknown>>({
      name: "Co",
      address: { street: "1 Main", city: "NYC" },
    });
    // local edited BOTH leaves under address.
    const current = wrap<Record<string, unknown>>({
      name: "Co",
      address: { street: "2 Main", city: "Boston" },
    });
    const upstream = wrap<Record<string, unknown>>({ name: "Co", address: null });

    const r = buildFormRebase(def, baseline, current, upstream);
    // Ancestor recorded ONCE despite two edited leaves.
    expect(r.conflicts).toEqual(["address"]);
    expect(r.next.value).toEqual({ name: "Co", address: { street: "2 Main", city: "Boston" } });
  });
});

// ── Inputs are never mutated ─────────────────────────────────

describe("buildFormRebase — input isolation", () => {
  it("does not mutate baseline / current / upstream containers", () => {
    const def = createFormDef(RebaseScalarForm);
    const baseline = wrap({ name: "Ada", age: 30 });
    const current = wrap({ name: "Grace", age: 30 });
    const upstream = wrap({ name: "Ada", age: 31 });

    const r = buildFormRebase(def, baseline, current, upstream);
    (r.next.value as { name: string }).name = "MUTATED";

    expect(baseline.value).toEqual({ name: "Ada", age: 30 });
    expect(current.value).toEqual({ name: "Grace", age: 30 });
    expect(upstream.value).toEqual({ name: "Ada", age: 31 });
  });

  it("next does not alias current for an array-valued reapply (deep-cloned)", () => {
    const def = createFormDef(RebaseArrayForm);
    const baseline = wrap({ items: [{ sku: "A", qty: 1 }] });
    // Local-only edit produces an ARRAY-valued reapplied change (kind:'array').
    const current = wrap({ items: [{ sku: "A", qty: 5 }] });
    const upstream = wrap({ items: [{ sku: "A", qty: 1 }] }); // untouched upstream

    const r = buildFormRebase(def, baseline, current, upstream);
    expect(r.next.value).toEqual({ items: [{ sku: "A", qty: 5 }] });

    // The reapplied array node must NOT be the same reference as current's node.
    const nextItems = (r.next.value as { items: unknown[] }).items;
    const currentItems = (current.value as { items: unknown[] }).items;
    expect(nextItems).not.toBe(currentItems);

    // Mutating current AFTER the call must not retroactively change next.
    (current.value as { items: { sku: string; qty: number }[] }).items.push({ sku: "Z", qty: 9 });
    expect(r.next.value).toEqual({ items: [{ sku: "A", qty: 5 }] });
  });
});
