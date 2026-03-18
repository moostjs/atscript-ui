import { defineAnnotatedType, serializeAnnotatedType } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import {
  META_LABEL,
  UI_HIDDEN,
  UI_ICON,
  UI_ORDER,
  UI_TYPE,
  UI_WIDTH,
} from "../shared/annotation-keys";
import {
  getColumn,
  getFilterableColumns,
  getSortableColumns,
  getVisibleColumns,
} from "./column-resolver";
import { createTableDef } from "./create-table-def";
import type { MetaResponse } from "./types";

// ── Helpers ──────────────────────────────────────────────────

function stringProp(meta?: Record<string, unknown>) {
  const h = defineAnnotatedType().designType("string");
  if (meta) {
    for (const [k, v] of Object.entries(meta)) h.annotate(k as keyof AtscriptMetadata, v as never);
  }
  return h.$type;
}

function numberProp(meta?: Record<string, unknown>) {
  const h = defineAnnotatedType().designType("number");
  if (meta) {
    for (const [k, v] of Object.entries(meta)) h.annotate(k as keyof AtscriptMetadata, v as never);
  }
  return h.$type;
}

function booleanProp() {
  return defineAnnotatedType().designType("boolean").$type;
}

function buildMeta(
  props: Record<string, ReturnType<typeof stringProp>>,
  fields?: Record<string, { sortable: boolean; filterable: boolean }>,
  overrides?: Partial<MetaResponse>,
): MetaResponse {
  const objectType = defineAnnotatedType("object");
  for (const [name, prop] of Object.entries(props)) objectType.prop(name, prop);
  const serialized = serializeAnnotatedType(objectType.$type);

  return {
    searchable: false,
    vectorSearchable: false,
    searchIndexes: [],
    primaryKeys: [],
    readOnly: false,
    relations: [],
    fields:
      fields ??
      Object.fromEntries(Object.keys(props).map((k) => [k, { sortable: false, filterable: true }])),
    type: serialized as unknown as Record<string, unknown>,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────

describe("createTableDef", () => {
  it("creates columns for a simple object type", () => {
    const meta = buildMeta({
      name: stringProp(),
      age: numberProp(),
      active: booleanProp(),
    });
    const def = createTableDef(meta);

    expect(def.columns).toHaveLength(3);
    expect(def.columns.map((c) => c.path)).toEqual(
      expect.arrayContaining(["name", "age", "active"]),
    );
  });

  it("infers display type from designType", () => {
    const meta = buildMeta({
      name: stringProp(),
      age: numberProp(),
      active: booleanProp(),
    });
    const def = createTableDef(meta);

    expect(def.columns.find((c) => c.path === "name")!.type).toBe("text");
    expect(def.columns.find((c) => c.path === "age")!.type).toBe("number");
    expect(def.columns.find((c) => c.path === "active")!.type).toBe("boolean");
  });

  it("uses @meta.label for column label", () => {
    const meta = buildMeta({
      firstName: stringProp({ [META_LABEL]: "First Name" }),
    });
    const def = createTableDef(meta);

    expect(def.columns[0]!.label).toBe("First Name");
  });

  it("humanizes path when no @meta.label", () => {
    const meta = buildMeta({
      firstName: stringProp(),
    });
    const def = createTableDef(meta);

    expect(def.columns[0]!.label).toBe("First Name");
  });

  it("uses @ui.type override", () => {
    const meta = buildMeta({
      bio: stringProp({ [UI_TYPE]: "textarea" }),
    });
    const def = createTableDef(meta);

    expect(def.columns[0]!.type).toBe("textarea");
  });

  it("sorts columns by @ui.order", () => {
    const meta = buildMeta({
      email: stringProp({ [UI_ORDER]: 2 }),
      name: stringProp({ [UI_ORDER]: 1 }),
      bio: stringProp({ [UI_ORDER]: 3 }),
    });
    const def = createTableDef(meta);

    expect(def.columns.map((c) => c.path)).toEqual(["name", "email", "bio"]);
  });

  it("@ui.hidden sets visible: false", () => {
    const meta = buildMeta({
      secret: stringProp({ [UI_HIDDEN]: true }),
      visible: stringProp(),
    });
    const def = createTableDef(meta);

    expect(def.columns.find((c) => c.path === "secret")!.visible).toBe(false);
    expect(def.columns.find((c) => c.path === "visible")!.visible).toBe(true);
  });

  it("reads @ui.width and @ui.icon", () => {
    const meta = buildMeta({
      name: stringProp({ [UI_WIDTH]: "half", [UI_ICON]: "user" }),
    });
    const def = createTableDef(meta);

    expect(def.columns[0]!.width).toBe("half");
    expect(def.columns[0]!.icon).toBe("user");
  });

  it("reads sortable/filterable from meta.fields", () => {
    const meta = buildMeta(
      { name: stringProp(), age: numberProp() },
      {
        name: { sortable: true, filterable: true },
        age: { sortable: false, filterable: false },
      },
    );
    const def = createTableDef(meta);

    expect(def.columns.find((c) => c.path === "name")!.sortable).toBe(true);
    expect(def.columns.find((c) => c.path === "name")!.filterable).toBe(true);
    expect(def.columns.find((c) => c.path === "age")!.sortable).toBe(false);
    expect(def.columns.find((c) => c.path === "age")!.filterable).toBe(false);
  });

  it("fields not in meta.fields default to not sortable/filterable", () => {
    const meta = buildMeta({ name: stringProp() }, {});
    const def = createTableDef(meta);

    expect(def.columns[0]!.sortable).toBe(false);
    expect(def.columns[0]!.filterable).toBe(false);
  });

  it("passes through primaryKeys, readOnly, searchable flags", () => {
    const meta = buildMeta({ id: stringProp() }, undefined, {
      primaryKeys: ["id"],
      readOnly: true,
      searchable: true,
      vectorSearchable: true,
    });
    const def = createTableDef(meta);

    expect(def.primaryKeys).toEqual(["id"]);
    expect(def.readOnly).toBe(true);
    expect(def.searchable).toBe(true);
    expect(def.vectorSearchable).toBe(true);
  });

  it("passes through relations and searchIndexes", () => {
    const meta = buildMeta({ id: stringProp() }, undefined, {
      relations: [{ name: "author", direction: "to", isArray: false }],
      searchIndexes: [{ name: "default", type: "text" }],
    });
    const def = createTableDef(meta);

    expect(def.relations).toHaveLength(1);
    expect(def.relations[0]!.name).toBe("author");
    expect(def.searchIndexes).toHaveLength(1);
    expect(def.searchIndexes[0]!.name).toBe("default");
  });
});

// ── Column resolver helpers ──────────────────────────────────

describe("column-resolver", () => {
  const meta = buildMeta(
    {
      id: stringProp({ [UI_ORDER]: 1 }),
      name: stringProp({ [UI_ORDER]: 2 }),
      secret: stringProp({ [UI_HIDDEN]: true, [UI_ORDER]: 3 }),
    },
    {
      id: { sortable: true, filterable: true },
      name: { sortable: false, filterable: true },
      secret: { sortable: false, filterable: false },
    },
  );
  const def = createTableDef(meta);

  it("getVisibleColumns filters hidden columns", () => {
    const visible = getVisibleColumns(def);
    expect(visible).toHaveLength(2);
    expect(visible.map((c) => c.path)).toEqual(["id", "name"]);
  });

  it("getSortableColumns returns only sortable", () => {
    const sortable = getSortableColumns(def);
    expect(sortable).toHaveLength(1);
    expect(sortable[0]!.path).toBe("id");
  });

  it("getFilterableColumns returns only filterable", () => {
    const filterable = getFilterableColumns(def);
    expect(filterable).toHaveLength(2);
    expect(filterable.map((c) => c.path)).toEqual(expect.arrayContaining(["id", "name"]));
  });

  it("getColumn finds by path", () => {
    expect(getColumn(def, "name")?.path).toBe("name");
    expect(getColumn(def, "nonexistent")).toBeUndefined();
  });
});
