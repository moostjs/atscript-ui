import { defineAnnotatedType, serializeAnnotatedType } from "@atscript/typescript/utils";
import type { TDbActionInfo, TCrudPermissions } from "@atscript/db-client";
import { describe, expect, it } from "vitest";
import { createTableDef } from "../create-table-def";
import type { MetaResponse } from "../types";

function buildMeta(actions: TDbActionInfo[], crud: TCrudPermissions = {}): MetaResponse {
  const obj = defineAnnotatedType("object");
  const id = defineAnnotatedType().designType("string");
  obj.prop("id", id.$type);
  return {
    searchable: false,
    vectorSearchable: false,
    searchIndexes: [],
    primaryKeys: ["id"],
    preferredId: ["id"],
    crud,
    actions,
    relations: [],
    fields: { id: { sortable: false, filterable: false } },
    type: serializeAnnotatedType(obj.$type),
  };
}

const A = (
  name: string,
  level: TDbActionInfo["level"],
  extra: Partial<TDbActionInfo> = {},
): TDbActionInfo => ({
  name,
  label: name,
  level,
  processor: "backend",
  value: `/x/${name}`,
  ...extra,
});

describe("createTableDef — actions grouping", () => {
  it("empty actions array → all groups empty + no defaults", () => {
    const def = createTableDef(buildMeta([]));
    expect(def.actions.table).toEqual([]);
    expect(def.actions.row).toEqual([]);
    expect(def.actions.rows).toEqual([]);
    expect(def.actions.default).toEqual({});
  });

  it("partitions mixed-level actions", () => {
    const def = createTableDef(
      buildMeta([A("t1", "table"), A("r1", "row"), A("rs1", "rows"), A("r2", "row")]),
    );
    expect(def.actions.table.map((a) => a.name)).toEqual(["t1"]);
    expect(def.actions.row.map((a) => a.name)).toEqual(["r1", "r2"]);
    expect(def.actions.rows.map((a) => a.name)).toEqual(["rs1"]);
  });

  it("sorts each group by (order ?? 0) then declaration order", () => {
    const def = createTableDef(
      buildMeta([
        A("a", "row", { order: 2 }),
        A("b", "row", { order: 1 }),
        A("c", "row"),
        A("d", "row", { order: 0 }),
      ]),
    );
    // c (0, declared 3rd) and d (0, declared 4th) tie on order=0 → declaration wins.
    // b (order=1) sits between the 0-tier and a (order=2).
    expect(def.actions.row.map((a) => a.name)).toEqual(["c", "d", "b", "a"]);
  });

  it("picks first default: true per level", () => {
    const def = createTableDef(
      buildMeta([
        A("a", "row"),
        A("b", "row", { default: true }),
        A("t1", "table", { default: true }),
      ]),
    );
    expect(def.actions.default.row?.name).toBe("b");
    expect(def.actions.default.table?.name).toBe("t1");
    expect(def.actions.default.rows).toBeUndefined();
  });

  it("multiple defaults at same level — first wins, second still listed", () => {
    const def = createTableDef(
      buildMeta([A("a", "row", { default: true }), A("b", "row", { default: true })]),
    );
    expect(def.actions.default.row?.name).toBe("a");
    expect(def.actions.row.map((a) => a.name)).toEqual(["a", "b"]);
  });

  it("derives canRemove from crud", () => {
    const def = createTableDef(
      buildMeta([], {
        query: [],
        pages: [],
        one: [],
        insert: [],
        update: [],
        replace: [],
        remove: [],
      }),
    );
    expect(def.canRemove).toBe(true);
    expect(def.crud).toEqual({
      query: [],
      pages: [],
      one: [],
      insert: [],
      update: [],
      replace: [],
      remove: [],
    });
  });

  it("canRemove false when crud is empty", () => {
    const def = createTableDef(buildMeta([], {}));
    expect(def.canRemove).toBe(false);
    expect(def.crud).toEqual({});
  });

  it("read-only-but-readable surface", () => {
    const def = createTableDef(buildMeta([], { query: [], pages: [], one: [] }));
    expect(def.canRemove).toBe(false);
    expect("query" in def.crud).toBe(true);
    expect("insert" in def.crud).toBe(false);
  });
});
