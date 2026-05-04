import type { PresetAspect } from "./preset-aspects";
import { stableStringify } from "./preset-dirty";
import type { PresetSnapshot } from "./preset-types";

/**
 * localStorage overlay shape. Subset of `PresetSnapshot` — `filterOps` is
 * intentionally excluded (filter values are situational; restoring them on
 * mount surprises users — see PRESETS-PHASE-2 §3.8). `itemsPerPage` is
 * gated on `availableAspects`.
 */
export type PresetDraft = Omit<PresetSnapshot, "filterOps">;

/** Aspects eligible for local-draft persistence. `filterOps` is excluded by design. */
export const DRAFT_PERSISTED_ASPECTS = [
  "columns",
  "filters",
  "sorters",
  "itemsPerPage",
] as const satisfies readonly PresetAspect[];

export type DraftPersistedAspect = (typeof DRAFT_PERSISTED_ASPECTS)[number];

function aspectAllowed(
  aspect: DraftPersistedAspect,
  availableAspects: readonly PresetAspect[],
): boolean {
  return availableAspects.includes(aspect);
}

/**
 * Capture the persisted-aspect subset of a full snapshot. Aspects not in
 * `availableAspects` are skipped (forward-compat: a deploy that toggles an
 * aspect off doesn't error on previously-saved drafts).
 */
export function serializeDraft(
  snapshot: PresetSnapshot,
  availableAspects: readonly PresetAspect[],
): PresetDraft {
  return copyPersistedAspects(snapshot, availableAspects);
}

/**
 * Convert a localStorage draft back to a partial snapshot suitable for
 * `applyPreset`. Aspects no longer in `availableAspects` are silently
 * skipped.
 */
export function deserializeDraft(
  draft: PresetDraft,
  availableAspects: readonly PresetAspect[],
): PresetSnapshot {
  return copyPersistedAspects(draft, availableAspects);
}

/** True when the draft has zero persisted aspects to apply. */
export function isEmptyDraft(draft: PresetDraft): boolean {
  for (const aspect of DRAFT_PERSISTED_ASPECTS) {
    if ((draft as Record<string, unknown>)[aspect] !== undefined) return false;
  }
  return true;
}

function copyPersistedAspects(
  source: Partial<PresetSnapshot>,
  availableAspects: readonly PresetAspect[],
): PresetDraft {
  const out: PresetDraft = {};
  for (const aspect of DRAFT_PERSISTED_ASPECTS) {
    if (!aspectAllowed(aspect, availableAspects)) continue;
    const value = (source as Record<string, unknown>)[aspect];
    if (value === undefined) continue;
    (out as Record<string, unknown>)[aspect] = value;
  }
  return out;
}

/**
 * True when the draft's persisted aspects exactly match the active
 * preset's persisted aspects. Used by the watcher to decide whether to
 * `localStorage.removeItem` instead of writing — keeps storage tidy and
 * avoids `localStorage.length` noise after the user reverts edits.
 */
export function draftMatchesPreset(
  draft: PresetDraft,
  presetSnapshot: PresetSnapshot,
  availableAspects: readonly PresetAspect[],
): boolean {
  const draftSnapshot = deserializeDraft(draft, availableAspects);
  const presetSubset = serializeDraft(presetSnapshot, availableAspects);
  return stableStringify(draftSnapshot) === stableStringify(presetSubset);
}
