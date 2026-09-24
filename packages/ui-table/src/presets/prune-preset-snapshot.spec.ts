import type { FilterExpr } from "@uniqu/core";
import { describe, expect, it } from "vitest";
import {
  type KnownFields,
  prunePresetSnapshot,
  pruneResidualFilters,
  restoreDroppedEntries,
} from "./prune-preset-snapshot";
import type { PresetSnapshot } from "./preset-types";

// `score` is a client-owned (display) column: a column, but not server-backed.
const known: KnownFields = {
  columns: new Set(["id", "username", "status", "score"]),
  server: new Set(["id", "username", "status"]),
};
const eq = (v: string) => [{ type: "eq" as const, value: [v] }];

describe("prunePresetSnapshot", () => {
  it("reports nothing when nothing names a hidden field", () => {
    const s: PresetSnapshot = {
      columns: { columnNames: ["username", "score"], columnWidths: { username: "10em" } },
      filters: ["status"],
      filterOps: { status: eq("active") },
      sorters: [{ field: "score", direction: "asc" }],
      itemsPerPage: 50,
    };
    const out = prunePresetSnapshot(s, known);
    expect(out.snapshot).toEqual(s);
    expect(out.dropped).toBeNull();
  });

  it("drops hidden column names and keeps the order of the rest", () => {
    const s: PresetSnapshot = { columns: { columnNames: ["status", "email", "id", "roleId"] } };
    const { snapshot, dropped } = prunePresetSnapshot(s, known);
    expect(snapshot.columns).toEqual({ columnNames: ["status", "id"] });
    expect(dropped!.columns).toEqual(["email", "roleId"]);
    expect(dropped!.fields).toEqual(["email", "roleId"]);
  });

  it("falls back to every column when no column name survives", () => {
    const { snapshot } = prunePresetSnapshot({ columns: { columnNames: ["email"] } }, known);
    expect(snapshot.columns!.columnNames).toEqual(["id", "username", "status", "score"]);
  });

  it("drops widths of hidden columns, omitting an emptied map", () => {
    const s: PresetSnapshot = {
      columns: { columnNames: ["id"], columnWidths: { email: "20em", id: "4em" } },
    };
    expect(prunePresetSnapshot(s, known).snapshot.columns).toEqual({
      columnNames: ["id"],
      columnWidths: { id: "4em" },
    });
    const only = prunePresetSnapshot(
      { columns: { columnNames: ["id"], columnWidths: { email: "20em" } } },
      known,
    );
    expect(only.snapshot.columns).toEqual({ columnNames: ["id"] });
    // Width hygiene alone is not a user-visible drop.
    expect(only.dropped).toBeNull();
  });

  it("drops displayed filter inputs on hidden or client-owned fields", () => {
    const { snapshot, dropped } = prunePresetSnapshot(
      { filters: ["email", "status", "score"] },
      known,
    );
    expect(snapshot.filters).toEqual(["status"]);
    expect(dropped!.filterFields).toEqual(["email", "score"]);
  });

  it("drops a filterOps entry per field, keeping the others whole", () => {
    const s: PresetSnapshot = {
      filterOps: { email: [{ type: "contains", value: ["@"] }], status: eq("active") },
    };
    const { snapshot, dropped } = prunePresetSnapshot(s, known);
    expect(snapshot.filterOps).toEqual({ status: eq("active") });
    expect(dropped!.filters).toEqual({ email: [{ type: "contains", value: ["@"] }] });
  });

  it("drops hidden sorters and keeps the priority of the rest", () => {
    const s: PresetSnapshot = {
      sorters: [
        { field: "status", direction: "asc" },
        { field: "email", direction: "desc" },
        { field: "score", direction: "desc" },
      ],
    };
    const { snapshot, dropped } = prunePresetSnapshot(s, known);
    expect(snapshot.sorters).toEqual([
      { field: "status", direction: "asc" },
      { field: "score", direction: "desc" },
    ]);
    expect(dropped!.sorters).toEqual([{ field: "email", direction: "desc" }]);
  });

  it("keeps itemsPerPage and dedupes the dropped field list", () => {
    const s: PresetSnapshot = {
      columns: { columnNames: ["email", "id"] },
      filterOps: { email: eq("x") },
      sorters: [{ field: "email", direction: "asc" }],
      itemsPerPage: 100,
    };
    const { snapshot, dropped } = prunePresetSnapshot(s, known);
    expect(snapshot.itemsPerPage).toBe(100);
    expect(dropped!.fields).toEqual(["email"]);
  });

  it("never mutates its input", () => {
    const s: PresetSnapshot = { columns: { columnNames: ["email", "id"] }, filters: ["email"] };
    const copy = structuredClone(s);
    prunePresetSnapshot(s, known);
    expect(s).toEqual(copy);
  });
});

