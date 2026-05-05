import { defineAnnotatedType, serializeAnnotatedType } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import {
  DB_AMOUNT_CURRENCY,
  DB_AMOUNT_CURRENCY_REF,
  DB_COLUMN_PRECISION,
  DB_JSON,
  DB_UNIT,
  DB_UNIT_REF,
  META_LABEL,
  UI_FORM_HIDDEN,
  UI_FORM_ORDER,
  UI_TABLE_HIDDEN,
  UI_TABLE_ORDER,
  UI_TABLE_TYPE,
  UI_TABLE_WIDTH,
  UI_TYPE,
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
    preferredId: [],
    crud: {},
    actions: [],
    relations: [],
    fields:
      fields ??
      Object.fromEntries(Object.keys(props).map((k) => [k, { sortable: false, filterable: true }])),
    type: serialized,
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

  it("uses bare @ui.type as the cell renderer when no @ui.table.type override exists", () => {
    const meta = buildMeta({
      bio: stringProp({ [UI_TYPE]: "textarea" }),
    });
    const def = createTableDef(meta);

    expect(def.columns[0]!.type).toBe("textarea");
  });

  it("@ui.table.type wins over @ui.type for the cell renderer", () => {
    const meta = buildMeta({
      bio: stringProp({ [UI_TYPE]: "textarea", [UI_TABLE_TYPE]: "rich-text" }),
    });
    const def = createTableDef(meta);

    expect(def.columns[0]!.type).toBe("rich-text");
  });

  it("sorts columns by @ui.table.order", () => {
    const meta = buildMeta({
      email: stringProp({ [UI_TABLE_ORDER]: 2 }),
      name: stringProp({ [UI_TABLE_ORDER]: 1 }),
      bio: stringProp({ [UI_TABLE_ORDER]: 3 }),
    });
    const def = createTableDef(meta);

    expect(def.columns.map((c) => c.path)).toEqual(["name", "email", "bio"]);
  });

  it("@ui.form.order does NOT influence column order", () => {
    const meta = buildMeta({
      email: stringProp({ [UI_FORM_ORDER]: 1 }),
      name: stringProp({ [UI_FORM_ORDER]: 2 }),
    });
    const def = createTableDef(meta);

    // No @ui.table.order → both sort to Infinity → natural insertion order preserved.
    expect(def.columns.map((c) => c.path)).toEqual(["email", "name"]);
  });

  it("@ui.table.hidden sets visible: false", () => {
    const meta = buildMeta({
      secret: stringProp({ [UI_TABLE_HIDDEN]: true }),
      visible: stringProp(),
    });
    const def = createTableDef(meta);

    expect(def.columns.find((c) => c.path === "secret")!.visible).toBe(false);
    expect(def.columns.find((c) => c.path === "visible")!.visible).toBe(true);
  });

  it("@ui.form.hidden does NOT hide the table column", () => {
    const meta = buildMeta({
      internal: stringProp({ [UI_FORM_HIDDEN]: true }),
    });
    const def = createTableDef(meta);

    expect(def.columns[0]!.visible).toBe(true);
  });

  it("reads @ui.table.width", () => {
    const meta = buildMeta({
      name: stringProp({ [UI_TABLE_WIDTH]: "240px" }),
    });
    const def = createTableDef(meta);

    expect(def.columns[0]!.width).toBe("240px");
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

  it("passes through primaryKeys, crud, searchable flags", () => {
    const meta = buildMeta({ id: stringProp() }, undefined, {
      primaryKeys: ["id"],
      preferredId: ["id"],
      crud: { query: [], pages: [], one: [] },
      searchable: true,
      vectorSearchable: true,
    });
    const def = createTableDef(meta);

    expect(def.primaryKeys).toEqual(["id"]);
    expect(def.preferredId).toEqual(["id"]);
    expect(def.crud).toEqual({ query: [], pages: [], one: [] });
    expect(def.canRemove).toBe(false);
    expect(def.searchable).toBe(true);
    expect(def.vectorSearchable).toBe(true);
  });

  it("preferredId comes from meta when distinct from primaryKeys", () => {
    const meta = buildMeta({ id: stringProp(), slug: stringProp() }, undefined, {
      primaryKeys: ["id"],
      preferredId: ["slug"],
    });
    const def = createTableDef(meta);

    expect(def.primaryKeys).toEqual(["id"]);
    expect(def.preferredId).toEqual(["slug"]);
  });

  it("preferredId falls back to primaryKeys when meta omits it (legacy server)", () => {
    const meta = buildMeta({ id: stringProp() }, undefined, {
      primaryKeys: ["id"],
    });
    delete (meta as { preferredId?: unknown }).preferredId;
    const def = createTableDef(meta);

    expect(def.preferredId).toEqual(["id"]);
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

  // ── FK / value-help columns (uses pre-compiled .as fixtures) ─

  it("FK column gets valueHelpInfo and type: ref", async () => {
    const { BookForm } = await import("../__tests__/fixtures/value-help-fk.as");
    const serialized = serializeAnnotatedType(BookForm, { refDepth: 1 });
    const meta: MetaResponse = {
      searchable: false,
      vectorSearchable: false,
      searchIndexes: [],
      primaryKeys: ["authorId"],
      preferredId: ["authorId"],
      crud: { query: [], pages: [], one: [] },
      actions: [],
      relations: [],
      fields: {
        title: { sortable: false, filterable: true },
        authorId: { sortable: true, filterable: true },
      },
      type: serialized,
    };

    const def = createTableDef(meta);
    const authorCol = def.columns.find((c) => c.path === "authorId");

    expect(authorCol).toBeDefined();
    expect(authorCol!.type).toBe("ref");
    expect(authorCol!.valueHelpInfo).toBeDefined();
    expect(authorCol!.valueHelpInfo!.url).toBe("/authors");
    expect(authorCol!.valueHelpInfo!.targetField).toBe("id");
  });

  // ── Quantity tagging (currency / unit / precision) ──────────

  it("timestamp-tagged number → cell-type 'datetime'", () => {
    const ts = defineAnnotatedType().designType("number").tags("timestamp").$type;
    const meta = buildMeta({ createdAt: ts });
    const def = createTableDef(meta);
    expect(def.columns.find((c) => c.path === "createdAt")!.type).toBe("datetime");
  });

  it("plain number (no timestamp tag) stays cell-type 'number'", () => {
    const meta = buildMeta({ count: numberProp() });
    const def = createTableDef(meta);
    expect(def.columns.find((c) => c.path === "count")!.type).toBe("number");
  });

  it("decimal designType maps to cell-type 'number'", () => {
    const dec = defineAnnotatedType().designType("decimal").$type;
    const meta = buildMeta({ price: dec });
    const def = createTableDef(meta);
    expect(def.columns.find((c) => c.path === "price")!.type).toBe("number");
  });

  it("reads @db.amount.currency literal onto column.currencyCode", () => {
    const dec = defineAnnotatedType()
      .designType("decimal")
      .annotate(DB_AMOUNT_CURRENCY as keyof AtscriptMetadata, "USD" as never).$type;
    const meta = buildMeta({ price: dec });
    const col = createTableDef(meta).columns.find((c) => c.path === "price")!;
    expect(col.currencyCode).toBe("USD");
    expect(col.currencyRefField).toBeUndefined();
  });

  it("reads @db.amount.currency.ref onto column.currencyRefField", () => {
    const dec = defineAnnotatedType()
      .designType("decimal")
      .annotate(DB_AMOUNT_CURRENCY_REF as keyof AtscriptMetadata, "currency" as never).$type;
    const meta = buildMeta({ total: dec });
    const col = createTableDef(meta).columns.find((c) => c.path === "total")!;
    expect(col.currencyRefField).toBe("currency");
    expect(col.currencyCode).toBeUndefined();
  });

  it("reads @db.unit literal onto column.unitCode", () => {
    const dec = defineAnnotatedType()
      .designType("decimal")
      .annotate(DB_UNIT as keyof AtscriptMetadata, "kg" as never).$type;
    const col = createTableDef(buildMeta({ weight: dec })).columns.find(
      (c) => c.path === "weight",
    )!;
    expect(col.unitCode).toBe("kg");
  });

  it("reads @db.unit.ref onto column.unitRefField", () => {
    const dec = defineAnnotatedType()
      .designType("decimal")
      .annotate(DB_UNIT_REF as keyof AtscriptMetadata, "unit" as never).$type;
    const col = createTableDef(buildMeta({ value: dec })).columns.find((c) => c.path === "value")!;
    expect(col.unitRefField).toBe("unit");
  });

  it("reads @db.column.precision scale onto column.precisionScale", () => {
    const dec = defineAnnotatedType()
      .designType("decimal")
      .annotate(
        DB_COLUMN_PRECISION as keyof AtscriptMetadata,
        { precision: 10, scale: 2 } as never,
      ).$type;
    const col = createTableDef(buildMeta({ price: dec })).columns.find((c) => c.path === "price")!;
    expect(col.precisionScale).toBe(2);
  });

  // ── Flat-flattened nested objects vs. @db.json atomic columns ─

  it("skips flat-flattened object parents — only leaves become columns", () => {
    // `profile: { firstName, lastName }` with no `@db.json` is server-flattened
    // into physical columns `profile__firstName` / `profile__lastName`. The wire
    // meta.fields lists `profile.firstName` + `profile.lastName` (NOT `profile`).
    // The synthetic parent `profile` would otherwise leak as a JSON-rendered
    // column on top of its real leaves.
    const profileObj = defineAnnotatedType("object")
      .prop("firstName", stringProp())
      .prop("lastName", stringProp()).$type;
    const objectType = defineAnnotatedType("object")
      .prop("name", stringProp())
      .prop("profile", profileObj);
    const serialized = serializeAnnotatedType(objectType.$type);
    const meta: MetaResponse = {
      searchable: false,
      vectorSearchable: false,
      searchIndexes: [],
      primaryKeys: [],
      preferredId: [],
      crud: {},
      actions: [],
      relations: [],
      fields: {
        name: { sortable: false, filterable: true },
        "profile.firstName": { sortable: false, filterable: true },
        "profile.lastName": { sortable: false, filterable: true },
      },
      type: serialized,
    };
    const def = createTableDef(meta);
    const paths = def.columns.map((c) => c.path);
    expect(paths).toEqual(
      expect.arrayContaining(["name", "profile.firstName", "profile.lastName"]),
    );
    expect(paths).not.toContain("profile");
  });

  it("forces @db.json columns to sortable=false / filterable=false even if server says otherwise", () => {
    // Defensive client-side workaround for an atscript-db bug: `/meta` emits
    // `filterable: true` by default for every non-ignored field, including
    // `@db.json` atomic JSON columns where filter/sort don't apply. The table
    // def must zero those out regardless of wire flags.
    const addressObj = defineAnnotatedType("object")
      .prop("street", stringProp())
      .prop("city", stringProp())
      .annotate(DB_JSON as keyof AtscriptMetadata, true as never).$type;
    const objectType = defineAnnotatedType("object")
      .prop("name", stringProp())
      .prop("address", addressObj);
    const serialized = serializeAnnotatedType(objectType.$type);
    const meta: MetaResponse = {
      searchable: false,
      vectorSearchable: false,
      searchIndexes: [],
      primaryKeys: [],
      preferredId: [],
      crud: {},
      actions: [],
      relations: [],
      // Server (incorrectly) reports both as filterable/sortable.
      fields: {
        name: { sortable: true, filterable: true },
        address: { sortable: true, filterable: true },
      },
      type: serialized,
    };
    const def = createTableDef(meta);
    const addressCol = def.columns.find((c) => c.path === "address")!;
    expect(addressCol.filterable).toBe(false);
    expect(addressCol.sortable).toBe(false);
    // Sanity: non-JSON column still honours the wire flags.
    const nameCol = def.columns.find((c) => c.path === "name")!;
    expect(nameCol.filterable).toBe(true);
    expect(nameCol.sortable).toBe(true);
  });

  it("keeps @db.json (atomic) object parent as a single column", () => {
    // `address: { street, city }` with `@db.json` is stored as one JSON column;
    // its sub-paths are NOT in meta.fields. The parent stays as a single column
    // (rendered via the JSON popover cell).
    const addressObj = defineAnnotatedType("object")
      .prop("street", stringProp())
      .prop("city", stringProp()).$type;
    const objectType = defineAnnotatedType("object")
      .prop("name", stringProp())
      .prop("address", addressObj);
    const serialized = serializeAnnotatedType(objectType.$type);
    const meta: MetaResponse = {
      searchable: false,
      vectorSearchable: false,
      searchIndexes: [],
      primaryKeys: [],
      preferredId: [],
      crud: {},
      actions: [],
      relations: [],
      fields: {
        name: { sortable: false, filterable: true },
        address: { sortable: false, filterable: false },
      },
      type: serialized,
    };
    const def = createTableDef(meta);
    const paths = def.columns.map((c) => c.path);
    expect(paths).toEqual(expect.arrayContaining(["name", "address"]));
    expect(paths).not.toContain("address.street");
    expect(paths).not.toContain("address.city");
  });

  it("non-FK columns have undefined valueHelpInfo", () => {
    const meta = buildMeta({ name: stringProp(), age: numberProp() });
    const def = createTableDef(meta);

    for (const col of def.columns) {
      expect(col.valueHelpInfo).toBeUndefined();
    }
  });
});

// ── Column resolver helpers ──────────────────────────────────

describe("column-resolver", () => {
  const meta = buildMeta(
    {
      id: stringProp({ [UI_TABLE_ORDER]: 1 }),
      name: stringProp({ [UI_TABLE_ORDER]: 2 }),
      secret: stringProp({ [UI_TABLE_HIDDEN]: true, [UI_TABLE_ORDER]: 3 }),
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
