import { serializeAnnotatedType, type TSerializedAnnotatedType } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import { getColumn, getFilterableColumns, getSortableColumns } from "./column-resolver";
import { createTableDef } from "./create-table-def";
import type { MetaResponse } from "./types";

// ── Helpers ──────────────────────────────────────────────────

/**
 * Build a `MetaResponse` from a pre-serialized atscript type. `MetaResponse`
 * is a wire shape — only its `type` field comes from an `.as` fixture; the
 * surrounding meta (crud, primaryKeys, fields, …) stays a plain object.
 */
function buildMeta(
  serialized: TSerializedAnnotatedType,
  fieldNames: readonly string[],
  fields?: Record<string, { sortable: boolean; filterable: boolean }>,
  overrides?: Partial<MetaResponse>,
): MetaResponse {
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
      Object.fromEntries(fieldNames.map((k) => [k, { sortable: false, filterable: true }])),
    type: serialized,
    ...overrides,
  };
}

const F = "../__tests__/fixtures/create-table-def.as";

// ── Tests ────────────────────────────────────────────────────

describe("createTableDef", () => {
  it("creates columns for a simple object type", async () => {
    const { SimpleObject } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(SimpleObject), ["name", "age", "active"]);
    const def = createTableDef(meta);

    expect(def.columns).toHaveLength(3);
    expect(def.columns.map((c) => c.path)).toEqual(
      expect.arrayContaining(["name", "age", "active"]),
    );
  });

  it("infers display type from designType", async () => {
    const { SimpleObject } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(SimpleObject), ["name", "age", "active"]);
    const def = createTableDef(meta);

    expect(def.columns.find((c) => c.path === "name")!.type).toBe("text");
    expect(def.columns.find((c) => c.path === "age")!.type).toBe("number");
    expect(def.columns.find((c) => c.path === "active")!.type).toBe("boolean");
  });

  it("uses @meta.label for column label", async () => {
    const { WithLabel } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(WithLabel), ["firstName"]);
    const def = createTableDef(meta);

    expect(def.columns[0]!.label).toBe("First Name");
  });

  it("humanizes path when no @meta.label", async () => {
    const { WithoutLabel } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(WithoutLabel), ["firstName"]);
    const def = createTableDef(meta);

    expect(def.columns[0]!.label).toBe("First Name");
  });

  it("uses bare @ui.type as the cell renderer when no @ui.table.type override exists", async () => {
    const { WithUiType } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(WithUiType), ["bio"]);
    const def = createTableDef(meta);

    expect(def.columns[0]!.type).toBe("textarea");
  });

  it("@ui.table.type wins over @ui.type for the cell renderer", async () => {
    const { WithUiTableType } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(WithUiTableType), ["bio"]);
    const def = createTableDef(meta);

    expect(def.columns[0]!.type).toBe("rich-text");
  });

  it("sorts columns by @ui.table.order", async () => {
    const { WithTableOrder } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(WithTableOrder), ["email", "name", "bio"]);
    const def = createTableDef(meta);

    expect(def.columns.map((c) => c.path)).toEqual(["name", "email", "bio"]);
  });

  it("@ui.form.order does NOT influence column order", async () => {
    const { WithFormOrder } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(WithFormOrder), ["email", "name"]);
    const def = createTableDef(meta);

    // No @ui.table.order → both sort to Infinity → natural insertion order preserved.
    expect(def.columns.map((c) => c.path)).toEqual(["email", "name"]);
  });

  it("@ui.table.exclude removes the column", async () => {
    const { WithTableExclude } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(WithTableExclude), ["secret", "visible"]);
    const def = createTableDef(meta);

    // Excluded field never becomes a column …
    expect(def.columns.some((c) => c.path === "secret")).toBe(false);
    // … but stays fetchable so it remains a valid @ui.table.selectWith target.
    expect(def.fetchableFields.has("secret")).toBe(true);
    // Non-excluded sibling stays a column.
    expect(def.columns.some((c) => c.path === "visible")).toBe(true);
  });

  it("@ui.form.hidden does NOT hide the table column", async () => {
    const { WithFormHidden } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(WithFormHidden), ["internal"]);
    const def = createTableDef(meta);

    expect(def.columns.some((c) => c.path === "internal")).toBe(true);
  });

  it("reads @ui.table.width", async () => {
    const { WithTableWidth } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(WithTableWidth), ["name"]);
    const def = createTableDef(meta);

    expect(def.columns[0]!.width).toBe("240px");
  });

  it("collects @ui.table.selectWith into column.selectWith", async () => {
    const { WithSelectWith } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(WithSelectWith), ["fullName", "plain"]);
    const def = createTableDef(meta);

    expect(def.columns.find((c) => c.path === "fullName")!.selectWith).toEqual([
      "firstName",
      "lastName",
    ]);
  });

  it("column.selectWith is undefined when no @ui.table.selectWith", async () => {
    const { WithSelectWith } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(WithSelectWith), ["fullName", "plain"]);
    const def = createTableDef(meta);

    expect(def.columns.find((c) => c.path === "plain")!.selectWith).toBeUndefined();
  });

  it("reads sortable/filterable from meta.fields", async () => {
    const { NameAndAge } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(NameAndAge), ["name", "age"], {
      name: { sortable: true, filterable: true },
      age: { sortable: false, filterable: false },
    });
    const def = createTableDef(meta);

    expect(def.columns.find((c) => c.path === "name")!.sortable).toBe(true);
    expect(def.columns.find((c) => c.path === "name")!.filterable).toBe(true);
    expect(def.columns.find((c) => c.path === "age")!.sortable).toBe(false);
    expect(def.columns.find((c) => c.path === "age")!.filterable).toBe(false);
  });

  it("nullable flag mirrors prop.optional", async () => {
    // Required prop → nullable: false; optional `?` prop → nullable: true.
    const { RequiredAndOptional } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(RequiredAndOptional), ["required", "optional"], {
      required: { sortable: false, filterable: true },
      optional: { sortable: false, filterable: true },
    });
    const def = createTableDef(meta);
    expect(def.columns.find((c) => c.path === "required")!.nullable).toBe(false);
    expect(def.columns.find((c) => c.path === "optional")!.nullable).toBe(true);
  });

  it("fields not in meta.fields default to not sortable/filterable", async () => {
    const { WithoutLabel } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(WithoutLabel), ["firstName"], {});
    const def = createTableDef(meta);

    expect(def.columns[0]!.sortable).toBe(false);
    expect(def.columns[0]!.filterable).toBe(false);
  });

  it("passes through primaryKeys, crud, searchable flags", async () => {
    const { WithId } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(WithId), ["id"], undefined, {
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

  it("preferredId comes from meta when distinct from primaryKeys", async () => {
    const { WithIdAndSlug } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(WithIdAndSlug), ["id", "slug"], undefined, {
      primaryKeys: ["id"],
      preferredId: ["slug"],
    });
    const def = createTableDef(meta);

    expect(def.primaryKeys).toEqual(["id"]);
    expect(def.preferredId).toEqual(["slug"]);
  });

  it("skips the versionColumn from columns and propagates it to TableDef", async () => {
    const { WithVersionColumn } = await import(F);
    const meta = buildMeta(
      serializeAnnotatedType(WithVersionColumn),
      ["id", "name", "version"],
      {
        id: { sortable: true, filterable: true },
        name: { sortable: true, filterable: true },
        version: { sortable: true, filterable: true },
      },
      { versionColumn: "version", primaryKeys: ["id"] },
    );
    const def = createTableDef(meta);

    expect(def.versionColumn).toBe("version");
    expect(def.columns.map((c) => c.path)).toEqual(["id", "name"]);
    expect(def.flatMap.has("version")).toBe(true);
    expect(getFilterableColumns(def).some((c) => c.path === "version")).toBe(false);
    expect(getSortableColumns(def).some((c) => c.path === "version")).toBe(false);
  });

  it("preferredId falls back to primaryKeys when meta omits it (legacy server)", async () => {
    const { WithId } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(WithId), ["id"], undefined, {
      primaryKeys: ["id"],
    });
    delete (meta as { preferredId?: unknown }).preferredId;
    const def = createTableDef(meta);

    expect(def.preferredId).toEqual(["id"]);
  });

  it("passes through relations and searchIndexes", async () => {
    const { WithId } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(WithId), ["id"], undefined, {
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

  it("timestamp-tagged number → cell-type 'datetime'", async () => {
    const { WithTimestamp } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(WithTimestamp), ["createdAt"]);
    const def = createTableDef(meta);
    expect(def.columns.find((c) => c.path === "createdAt")!.type).toBe("datetime");
  });

  it("plain number (no timestamp tag) stays cell-type 'number'", async () => {
    const { WithCount } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(WithCount), ["count"]);
    const def = createTableDef(meta);
    expect(def.columns.find((c) => c.path === "count")!.type).toBe("number");
  });

  it("decimal designType maps to cell-type 'number'", async () => {
    const { WithDecimal } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(WithDecimal), ["price"]);
    const def = createTableDef(meta);
    expect(def.columns.find((c) => c.path === "price")!.type).toBe("number");
  });

  it("reads @db.amount.currency literal onto column.currencyCode", async () => {
    const { WithCurrencyLiteral } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(WithCurrencyLiteral), ["price"]);
    const col = createTableDef(meta).columns.find((c) => c.path === "price")!;
    expect(col.currencyCode).toBe("USD");
    expect(col.currencyRefField).toBeUndefined();
  });

  it("reads @db.amount.currency.ref onto column.currencyRefField", async () => {
    const { WithCurrencyRef } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(WithCurrencyRef), ["total", "currency"]);
    const col = createTableDef(meta).columns.find((c) => c.path === "total")!;
    expect(col.currencyRefField).toBe("currency");
    expect(col.currencyCode).toBeUndefined();
  });

  it("reads @db.unit literal onto column.unitCode", async () => {
    const { WithUnitLiteral } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(WithUnitLiteral), ["weight"]);
    const col = createTableDef(meta).columns.find((c) => c.path === "weight")!;
    expect(col.unitCode).toBe("kg");
  });

  it("reads @db.unit.ref onto column.unitRefField", async () => {
    const { WithUnitRef } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(WithUnitRef), ["value", "unit"]);
    const col = createTableDef(meta).columns.find((c) => c.path === "value")!;
    expect(col.unitRefField).toBe("unit");
  });

  it("reads @db.column.precision scale onto column.precisionScale", async () => {
    const { WithPrecision } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(WithPrecision), ["price"]);
    const col = createTableDef(meta).columns.find((c) => c.path === "price")!;
    expect(col.precisionScale).toBe(2);
  });

  // ── Flat-flattened nested objects vs. @db.json atomic columns ─

  it("skips flat-flattened object parents — only leaves become columns", async () => {
    // `profile: { firstName, lastName }` with no `@db.json` is server-flattened
    // into physical columns `profile__firstName` / `profile__lastName`. The wire
    // meta.fields lists `profile.firstName` + `profile.lastName` (NOT `profile`).
    // The synthetic parent `profile` would otherwise leak as a JSON-rendered
    // column on top of its real leaves.
    const { WithFlatNested } = await import(F);
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
      type: serializeAnnotatedType(WithFlatNested),
    };
    const def = createTableDef(meta);
    const paths = def.columns.map((c) => c.path);
    expect(paths).toEqual(
      expect.arrayContaining(["name", "profile.firstName", "profile.lastName"]),
    );
    expect(paths).not.toContain("profile");
  });

  it("keeps @db.json (atomic) object parent as a single column", async () => {
    // `address: { street, city }` with `@db.json` is stored as one JSON column;
    // its sub-paths are NOT in meta.fields. The parent stays as a single column
    // (rendered via the JSON popover cell).
    const { WithJsonNested } = await import(F);
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
      type: serializeAnnotatedType(WithJsonNested),
    };
    const def = createTableDef(meta);
    const paths = def.columns.map((c) => c.path);
    expect(paths).toEqual(expect.arrayContaining(["name", "address"]));
    expect(paths).not.toContain("address.street");
    expect(paths).not.toContain("address.city");
  });

  it("non-literal union (object variants) infers cell-type 'union'", async () => {
    const { WithUnion } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(WithUnion), ["paymentMethod"]);
    const def = createTableDef(meta);
    expect(def.columns.find((c) => c.path === "paymentMethod")!.type).toBe("union");
  });

  it("non-FK columns have undefined valueHelpInfo", async () => {
    const { SimpleObject } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(SimpleObject), ["name", "age", "active"]);
    const def = createTableDef(meta);

    for (const col of def.columns) {
      expect(col.valueHelpInfo).toBeUndefined();
    }
  });
});

