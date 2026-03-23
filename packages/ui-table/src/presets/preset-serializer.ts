import type { ColumnDef, SortControl } from "@atscript/ui";
import type { FieldFilters } from "../filters/filter-types";
import type { PresetSnapshot } from "./preset-types";

function hasKeys(obj: Record<string, unknown>): boolean {
  for (const _ in obj) return true;
  return false;
}

/** Serialize current table state into a preset snapshot. */
export function serializePreset(
  visibleColumns: ColumnDef[],
  sorters: SortControl[],
  filters: FieldFilters,
  itemsPerPage?: number,
): PresetSnapshot {
  return {
    columns: visibleColumns.map((c) => c.path),
    sorters: sorters.length > 0 ? sorters : undefined,
    filters: hasKeys(filters) ? filters : undefined,
    itemsPerPage,
  };
}

/** Deserialize a preset snapshot back into table state components. */
export function deserializePreset(snapshot: PresetSnapshot): {
  columns: string[] | undefined;
  sorters: SortControl[];
  filters: FieldFilters;
  itemsPerPage: number | undefined;
} {
  return {
    columns: snapshot.columns,
    sorters: snapshot.sorters ?? [],
    filters: snapshot.filters ?? {},
    itemsPerPage: snapshot.itemsPerPage,
  };
}
