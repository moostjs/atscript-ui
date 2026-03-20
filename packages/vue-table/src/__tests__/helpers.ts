import type { ColumnDef, MetaResponse, TableDef } from "@atscript/ui-core";
import { defineAnnotatedType, serializeAnnotatedType } from "@atscript/typescript/utils";
import type { UseTableClient } from "../composables/use-table";

/**
 * Build a simple MetaResponse for testing.
 * Creates an object type with the given field names (all string, sortable, filterable).
 */
export function createMockMeta(fieldNames: string[]): MetaResponse {
  const h = defineAnnotatedType("object");
  for (const name of fieldNames) {
    const prop = defineAnnotatedType().designType("string");
    prop.annotate("meta.label" as keyof AtscriptMetadata, name as never);
    h.prop(name, prop.$type);
  }
  const serialized = serializeAnnotatedType(h.$type);

  const fields: Record<string, { sortable: boolean; filterable: boolean }> = {};
  for (const name of fieldNames) {
    fields[name] = { sortable: true, filterable: true };
  }

  return {
    type: serialized as unknown as Record<string, unknown>,
    fields,
    primaryKeys: ["id"],
    readOnly: false,
    searchable: false,
    vectorSearchable: false,
    searchIndexes: [],
    relations: [],
  };
}

/**
 * Create a mock client for testing.
 * Returns a client whose meta() returns the given MetaResponse
 * and findManyWithCount() returns the given data/count.
 */
export function createMockClient(opts: {
  meta: MetaResponse;
  data?: Record<string, unknown>[];
  count?: number;
}): UseTableClient {
  return {
    meta: () => Promise.resolve(opts.meta),
    findManyWithCount: () =>
      Promise.resolve({
        data: opts.data ?? [],
        count: opts.count ?? opts.data?.length ?? 0,
      }),
  };
}

/** Create a minimal ColumnDef for testing. */
export function mockColumn(path: string, overrides?: Partial<ColumnDef>): ColumnDef {
  return {
    path,
    label: path,
    type: "text",
    sortable: true,
    filterable: true,
    visible: true,
    order: 0,
    ...overrides,
  };
}

/** Create a minimal TableDef for testing. */
export function mockTableDef(columns: ColumnDef[]): TableDef {
  return {
    type: defineAnnotatedType("object").$type,
    columns,
    primaryKeys: ["id"],
    readOnly: false,
    searchable: false,
    vectorSearchable: false,
    searchIndexes: [],
    relations: [],
  };
}