// ── Column resolver helpers ──────────────────────────────────

describe("column-resolver", () => {
  async function buildResolverDef() {
    const { ResolverHelpers } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(ResolverHelpers), ["id", "name", "secret"], {
      id: { sortable: true, filterable: true },
      name: { sortable: false, filterable: true },
      secret: { sortable: false, filterable: false },
    });
    return createTableDef(meta);
  }

  it("@ui.table.exclude drops the field from columns but keeps it fetchable", async () => {
    const def = await buildResolverDef();
    expect(def.columns.map((c) => c.path)).toEqual(["id", "name"]);
    expect(def.fetchableFields.has("secret")).toBe(true);
  });

  it("getSortableColumns returns only sortable", async () => {
    const def = await buildResolverDef();
    const sortable = getSortableColumns(def);
    expect(sortable).toHaveLength(1);
    expect(sortable[0]!.path).toBe("id");
  });

  it("getFilterableColumns returns only filterable", async () => {
    const def = await buildResolverDef();
    const filterable = getFilterableColumns(def);
    expect(filterable).toHaveLength(2);
    expect(filterable.map((c) => c.path)).toEqual(expect.arrayContaining(["id", "name"]));
  });

  it("getColumn finds by path", async () => {
    const def = await buildResolverDef();
    expect(getColumn(def, "name")?.path).toBe("name");
    expect(getColumn(def, "nonexistent")).toBeUndefined();
  });
});
