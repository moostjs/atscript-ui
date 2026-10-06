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
  fields?: MetaResponse["fields"],
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

  it("a top-level scalar missing from meta.fields is not a column", async () => {
    // The server did not advertise it (e.g. hidden from the caller's role):
    // naming it in `$select` would be rejected.
    const { SimpleObject } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(SimpleObject), [], {
      name: { sortable: true, filterable: true },
    });
    const def = createTableDef(meta);

    expect(def.columns.map((c) => c.path)).toEqual(["name"]);
    expect([...def.fetchableFields]).toEqual(["name"]);
  });

  it("a writeOnly field is neither a column nor fetchable", async () => {
    const { SimpleObject } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(SimpleObject), [], {
      name: { sortable: true, filterable: true },
      age: { sortable: false, filterable: false, writeOnly: true },
      active: { sortable: true, filterable: true },
    });
    const def = createTableDef(meta);

    expect(def.columns.map((c) => c.path)).not.toContain("age");
    expect(def.fetchableFields.has("age")).toBe(false);
    expect(def.fetchableFields.has("name")).toBe(true);
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
      relations: [{ name: "author", direction: "to", isArray: false, filterable: true }],
      searchIndexes: [{ name: "default", type: "text" }],
    });
    const def = createTableDef(meta);

    expect(def.relations).toEqual([
      { name: "author", direction: "to", isArray: false, filterable: true },
    ]);
    expect(def.searchIndexes).toHaveLength(1);
    expect(def.searchIndexes[0]!.name).toBe("default");
  });

  it("a computed view column is an ordinary column: sortable / filterable per /meta", async () => {
    const { SimpleObject } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(SimpleObject), [], {
      name: { sortable: true, filterable: true },
      age: { sortable: true, filterable: true, computed: true },
      active: { sortable: false, filterable: false },
    });
    const def = createTableDef(meta);

    const age = def.columns.find((c) => c.path === "age")!;
    expect(age).toMatchObject({ sortable: true, filterable: true, type: "number" });
    expect(def.fetchableFields.has("age")).toBe(true);
    expect(getSortableColumns(def).map((c) => c.path)).toContain("age");
    expect(getFilterableColumns(def).map((c) => c.path)).toContain("age");
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

  it("copies meta filterOps onto the column (existence-only JSON columns)", async () => {
    const { SimpleObject } = await import(F);
    const meta = buildMeta(serializeAnnotatedType(SimpleObject), [], {
      name: { sortable: false, filterable: false, filterOps: ["$exists"] },
      age: { sortable: true, filterable: true },
      active: { sortable: false, filterable: false },
    });
    const def = createTableDef(meta);
    expect(getColumn(def, "name")).toMatchObject({ filterable: false, filterOps: ["$exists"] });
    expect(getColumn(def, "age")).not.toHaveProperty("filterOps");
    expect(getColumn(def, "active")).not.toHaveProperty("filterOps");
  });

  it("getColumn finds by path", async () => {
    const def = await buildResolverDef();
    expect(getColumn(def, "name")?.path).toBe("name");
    expect(getColumn(def, "nonexistent")).toBeUndefined();
  });

  describe("valueKind / options[].value", () => {
    async function kinds() {
      const { ValueKinds } = await import(F);
      const names = [
        "ts",
        "tsCreated",
        "tsOptional",
        "dateStr",
        "isoStr",
        "intNum",
        "expectInt",
        "autoId",
        "plain",
        "money",
        "flag",
        "text",
        "numLiterals",
        "mixed",
        "nullableLiterals",
        "list",
        "nested",
      ];
      const def = createTableDef(buildMeta(serializeAnnotatedType(ValueKinds), names));
      return (path: string) => getColumn(def, path);
    }

    it("derives the storage kind from the atscript type", async () => {
      const col = await kinds();
      expect(col("ts")!.valueKind).toBe("timestamp");
      expect(col("tsCreated")!.valueKind).toBe("timestamp");
      expect(col("dateStr")!.valueKind).toBe("date");
      expect(col("isoStr")!.valueKind).toBe("isoDate");
      expect(col("intNum")!.valueKind).toBe("integer");
      expect(col("expectInt")!.valueKind).toBe("integer");
      expect(col("autoId")!.valueKind).toBe("integer");
      expect(col("plain")!.valueKind).toBe("number");
      expect(col("money")!.valueKind).toBe("decimal");
      expect(col("flag")!.valueKind).toBe("boolean");
      expect(col("text")!.valueKind).toBe("string");
    });

    it("an optional (nullable) timestamp keeps its kind", async () => {
      const col = await kinds();
      expect(col("tsOptional")!.valueKind).toBe("timestamp");
      expect(col("tsOptional")!.nullable).toBe(true);
    });

    it("a union takes the kind its non-null members agree on; a mixed one has none", async () => {
      const col = await kinds();
      expect(col("numLiterals")!.valueKind).toBe("number");
      expect(col("nullableLiterals")!.valueKind).toBe("string");
      expect(col("mixed")!.valueKind).toBeUndefined();
    });

    it("arrays and objects have no kind", async () => {
      const col = await kinds();
      expect(col("list")!.valueKind).toBeUndefined();
      expect(col("nested")?.valueKind).toBeUndefined();
    });

    it("options carry the typed literal beside the string key", async () => {
      const col = await kinds();
      expect(col("numLiterals")!.options).toEqual([
        { key: "1", label: "1", value: 1 },
        { key: "2", label: "2", value: 2 },
        { key: "3", label: "3", value: 3 },
      ]);
    });
  });
});

