import { type AsPresetEntryRow, type PresetAspect, derivePresetAspects } from "@atscript/ui-table";

export const ASPECT_LABELS: Record<PresetAspect, string> = {
  columns: "Displayed Columns",
  filters: "Displayed Filters",
  filterOps: "Filter conditions",
  sorters: "Sorters",
  itemsPerPage: "Page size",
};

export const ASPECT_ICONS: Record<PresetAspect, string> = {
  columns: "i-as-columns",
  filters: "i-as-filter",
  filterOps: "i-as-filter-ops",
  sorters: "i-as-sorters",
  itemsPerPage: "i-as-pin",
};

/**
 * Resolve the aspects a stored preset claims. Prefers the server-stamped
 * `aspects` column (cheap), falls back to deriving from `data.content` for
 * older rows or first paint after save before reload settles.
 */
export function aspectsOf(
  row: AsPresetEntryRow,
  availableAspects: readonly PresetAspect[],
): PresetAspect[] {
  if (Array.isArray(row.aspects) && row.aspects.length > 0) {
    return row.aspects.filter((a): a is PresetAspect =>
      availableAspects.includes(a as PresetAspect),
    );
  }
  // derivePresetAspects only checks top-level keys, which are identical
  // between PresetSnapshot and PresetSnapshotWire — skip the wire→dict
  // deserialize round-trip on this hot path.
  const wire = (row.data as { content?: unknown } | null)?.content;
  if (!wire) return [];
  return derivePresetAspects(wire).filter((a) => availableAspects.includes(a));
}

export function readPresetLabel(row: AsPresetEntryRow): string {
  return row.label ?? (row.data as { label?: string } | null)?.label ?? row.id;
}

/**
 * Display name for the row's owner. `userLabel` (server-stamped via the
 * host's `getUserLabel` hook) is preferred so the UI shows "Alice" rather
 * than `usr_abc123`. `fallback` is returned when no name is available —
 * picker uses `""`, dialog uses `"—"`.
 */
export function ownerNameOf(row: AsPresetEntryRow, fallback = ""): string {
  if (typeof row.userLabel === "string" && row.userLabel.length > 0) return row.userLabel;
  if (typeof row.user === "string" && row.user.length > 0) return row.user;
  return fallback;
}
