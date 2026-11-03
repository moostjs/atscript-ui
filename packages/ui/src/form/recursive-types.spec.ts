import {
  deserializeAnnotatedType,
  serializeAnnotatedType,
  type TAtscriptAnnotatedType,
  type TSerializedAnnotatedType,
} from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import {
  JsonHolder,
  MutualA,
  RecBothItem,
  RecBothShelf,
  RecCategory,
  RecItem,
  RecM,
  RecMU,
  RecShelf,
  RecShelfWithItems,
  RecW,
  TreeNode,
  TupleHolder,
  UnionNode,
} from "../__tests__/fixtures/recursive.as";
import { createTableDef } from "../table/create-table-def";
import type { MetaResponse } from "../table/types";
import { extractValueHelp } from "../value-help/extract-ref";
import { applyFormChanges } from "./apply";
import { createFormDef } from "./create-form-def";
import { buildFormDiff } from "./diff";
import { createFormData } from "./path-utils";
import { buildFormRebase } from "./rebase";
import { omitSkippedNavFields } from "./skipped-nav";
import {
  isArrayField,
  isObjectField,
  isTupleField,
  isUnionField,
  type FormDef,
  type FormFieldDef,
} from "./types";
import { unionVariantChanged } from "./union-detect";
import { getFormValidator } from "./validate";

// ── Helpers ──────────────────────────────────────────────────

const RECURSIVE: Array<[string, TAtscriptAnnotatedType]> = [
  ["self-reference (optional child + array of self)", TreeNode],
  ["mutual reference", MutualA],
  ["union containing self", UnionNode],
  ["recursive alias with no object in between", JsonHolder],
  ["two-way navigation pair", RecShelf],
  ["navigation back-reference", RecItem],
  ["self-referencing table", RecCategory],
  ["navigation field opted in with @ui.form.*", RecShelfWithItems],
  ["recursion through an inlined object", RecM],
  ["recursion through an inlined object, item side", RecW],
  ["recursion through an inlined object and a union", RecMU],
  ["recursive tuple", TupleHolder],
  ["two-way navigation pair, both sides opted in", RecBothShelf],
  ["two-way navigation pair, both sides opted in, item side", RecBothItem],
];

/**
 * Every field of every def reachable from `def` sits at its own position: an
 * object def's fields at paths of that def's flat map, array items and union
 * variants at `""`, tuple items at their index with no name, and every other
 * name is the last path segment. Returns the number of defs visited.
 */
function assertPositions(def: FormDef): number {
  const defs = new Set<FormDef>();
  const fields = new Set<FormFieldDef>();
  const visitDef = (d: FormDef): void => {
    if (defs.has(d)) return;
    defs.add(d);
    for (const f of d.fields) {
      if (d.type.type.kind === "object") expect(d.flatMap.has(f.path), f.path).toBe(true);
      expect(f.name).toBe(f.path.slice(f.path.lastIndexOf(".") + 1));
      visitField(f);
    }
  };
  const visitField = (f: FormFieldDef): void => {
    if (fields.has(f)) return;
    fields.add(f);
    expect(f.type, `${f.path} is built`).toBeDefined();
    if (isObjectField(f)) visitDef(f.objectDef);
    else if (isArrayField(f)) {
      expect(f.itemField.path).toBe("");
      visitField(f.itemField);
    } else if (isTupleField(f)) {
      f.itemFields.forEach((item, i) => {
        expect([item.path, item.name]).toEqual([String(i), ""]);
        visitField(item);
      });
    } else if (isUnionField(f)) {
      for (const v of f.unionVariants) {
        if (v.def) visitDef(v.def);
        if (v.itemField) {
          expect(v.itemField.path).toBe("");
          visitField(v.itemField);
        }
      }
    }
  };
  visitDef(def);
  return defs.size;
}

function field(def: FormDef, path: string): FormFieldDef | undefined {
  return def.fields.find((f) => f.path === path);
}

function paths(def: FormDef): string[] {
  return def.fields.map((f) => f.path);
}

/** Same serialization the db `/meta` endpoint uses (shallow FK refs, `ui.*` kept). */
function metaRoundTrip(type: TAtscriptAnnotatedType): {
  serialized: TSerializedAnnotatedType;
  type: TAtscriptAnnotatedType;
} {
  const serialized = JSON.parse(JSON.stringify(serializeAnnotatedType(type, { refDepth: 0.5 })));
  return { serialized, type: deserializeAnnotatedType(serialized) };
}

