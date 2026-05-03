import type { SortControl } from "@atscript/ui";
import type { FieldFilters } from "../filters/filter-types";

/**
 * In-memory snapshot of table state for preset persistence. Dict-shaped
 * aspects (`columns.columnWidths`, `filterOps`) match the runtime state
 * shape. The wire form (entries-arrays for atscript validation) is
 * `PresetSnapshotWire` in `./preset-wire-types`.
 *
 * Per-aspect opt-in: a key's presence claims that aspect; absent keys are
 * left untouched on apply.
 */
export interface PresetSnapshot {
  columns?: {
    columnNames: string[];
    /** Override-only diff against column defaults. Never serialise the default. */
    columnWidths?: Record<string, string>;
  };
  /** Displayed filter field paths (the visible-input list). */
  filters?: string[];
  /** Applied filter conditions, dict keyed by field path. */
  filterOps?: FieldFilters;
  sorters?: SortControl[];
  itemsPerPage?: number;
}
