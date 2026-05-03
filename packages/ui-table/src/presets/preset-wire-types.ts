import type { FilterCondition } from "../filters/filter-types";

export interface PresetColumnWidthEntry {
  field: string;
  width: string;
}

export interface PresetFilterOpEntry {
  field: string;
  conditions: FilterCondition[];
}

export interface PresetSorterEntry {
  field: string;
  direction: "asc" | "desc";
}

/**
 * Wire-format snapshot stored in `AsPresetEntry.data.content`. Dict-shaped
 * in-memory aspects (`columnWidths`, `filterOps`) become entries-arrays at
 * the serializer boundary so atscript can validate them strictly — atscript
 * has no `Record<string, T>` / `additionalProperties` construct.
 *
 * The client-side dict form is `PresetSnapshot` in `./preset-types`. Use
 * `toWireSnapshot` / `fromWireSnapshot` (in `./preset-wire`) to bridge them.
 */
export interface PresetSnapshotWire {
  columns?: {
    columnNames: string[];
    columnWidths?: PresetColumnWidthEntry[];
  };
  filters?: string[];
  filterOps?: PresetFilterOpEntry[];
  sorters?: PresetSorterEntry[];
  itemsPerPage?: number;
}