function meta(serialized: TSerializedAnnotatedType, fields: string[]): MetaResponse {
  return {
    searchable: false,
    vectorSearchable: false,
    searchIndexes: [],
    primaryKeys: ["id"],
    preferredId: ["id"],
    crud: {},
    actions: [],
    relations: [],
    fields: Object.fromEntries(fields.map((k) => [k, { sortable: true, filterable: true }])),
    type: serialized,
  };
}

// ── Tests ────────────────────────────────────────────────────

describe("recursive types", () => {
  describe.each(RECURSIVE)("%s", (_name, type) => {
    it("createFormDef builds in create and edit mode, every field at its own position", () => {
      expect(assertPositions(createFormDef(type))).toBeGreaterThan(0);
      expect(assertPositions(createFormDef(type, { mode: "edit" }))).toBeGreaterThan(0);
    });

    it("createFormDef builds from the /meta round-trip, every field at its own position", () => {
      const { type: restored } = metaRoundTrip(type);
      expect(assertPositions(createFormDef(restored, { mode: "edit" }))).toBeGreaterThan(0);
    });

    it("form validator, initial data, diff, union detection and rebase run", () => {
      const def = createFormDef(type, { mode: "edit" });
      const data = createFormData(type);
      const validate = getFormValidator(def);
      expect(() => validate({ data: data.value as Record<string, unknown> })).not.toThrow();
      const current = { value: { ...(data.value as object) } };
      expect(() => buildFormDiff(def, data, current)).not.toThrow();
      expect(unionVariantChanged(def, data, current)).toBe(false);
      expect(() => buildFormRebase(def, data, current, data)).not.toThrow();
    });

    it("createTableDef builds from the /meta round-trip", () => {
      const { serialized } = metaRoundTrip(type);
      const table = createTableDef(meta(serialized, ["id", "name", "title"]));
      expect(table.columns.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("plain recursive objects", () => {
    it("a self-reference becomes a nested object field; revisits reuse the def", () => {
      const def = createFormDef(TreeNode);
      expect(paths(def)).toEqual(["name", "parent", "children"]);
      const parent = field(def, "parent")!;
      expect(isObjectField(parent)).toBe(true);
      const children = field(def, "children")!;
      expect(isArrayField(children)).toBe(true);
      if (!isObjectField(parent) || !isArrayField(children)) return;
      // The nested def is complete (not a cut leaf), and the same def at every depth.
      expect(paths(parent.objectDef)).toEqual(["name", "parent", "children"]);
      const deeper = field(parent.objectDef, "parent")!;
      expect(isObjectField(deeper) && deeper.objectDef).toBe(parent.objectDef);
      const item = children.itemField;
      expect(isObjectField(item)).toBe(true);
      if (!isObjectField(item)) return;
      const again = field(item.objectDef, "children")!;
      expect(isArrayField(again) && again.itemField).toBe(item);
    });

    it("validates, diffs and applies nested recursive data", () => {
      const def = createFormDef(TreeNode);
      const baseline = {
        value: { name: "root", children: [{ name: "a", children: [{ name: "b" }] }] },
      };
      const current = {
        value: {
          name: "root",
          parent: { name: "up" },
          children: [{ name: "a", children: [{ name: "b2" }] }],
        },
      };
      const validate = getFormValidator(def);
      expect(validate({ data: current.value })).toEqual({});
      expect(
        validate({ data: { name: "x", children: [{ name: "y", parent: { name: 1 } }] } }),
      ).toHaveProperty(["children.0.parent.name"]);

      const diff = buildFormDiff(def, baseline, current);
      expect(diff.changes.map((c) => c.path).toSorted()).toEqual(["children", "parent.name"]);
      expect(diff.patch).toEqual({
        parent: { name: "up" },
        children: { $replace: current.value.children },
      });
      const next = { value: structuredClone(baseline.value) };
      applyFormChanges(def, next, diff.changes);
      expect(next).toEqual(current);
    });

    it("a mutual reference inlines the plain object and nests where it closes", () => {
      const def = createFormDef(MutualA);
      expect(paths(def)).toEqual(["title", "b.count", "b.a"]);
      const a = field(def, "b.a")!;
      expect(isObjectField(a)).toBe(true);
      if (!isObjectField(a)) return;
      expect(paths(a.objectDef)).toEqual(["title", "b.count", "b.a"]);
      const again = field(a.objectDef, "b.a")!;
      expect(isObjectField(again) && again.objectDef).toBe(a.objectDef);
    });

    it("a union containing the type itself keeps both variants", () => {
      const def = createFormDef(UnionNode);
      const next = field(def, "next")!;
      expect(isUnionField(next)).toBe(true);
      if (!isUnionField(next)) return;
      expect(next.unionVariants).toHaveLength(2);
      const variantDef = next.unionVariants[0]!.def!;
      expect(paths(variantDef)).toEqual(["label", "next"]);
      const nested = field(variantDef, "next")!;
      expect(isUnionField(nested) && nested.unionVariants[0]!.def).toBe(variantDef);
      const changed = unionVariantChanged(
        def,
        { value: { label: "a", next: { label: "b", next: "c" } } },
        { value: { label: "a", next: { label: "b", next: { label: "c" } } } },
      );
      expect(changed).toBe(false);
    });

    it("a recursive alias reuses its field defs for the array items", () => {
      const def = createFormDef(JsonHolder);
      const data = field(def, "data")!;
      expect(isUnionField(data)).toBe(true);
      if (!isUnionField(data)) return;
      const arrayVariant = data.unionVariants[2]!.itemField!;
      expect(isArrayField(arrayVariant)).toBe(true);
      if (!isArrayField(arrayVariant)) return;
      const item = arrayVariant.itemField;
      expect(isUnionField(item) && item.unionVariants.map((v) => v.label)).toEqual([
        "1. String",
        "2. Number",
        "3. Array",
      ]);
      expect(isUnionField(item) && item.unionVariants[2]!.itemField).toBe(arrayVariant);
      const validate = getFormValidator(def);
      expect(validate({ data: { data: [1, ["a", [2]]] } })).toEqual({});
      expect(validate({ data: { data: [true] } })).not.toEqual({});
    });
  });

  describe("a recursion back to a field at another path", () => {
    it("an array reached again through an inlined object keeps its own path", () => {
      const def = createFormDef(RecM);
      const kids = field(def, "kids")!;
      if (!isArrayField(kids) || !isObjectField(kids.itemField)) throw new Error("kids");
      const item = kids.itemField.objectDef;
      expect(paths(item)).toEqual(["label", "m.title", "m.kids"]);
      const inner = field(item, "m.kids")!;
      expect([inner.path, inner.name]).toEqual(["m.kids", "kids"]);
      // The W side builds the same shape, and the patch lands at the right keys.
      expect(paths(createFormDef(RecW))).toEqual(["label", "m.title", "m.kids"]);
      const baseline = { value: { title: "t", kids: [{ label: "a", m: { title: "x" } }] } };
      const current = {
        value: { title: "t", kids: [{ label: "a", m: { title: "x", kids: [{ label: "z" }] } }] },
      };
      expect(buildFormDiff(def, baseline, current).patch).toEqual({
        kids: { $replace: current.value.kids },
      });
    });

    it("the same through a union", () => {
      const def = createFormDef(RecMU);
      const x = field(def, "x")!;
      if (!isUnionField(x)) throw new Error("x");
      const variant = x.unionVariants[0]!.def!;
      expect(paths(variant)).toEqual(["label", "m.title", "m.x"]);
      expect(field(variant, "m.x")!.name).toBe("x");
    });

    it("both sides of a navigation pair opted in: each a section at its own path", () => {
      const shelf = createFormDef(RecBothShelf, { mode: "edit" });
      expect(paths(shelf)).toEqual(["items", "id", "name"]);
      const items = field(shelf, "items")!;
      if (!isArrayField(items) || !isObjectField(items.itemField)) throw new Error("items");
      const item = items.itemField.objectDef;
      // The opted-in `shelf` is a section, never inlined as `shelf.*` columns.
      expect(paths(item)).toEqual(["shelf", "id", "title", "shelfId"]);
      const back = field(item, "shelf")!;
      expect(isObjectField(back) && paths(back.objectDef)).toEqual(["items", "id", "name"]);
      expect(paths(createFormDef(RecBothItem))).toEqual(["shelf", "id", "title", "shelfId"]);
    });

    it("a recursive tuple: items at their index, the nested tuple built", () => {
      const def = createFormDef(TupleHolder);
      const t = field(def, "t")!;
      if (!isTupleField(t)) throw new Error("t");
      expect(t.itemFields.map((f) => [f.path, f.name, f.type])).toEqual([
        ["0", "", "text"],
        ["1", "", "union"],
      ]);
      expect(getFormValidator(def)({ data: { t: ["a", ["b", null]] } })).toEqual({});
    });
  });

  describe("navigation fields", () => {
    it("are skipped by default (from / to)", () => {
      expect(paths(createFormDef(RecShelf))).toEqual(["id", "name"]);
      expect(paths(createFormDef(RecItem))).toEqual(["id", "title", "shelfId"]);
      expect(paths(createFormDef(RecCategory, { mode: "edit" }))).toEqual([
        "id",
        "name",
        "parentId",
      ]);
    });

    it("are skipped after the /meta round-trip", () => {
      expect(paths(createFormDef(metaRoundTrip(RecShelf).type))).toEqual(["id", "name"]);
      expect(paths(createFormDef(metaRoundTrip(RecCategory).type))).toEqual([
        "id",
        "name",
        "parentId",
      ]);
    });

    it("are included when they carry an explicit @ui.form.* annotation", () => {
      for (const type of [RecShelfWithItems, metaRoundTrip(RecShelfWithItems).type]) {
        const def = createFormDef(type);
        expect(paths(def)).toEqual(["items", "id", "name"]);
        const items = field(def, "items")!;
        expect(isArrayField(items)).toBe(true);
        if (!isArrayField(items) || !isObjectField(items.itemField)) return;
        // The item's own back-reference has no @ui.form.* and stays out.
        expect(paths(items.itemField.objectDef)).toEqual(["id", "title", "shelfId"]);
      }
    });

    it("are not validated or diffed when skipped", () => {
      const def = createFormDef(RecShelf, { mode: "edit" });
      const baseline = { value: { id: 1, name: "s", items: [{ id: 1, title: "t", shelfId: 1 }] } };
      const current = { value: { id: 1, name: "s2", items: [] } };
      expect(buildFormDiff(def, baseline, current).patch).toEqual({ name: "s2" });
      // Loaded related rows the form does not render cannot block a submit.
      const loaded = { id: 1, name: "s", items: [{ id: "x", title: 1 }] };
      expect(getFormValidator(def)({ data: loaded })).toEqual({});
      const optedIn = createFormDef(RecShelfWithItems);
      expect(getFormValidator(optedIn)({ data: loaded })).not.toEqual({});
    });

    it("are left out of the submitted data and of whole values in the patch", () => {
      // A create / duplicate form seeded from a row loaded with `$with`.
      const row = { id: 1, name: "s", items: [{ id: 1, title: "t", shelfId: 1 }] };
      expect(omitSkippedNavFields(createFormDef(RecShelf), row)).toEqual({ id: 1, name: "s" });
      expect(row.items).toHaveLength(1); // a copy: the form data is untouched

      // An opted-in array of related rows: each row's own back-reference stays out.
      const def = createFormDef(RecShelfWithItems, { mode: "edit" });
      const shelf = { id: 1, name: "s" };
      const baseline = { value: { ...shelf, items: [{ id: 1, title: "a", shelfId: 1, shelf }] } };
      const current = {
        value: { ...shelf, items: [{ id: 1, title: "b", shelfId: 1, shelf }] },
      };
      expect(buildFormDiff(def, baseline, current).patch).toEqual({
        items: { $replace: [{ id: 1, title: "b", shelfId: 1 }] },
      });
      expect(omitSkippedNavFields(def, current.value)).toEqual({
        ...shelf,
        items: [{ id: 1, title: "b", shelfId: 1 }],
      });
    });

    it("FK value help on a self-referencing table resolves", () => {
      const parentId = (
        RecCategory.type as { props: Map<string, TAtscriptAnnotatedType> }
      ).props.get("parentId")!;
      expect(() => extractValueHelp(parentId)).not.toThrow();
    });
  });
});
