import type { SortControl } from "@atscript/ui";
import type { FieldFilters } from "../filters/filter-types";

/** Serialized snapshot of table state for preset storage. */
export interface PresetSnapshot {
  columns?: string[];
  sorters?: SortControl[];
  filters?: FieldFilters;
  itemsPerPage?: number;
}

/** A saved table preset. */
export interface Preset {
  id: string;
  tableKey: string;
  userId: string;
  label: string;
  shared: boolean;
  isDefault: boolean;
  content: PresetSnapshot;
  createdAt: string;
  updatedAt: string;
}