describe("createTableDef — decoration columns (@DbDecorations)", () => {
  const D = "../__tests__/fixtures/create-table-def-distinct.as";
  const decorationFields = {
    unreadCount: { sortable: false, filterable: false, decoration: true },
    ownerName: { sortable: false, filterable: false, decoration: true },
    hidden: { sortable: false, filterable: false, decoration: true },
    details: { sortable: false, filterable: false, decoration: true },
  };

  async function decorated(fields: MetaResponse["fields"] = decorationFields) {
    const { DistinctCustomer, CustomerDecorations } = await import(D);
    return buildMeta(
      serializeAnnotatedType(DistinctCustomer),
      [],
      {
        id: { sortable: true, filterable: true },
        city: { sortable: true, filterable: true, groupable: true },
        ...fields,
      },
      { decorations: serializeAnnotatedType(CustomerDecorations) },
    );
  }

  it("pushes the top-level decoration props the server lists, after the real columns", async () => {
    const def = createTableDef(await decorated());
    const paths = def.columns.map((c) => c.path);
    // `hidden` is @ui.table.exclude; `details` is an object (not a scalar display) — still listed
    expect(paths.slice(0, 2)).toEqual(["id", "city"]);
    expect(paths).toEqual(expect.arrayContaining(["unreadCount", "ownerName", "details"]));
    expect(paths).not.toContain("hidden");
  });

  it("builds them with the same code: label, width, display type; never sortable/filterable", async () => {
    const def = createTableDef(await decorated());
    const unread = def.columns.find((c) => c.path === "unreadCount")!;
    expect(unread).toMatchObject({
      label: "Unread",
      width: "6em",
      type: "number",
      sortable: false,
      filterable: false,
      nullable: true,
    });
    expect(unread.valueHelpInfo).toBeUndefined();
    const owner = def.columns.find((c) => c.path === "ownerName")!;
    expect(owner).toMatchObject({ label: "Owner Name", type: "text", nullable: true });
  });

  it("adds them to flatMap and fetchableFields", async () => {
    const def = createTableDef(await decorated());
    expect(def.flatMap.has("unreadCount")).toBe(true);
    expect(def.fetchableFields.has("ownerName")).toBe(true);
  });

  it("honours @ui.table.exclude and skips props the server did not list (hidden sources)", async () => {
    const def = createTableDef(
      await decorated({
        unreadCount: { sortable: false, filterable: false, decoration: true },
        hidden: { sortable: false, filterable: false, decoration: true },
      }),
    );
    const paths = def.columns.map((c) => c.path);
    expect(paths).toContain("unreadCount");
    expect(paths).not.toContain("hidden");
    expect(paths).not.toContain("ownerName");
  });

  it("a decoration prop without the `decoration` flag in meta.fields is ignored", async () => {
    const def = createTableDef(
      await decorated({ ownerName: { sortable: false, filterable: false } }),
    );
    expect(def.columns.map((c) => c.path)).not.toContain("ownerName");
  });

  it("an older server (no `decorations`) is unchanged", async () => {
    const { DistinctCustomer } = await import(D);
    const meta = buildMeta(serializeAnnotatedType(DistinctCustomer), ["id", "city"]);
    const def = createTableDef(meta);
    expect(def.columns.map((c) => c.path)).toEqual(["id", "city"]);
  });
});

