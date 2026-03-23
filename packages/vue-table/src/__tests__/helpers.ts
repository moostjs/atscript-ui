import type { ColumnDef, MetaResponse, TableDef } from "@atscript/ui";
import { defineAnnotatedType, serializeAnnotatedType } from "@atscript/typescript/utils";
import type { Client } from "@atscript/db-client";
import { vi } from "vitest";

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
    type: serialized,
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
 * and pages() returns the given data/count.
 */
export function createMockClient(opts: {
  meta: MetaResponse;
  data?: Record<string, unknown>[];
  count?: number;
}): { client: Client; pagesFn: ReturnType<typeof vi.fn> } {
  const pagesFn = vi.fn().mockResolvedValue({
    data: opts.data ?? [],
    count: opts.count ?? opts.data?.length ?? 0,
    page: 1,
    itemsPerPage: 50,
    pages: 1,
  });
  return {
    client: {
      meta: () => Promise.resolve(opts.meta),
      pages: pagesFn,
    } as unknown as Client,
    pagesFn,
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
