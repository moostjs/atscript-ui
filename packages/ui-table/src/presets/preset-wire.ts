import type { PresetSnapshot } from "./preset-types";
import type {
  PresetColumnWidthEntry,
  PresetFilterOpEntry,
  PresetSnapshotWire,
} from "./preset-wire-types";

/**
 * Convert in-memory dict-form snapshot to the wire form persisted on the
 * server. Entries-arrays are sorted by `field` so consumers (server-side
 * aspect derivation, dirty detection, equality checks) see a stable order.
 *
 * Empty aspects round-trip as empty (since 0.1.133): a saved view with no
 * filters owns `filterOps` and clears them on apply, which is not the same
 * thing as a view that never claimed the aspect.
 */
export function toWireSnapshot(snapshot: PresetSnapshot): PresetSnapshotWire {
  const wire: PresetSnapshotWire = {};
  if (snapshot.columns) {
    const { columnNames, columnWidths } = snapshot.columns;
    const columns: PresetSnapshotWire["columns"] = { columnNames };
    if (columnWidths) {
      const entries: PresetColumnWidthEntry[] = [];
      for (const field of Object.keys(columnWidths).toSorted()) {
        entries.push({ field, width: columnWidths[field] });
      }
      // Empty is meaningful: an owned-but-empty aspect CLEARS state on apply,
      // while an absent one leaves it alone. Never collapse one into the other.
      columns.columnWidths = entries;
    }
    wire.columns = columns;
  }
  if (snapshot.filters) wire.filters = snapshot.filters;
  if (snapshot.filterOps) {
    const entries: PresetFilterOpEntry[] = [];
    for (const field of Object.keys(snapshot.filterOps).toSorted()) {
      entries.push({ field, conditions: snapshot.filterOps[field] });
    }
    wire.filterOps = entries;
  }
  if (snapshot.sorters) wire.sorters = snapshot.sorters;
  if (snapshot.itemsPerPage !== undefined) wire.itemsPerPage = snapshot.itemsPerPage;
  return wire;
}

export function fromWireSnapshot(wire: PresetSnapshotWire): PresetSnapshot {
  const snapshot: PresetSnapshot = {};
  if (wire.columns) {
    const { columnNames, columnWidths } = wire.columns;
    const columns: NonNullable<PresetSnapshot["columns"]> = { columnNames };
    if (columnWidths) {
      const dict: Record<string, string> = {};
      for (const entry of columnWidths) dict[entry.field] = entry.width;
      columns.columnWidths = dict;
    }
    snapshot.columns = columns;
  }
  if (wire.filters) snapshot.filters = wire.filters;
  if (wire.filterOps) {
    const dict: PresetSnapshot["filterOps"] = {};
    for (const entry of wire.filterOps) dict[entry.field] = entry.conditions;
    snapshot.filterOps = dict;
  }
  if (wire.sorters) snapshot.sorters = wire.sorters;
  if (wire.itemsPerPage !== undefined) snapshot.itemsPerPage = wire.itemsPerPage;
  return snapshot;
}
