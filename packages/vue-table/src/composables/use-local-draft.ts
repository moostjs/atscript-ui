import {
  type PresetAspect,
  type PresetDraft,
  type PresetSnapshot,
  debounce,
  deserializeDraft,
  isEmptyDraft,
  serializeDraft,
  stableStringify,
} from "@atscript/ui-table";
import { type MaybeRefOrGetter, type Ref, isRef, toValue, watch } from "vue";

const DEFAULT_DEBOUNCE_MS = 300;

export interface UseLocalDraftOptions {
  app: string;
  tableKey: string;
  /** Reactive on/off toggle (`<AsTableRoot :persist-local-drafts>`). */
  enabled: Ref<boolean> | boolean;
  /** Persisted-aspect gate — drafts only persist aspects in this set. */
  availableAspects: readonly PresetAspect[];
  /**
   * Identity the draft is keyed under — pass the signed-in user's id so a
   * shared browser never restores the previous user's draft. Reactive: when
   * it changes, reads and writes move to the new key and the old scope's
   * draft is neither read nor overwritten. Omitted (or `undefined`) keeps
   * the pre-0.1.133 unscoped key. Since 0.1.133.
   */
  scope?: MaybeRefOrGetter<string | undefined>;
  /** Optional debounce override (default 300ms). */
  debounceMs?: number;
  /**
   * Optional storage backend. Defaults to `globalThis.localStorage`. Tests
   * supply an in-memory mock; SSR contexts pass `null` to disable.
   */
  storage?: StorageLike | null;
}

/** Subset of `Storage` we depend on. Avoids type coupling to DOM lib. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface UseLocalDraftReturn {
  /**
   * Layer the persisted draft (if any) on top of `applied` and return the
   * merged snapshot. Aspects not in `availableAspects` are skipped silently
   * (forward-compat for deploys that toggle aspect availability).
   */
  hydrate(applied: PresetSnapshot): PresetSnapshot;
  /**
   * Wire a debounced watcher that mirrors persisted aspects of `current`
   * to localStorage on each change. When `current` matches the active
   * preset's persisted-aspect subset, the entry is removed instead.
   *
   * Returns the unwatch handle so callers can dispose explicitly; if not
   * called, the watcher lives until the host component unmounts.
   */
  watchAndPersist(
    currentSnapshot: () => PresetSnapshot,
    activePresetSnapshot: () => PresetSnapshot,
  ): () => void;
  /** Drop the localStorage entry. Used by sign-out / explicit preset switch. */
  clear(): void;
  /** Read the raw draft from storage; `null` when absent or corrupted. */
  readDraft(): PresetDraft | null;
}

/**
 * localStorage overlay manager for table presets. One overlay per
 * `(app, scope, tableKey)`; switching presets clears it (caller's
 * responsibility — this composable only tracks state, not which preset is
 * active).
 */
export function useLocalDraft(opts: UseLocalDraftOptions): UseLocalDraftReturn {
  /** Resolved per call — `scope` is reactive. */
  function storageKey(): string {
    const scope = toValue(opts.scope);
    return scope
      ? `as-table-draft:${opts.app}:${scope}:${opts.tableKey}`
      : `as-table-draft:${opts.app}:${opts.tableKey}`;
  }
  const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const storage = resolveStorage(opts.storage);

  function isEnabled(): boolean {
    if (typeof opts.enabled === "boolean") return opts.enabled;
    if (isRef(opts.enabled)) return Boolean(opts.enabled.value);
    return false;
  }

  function readDraft(): PresetDraft | null {
    if (!storage) return null;
    try {
      const raw = storage.getItem(storageKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed as PresetDraft;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[vue-table] useLocalDraft: corrupted localStorage entry, ignoring", err);
      return null;
    }
  }

  function writeDraft(draft: PresetDraft): void {
    if (!storage) return;
    try {
      storage.setItem(storageKey(), JSON.stringify(draft));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[vue-table] useLocalDraft: localStorage write failed", err);
    }
  }

  function clear(): void {
    if (!storage) return;
    try {
      storage.removeItem(storageKey());
    } catch {
      // ignore — quota / SSR / etc.
    }
  }

  function hydrate(applied: PresetSnapshot): PresetSnapshot {
    if (!isEnabled()) return applied;
    const draft = readDraft();
    if (!draft || isEmptyDraft(draft)) return applied;
    const overlay = deserializeDraft(draft, opts.availableAspects);
    return { ...applied, ...overlay };
  }

  function watchAndPersist(
    currentSnapshot: () => PresetSnapshot,
    activePresetSnapshot: () => PresetSnapshot,
  ): () => void {
    let lastDraftSerialized = "";
    let lastPresetRef: PresetSnapshot | null = null;
    let lastPresetSerialized = "";

    function flush(current: PresetSnapshot, preset: PresetSnapshot): void {
      if (!isEnabled()) return;
      const draft = serializeDraft(current, opts.availableAspects);
      if (isEmptyDraft(draft)) {
        clear();
        lastDraftSerialized = "";
        return;
      }
      const draftSerialized = stableStringify(draft);
      if (preset !== lastPresetRef) {
        lastPresetRef = preset;
        lastPresetSerialized = stableStringify(serializeDraft(preset, opts.availableAspects));
      }
      if (draftSerialized === lastPresetSerialized) {
        clear();
        lastDraftSerialized = "";
        return;
      }
      if (draftSerialized === lastDraftSerialized) return;
      lastDraftSerialized = draftSerialized;
      writeDraft(draft);
    }

    const flushDebounced = debounce(
      ((current: PresetSnapshot, preset: PresetSnapshot) => flush(current, preset)) as (
        ...args: unknown[]
      ) => void,
      debounceMs,
    );

    // Source returns fresh objects on every run, so reference inequality
    // already fires the handler — `deep: true` would only add wasted
    // traversal. `scope` is NOT a source: a flip must not schedule a write,
    // or the old identity's snapshot lands under the new identity's key.
    const stop = watch(
      () => [currentSnapshot(), activePresetSnapshot()] as const,
      ([current, preset]) => flushDebounced(current, preset),
      { flush: "post" },
    );

    // Identity change: adopt the new key without writing anything to it.
    const stopScope = watch(
      () => toValue(opts.scope),
      () => {
        // A debounced flush still in the queue was composed for the PREVIOUS
        // user's state — dropping it is the whole point.
        flushDebounced.cancel();
        // The caches describe the old key; they must neither suppress nor
        // leak into the new one.
        lastPresetRef = null;
        lastPresetSerialized = "";
        // Prime from whatever the new identity already has stored, so their
        // own draft is not rewritten byte-for-byte on the next change.
        const existing = readDraft();
        lastDraftSerialized = existing && !isEmptyDraft(existing) ? stableStringify(existing) : "";
      },
      { flush: "post" },
    );

    return () => {
      flushDebounced.cancel();
      stop();
      stopScope();
    };
  }

  return {
    hydrate,
    watchAndPersist,
    clear,
    readDraft,
  };
}

function resolveStorage(provided: StorageLike | null | undefined): StorageLike | null {
  if (provided !== undefined) return provided;
  // SSR / no DOM → null. We don't access globalThis.localStorage at module
  // top level so the package stays SSR-friendly.
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage;
    return ls ?? null;
  } catch {
    return null;
  }
}
