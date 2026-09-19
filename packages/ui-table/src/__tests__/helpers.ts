import type { ColumnDef } from "@atscript/ui";

/**
 * Minimal `ColumnDef` for unit tests: a sortable, filterable text column whose
 * label is its path. Override anything through `overrides`.
 */
export function mockColumn(path: string, overrides?: Partial<ColumnDef>): ColumnDef {
  return {
    path,
    label: path,
    type: "text",
    sortable: true,
    filterable: true,
    nullable: false,
    order: 0,
    ...overrides,
  };
}
