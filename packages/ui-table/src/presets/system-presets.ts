import type { PresetSnapshot } from "./preset-types";
import { STANDARD_PRESET_ID, normaliseSystemPresetId } from "./preset-id";

/**
 * Synthetic preset that lives only in memory — never persisted. Always
 * present in the picker; users branch off via Save-as into a regular owned
 * preset to evolve it.
 */
export interface SystemPreset {
  /** Canonical `sys:*` form after normalisation. */
  id: string;
  label: string;
  /** Baseline snapshot. Empty `{}` falls through to factory defaults. */
  content: PresetSnapshot;
}

/**
 * Consumer-supplied entry. `content` is optional so a consumer can override
 * Standard's label without supplying a snapshot.
 */
export interface SystemPresetInput {
  /** Bare ids are auto-prefixed (`'monitoring'` → `'sys:monitoring'`). */
  id: string;
  label: string;
  content?: PresetSnapshot;
}

const DEFAULT_STANDARD_LABEL = "Standard";

/**
 * Resolve the consumer's `:system-presets` prop into the canonical render
 * order: Standard at index 0 (consumer override or default empty fallback),
 * named system presets in array order. Duplicate ids are dropped with a
 * console.warn (first wins).
 */
export function resolveSystemPresets(input?: SystemPresetInput[]): SystemPreset[] {
  const seen = new Set<string>();
  let standardOverride: SystemPreset | null = null;
  const named: SystemPreset[] = [];

  if (input) {
    for (const item of input) {
      const id = normaliseSystemPresetId(item.id);
      if (seen.has(id)) {
        // eslint-disable-next-line no-console
        console.warn(`[ui-table] Duplicate system-preset id "${id}"; keeping first.`);
        continue;
      }
      seen.add(id);
      const preset: SystemPreset = {
        id,
        label: item.label,
        content: item.content ?? {},
      };
      if (id === STANDARD_PRESET_ID) {
        standardOverride = preset;
      } else {
        named.push(preset);
      }
    }
  }

  const standard: SystemPreset = standardOverride ?? {
    id: STANDARD_PRESET_ID,
    label: DEFAULT_STANDARD_LABEL,
    content: {},
  };
  return [standard, ...named];
}