describe("pruneResidualFilters", () => {
  const server = known.server;

  it("keeps an all-known expression", () => {
    const exprs: FilterExpr[] = [{ $or: [{ username: "a" }, { status: "b" }] }];
    expect(pruneResidualFilters(exprs, server)).toEqual({ kept: exprs, dropped: null });
  });

  it("drops an $or with one hidden branch whole, naming the hidden field", () => {
    const expr: FilterExpr = { $or: [{ username: "a" }, { email: "b" }] };
    const { kept, dropped } = pruneResidualFilters([expr], server);
    expect(kept).toEqual([]);
    expect(dropped).toMatchObject({ fields: ["email"], residual: [expr] });
  });

  it("drops a $not with a hidden operand whole", () => {
    const expr: FilterExpr = { $not: { status: "x", email: { $exists: true } } };
    expect(pruneResidualFilters([expr], server).dropped!.residual).toEqual([expr]);
  });

  it("drops a nested $and inside an $or whole", () => {
    const ok: FilterExpr = { $or: [{ status: "a" }, { username: "b" }] };
    const bad: FilterExpr = {
      $or: [{ $and: [{ status: "a" }, { roleId: 1 }] }, { username: "b" }],
    };
    const { kept, dropped } = pruneResidualFilters([ok, bad], server);
    expect(kept).toEqual([ok]);
    expect(dropped).toMatchObject({ fields: ["roleId"], residual: [bad] });
  });
});

describe("restoreDroppedEntries", () => {
  const stored: PresetSnapshot = {
    columns: {
      columnNames: ["username", "email", "status", "roleId"],
      columnWidths: { email: "20em", username: "8em" },
    },
    filters: ["email", "status"],
    filterOps: { email: [{ type: "contains", value: ["@"] }], status: eq("active") },
    sorters: [
      { field: "email", direction: "desc" },
      { field: "status", direction: "asc" },
    ],
  };
  const dropped = prunePresetSnapshot(stored, known).dropped!;

  it("appends hidden column names after the captured ones, keeping captured widths", () => {
    const captured: PresetSnapshot = {
      columns: { columnNames: ["status", "username", "id"], columnWidths: { username: "9em" } },
    };
    expect(restoreDroppedEntries(captured, dropped).columns).toEqual({
      columnNames: ["status", "username", "id", "email", "roleId"],
      columnWidths: { username: "9em" },
    });
  });

  it("appends hidden sorters after the captured ones", () => {
    const captured: PresetSnapshot = { sorters: [{ field: "status", direction: "desc" }] };
    expect(restoreDroppedEntries(captured, dropped).sorters).toEqual([
      { field: "status", direction: "desc" },
      { field: "email", direction: "desc" },
    ]);
  });

  it("adds hidden filterOps entries and filter inputs back", () => {
    const captured: PresetSnapshot = { filters: ["status"], filterOps: { status: eq("pending") } };
    const out = restoreDroppedEntries(captured, dropped);
    expect(out.filterOps).toEqual({
      status: eq("pending"),
      email: [{ type: "contains", value: ["@"] }],
    });
    expect(out.filters).toEqual(["status", "email"]);
  });

  it("leaves aspects the capture does not carry alone", () => {
    const out = restoreDroppedEntries({ filterOps: {} }, dropped);
    expect(Object.keys(out)).toEqual(["filterOps"]);
  });
});
