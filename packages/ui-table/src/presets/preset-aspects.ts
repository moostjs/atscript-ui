import type { PresetSnapshot } from "./preset-types";
import type { PresetSnapshotWire } from "./preset-wire-types";

// Drift guard: every aspect must be a key on BOTH the in-memory and wire
// shapes — otherwise the converter / server-side aspect derivation silently
// misclassifies a snapshot.
export const PRESET_ASPECTS = [
  "columns",
  "filters",
  "filterOps",
  "sorters",
  "itemsPerPage",
] as const satisfies readonly (keyof Required<PresetSnapshot> &
  keyof Required<PresetSnapshotWire>)[];

export type PresetAspect = (typeof PRESET_ASPECTS)[number];

// Picker projects this column to render aspect icons without loading the full
// snapshot blob — output order must match `PRESET_ASPECTS` so icon rows look
// identical regardless of the source object's key order.
export function derivePresetAspects(content: unknown): PresetAspect[] {
  if (!content || typeof content !== "object") return [];
  const out: PresetAspect[] = [];
  for (const aspect of PRESET_ASPECTS) {
    if (Object.hasOwn(content as Record<string, unknown>, aspect)) {
      out.push(aspect);
    }
  }
  return out;
}