const col = (def: ReturnType<typeof createTableDef>, path: string) =>
  def.columns.find((c) => c.path === path)!;

describe("createTableDef — distinct-values help (@ui.valueHelp.distinct)", () => {
  const D = "../__tests__/fixtures/create-table-def-distinct.as";

  async function meta(fields: MetaResponse["fields"]) {
    const { DistinctCustomer } = await import(D);
    return buildMeta(serializeAnnotatedType(DistinctCustomer), [], fields);
  }

  it("offered when the field is filterable, groupable and annotated", async () => {
    const def = createTableDef(
      await meta({
        id: { sortable: true, filterable: true },
        city: { sortable: true, filterable: true, groupable: true },
      }),
    );
    expect(col(def, "city").distinct).toEqual({ url: "/customers", field: "city" });
    expect(col(def, "city").valueHelpInfo).toBeUndefined();
    // not a dictionary reference: keeps its natural display type
    expect(col(def, "city").type).toBe("text");
  });

  it("not offered without groupable, without filterable, or without the annotation", async () => {
    const def = createTableDef(
      await meta({
        id: { sortable: true, filterable: true },
        city: { sortable: true, filterable: true },
        country: { sortable: true, filterable: false, groupable: true },
        region: { sortable: true, filterable: true, groupable: true },
      }),
    );
    expect(col(def, "city").distinct).toBeUndefined();
    expect(col(def, "country").distinct).toBeUndefined();
    expect(col(def, "region").distinct).toBeUndefined();
  });

  it("not offered on a column that has literal options", async () => {
    const def = createTableDef(
      await meta({
        id: { sortable: true, filterable: true },
        tier: { sortable: true, filterable: true, groupable: true },
      }),
    );
    expect(col(def, "tier").distinct).toBeUndefined();
    expect(col(def, "tier").options).toHaveLength(2);
  });
});

describe("createTableDef — array of a literal union", () => {
  async function ticketDef() {
    const { Ticket } = await import("../__tests__/fixtures/value-help-binding.as");
    return createTableDef(
      buildMeta(serializeAnnotatedType(Ticket), ["statuses", "plainStatuses", "status"]),
    );
  }

  it("an array column gets the element literals as options, the array prop's labels winning", async () => {
    const def = await ticketDef();
    expect(col(def, "statuses").options?.map((o) => [o.key, o.label])).toEqual([
      ["open", "Open"],
      ["in_progress", "In progress"],
      ["closed", "Finished"],
    ]);
    // it stays an array column
    expect(col(def, "statuses").type).toBe("array");
  });

  it("without a prop label the element type's labels apply; typed values are kept", async () => {
    const def = await ticketDef();
    expect(col(def, "plainStatuses").options?.map((o) => [o.key, o.label, o.value])).toEqual([
      ["open", "Open", "open"],
      ["in_progress", "In progress", "in_progress"],
      ["closed", "closed", "closed"],
    ]);
  });

  it("a scalar union column is unchanged", async () => {
    const def = await ticketDef();
    expect(col(def, "status").options?.map((o) => o.label)).toEqual([
      "Open",
      "In progress",
      "Done",
    ]);
  });
});
