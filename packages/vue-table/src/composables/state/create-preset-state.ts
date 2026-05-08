import type { ColumnDef, PaginationControl, SortControl } from "@atscript/ui";
import {
  type AspectMask,
  type AsPresetEntryRow,
  type ColumnWidthsMap,
  type FieldFilters,
  type PresetAspect,
  type PresetCapabilities,
  type PresetSnapshot,
  type SystemPreset,
  STANDARD_PRESET_ID,
  fromWireSnapshot,
  isDirtyAgainst,
  isSystemPresetId,
  resolveSystemPresets,
} from "@atscript/ui-table";
import {
  type ComputedRef,
  type Ref,
  type ShallowRef,
  computed,
  nextTick,
  ref,
  shallowRef,
  watch,
} from "vue";

import type { UseLocalDraftReturn } from "../use-local-draft";
import type { UsePresetsReturn } from "../use-presets";

export const DEFAULT_AVAILABLE_ASPECTS: PresetAspect[] = [
  "columns",
  "filters",
  "filterOps",
  "sorters",
];

/**
 * Default `columnNames` for a system preset that doesn't specify them — every
 * column whose schema declares it visible (i.e. lacking `@ui.table.hidden`).
 * Used by both `apply` (no-explicit-columnNames fallback) and `expandDefault`,
 * so the two paths can never drift apart.
 */
function defaultVisibleColumnPaths(o: CreatePresetStateOptions): string[] {
  const out: string[] = [];
  for (const col of o.allColumns.value) {
    if (col.visible) out.push(col.path);
  }
  return out;
}

export interface CreatePresetStateOptions {
  // State refs to read/write.
  columnNames: ShallowRef<string[]>;
  columnWidths: Ref<ColumnWidthsMap>;
  filterFields: ShallowRef<string[]>;
  filters: ShallowRef<FieldFilters>;
  sorters: ShallowRef<SortControl[]>;
  pagination: Ref<PaginationControl>;
  allColumns: ShallowRef<ColumnDef[]>;

  /** Optional presets composable. When null, the surface no-ops. */
  presetsHandle?: UsePresetsReturn | null;
  /** Optional local-draft composable. When null, draft persistence no-ops. */
  draftHandle?: UseLocalDraftReturn | null;

  /** App-level aspect availability. Default `['columns','filters','filterOps','sorters']`. */
  availableAspects?: PresetAspect[];

  /** Static fallback for system presets when `presetsHandle` is null. */
  fallbackSystemPresets?: SystemPreset[];

  /** Whether localStorage drafts should be hydrated + persisted on bootstrap. */
  persistDrafts?: boolean;
}

/** Public preset surface — what consumers see on `state.preset`. */
export interface PresetStateSlice {
  presets: ShallowRef<AsPresetEntryRow[]>;
  /** Lookup table for stored presets — O(1) by id. */
  presetsById: ComputedRef<Map<string, AsPresetEntryRow>>;
  userConf: ShallowRef<AsPresetEntryRow | null>;
  capabilities: Ref<PresetCapabilities | null>;
  systemPresets: ComputedRef<SystemPreset[]>;
  /** Lookup table for system presets — O(1) by id. */
  systemPresetsById: ComputedRef<Map<string, SystemPreset>>;
  availableAspects: PresetAspect[];
  available: ComputedRef<boolean>;
  activeId: Ref<string | null>;
  /** Snapshot of the active preset (system presets are aspect-expanded). */
  activeSnapshot: ComputedRef<PresetSnapshot>;
  isDirty: ComputedRef<boolean>;
  canSaveActive: ComputedRef<boolean>;
  currentUser: ComputedRef<string | null>;
  /** Owned-by-current-user predicate. Returns false for system + missing rows. */
  isOwned: (id: string) => boolean;
  dialogOpen: Ref<boolean>;
  /**
   * `true` once preset bootstrap has applied the default, or always when the
   * feature isn't configured. Consumers (URL-query bridge) wait on this so
   * preset baseline is written first and URL overlays cleanly on top.
   */
  ready: ComputedRef<boolean>;

  captureSnapshot: (mask?: AspectMask) => PresetSnapshot;
  apply: (idOrSnapshot: string | PresetSnapshot) => void;
  resetActive: () => void;
  clearLocalDraft: () => void;
  /**
   * Resolve the default preset id for bootstrap: pinned `userConf.defaultPresetId`
   * if it still references a known preset, else `STANDARD_PRESET_ID`.
   */
  resolveDefaultId: () => string;

  saveActive: () => Promise<void>;
  saveAs: (label: string, opts?: { aspects?: AspectMask; public?: boolean }) => Promise<string>;
  rename: (id: string, label: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  togglePublic: (id: string) => Promise<void>;
  setDefault: (id: string | null) => Promise<void>;
  toggleFav: (id: string) => Promise<void>;
  setFavorites: (ids: string[]) => Promise<void>;
  /**
   * Run `fn` with the trailing reload of every mutator deferred until `fn`
   * resolves; one coalesced reload fires at the end. Collapses N round-trips
   * into 1 for batched flows like the manage dialog's "Save". When the
   * preset feature is off, `fn` runs directly.
   */
  batch: <T>(fn: () => Promise<T>) => Promise<T>;
}

/** Internal handle for `createTableState` — holds the gate ref the bootstrap watcher reads. */
export interface PresetStateInternals {
  /** Bootstrap gate. False until `bootstrap()` resolves the default preset, true thereafter. */
  gate: Ref<boolean>;
  /**
   * Idempotent bootstrap. Watches `presetsHandle.loading`; when settled,
   * applies the resolved default preset (overlaying the localStorage draft
   * when `persistDrafts` is on), then flips `gate` true on the next tick so
   * the bootstrap watcher in `createTableState` fires its single composed
   * `query()`. No-op when `presetsHandle` is null (gate is treated as open
   * by the bootstrap watcher in that branch).
   */
  bootstrap: () => void;
}

/**
 * Slice that turns `usePresets` + `useLocalDraft` into the table-state
 * surface declared on `ReactiveTableState`. Pure mutation: writes to the
 * model arrays but never calls `query()` — the root watcher reacts.
 */
export function createPresetState(opts: CreatePresetStateOptions): {
  slice: PresetStateSlice;
  internals: PresetStateInternals;
} {
  const availableAspects = opts.availableAspects ?? DEFAULT_AVAILABLE_ASPECTS;
  const availableSet = new Set<PresetAspect>(availableAspects);

  const dialogOpen = ref(false);
  const gate = ref(false);
  // No `presetsHandle` → bootstrap is a no-op, gate never flips, so surface
  // `ready=true` to keep URL-bridge consumers from deadlocking.
  const ready = computed(() => (opts.presetsHandle ? gate.value : true));

  // Inert handle when the feature isn't wired keeps the slice reading from
  // one source — no `?? fallback` aliasing for every state field.
  const handle: UsePresetsReturn =
    opts.presetsHandle ?? createInertHandle(opts.fallbackSystemPresets);
  const {
    presets,
    presetsById,
    userConf,
    capabilities,
    systemPresets,
    systemPresetsById,
    available,
    currentUser,
    activePresetId: activeId,
  } = handle;

  const canSaveActive = computed(() => {
    const id = activeId.value;
    if (!id || isSystemPresetId(id)) return false;
    return opts.presetsHandle ? opts.presetsHandle.isOwned(id) : false;
  });

  // Per-aspect handler table. Each aspect owns three operations against the
  // state refs in `opts`: `capture` (read state → snapshot fragment), `apply`
  // (write fragment → state, with `isSystem` triggering reset-to-default
  // semantics), and `expandDefault` (factory fallback for system-preset
  // expansion). Adding a new aspect = adding one entry here; the loops below
  // pick it up. `itemsPerPage` is intentionally absent from `expandDefault`
  // because system snapshots don't carry it (page is reset in `apply()` after
  // the loop instead).
  type AspectHandler = {
    capture(o: CreatePresetStateOptions): unknown;
    apply(o: CreatePresetStateOptions, value: unknown, isSystem: boolean): void;
    expandDefault?: (o: CreatePresetStateOptions) => unknown;
  };

  const ASPECT_HANDLERS: Record<PresetAspect, AspectHandler> = {
    columns: {
      capture(o) {
        const overrides: Record<string, string> = {};
        for (const col of o.allColumns.value) {
          const entry = o.columnWidths.value[col.path];
          if (entry && entry.w !== entry.d) overrides[col.path] = entry.w;
        }
        const columns: NonNullable<PresetSnapshot["columns"]> = {
          columnNames: [...o.columnNames.value],
        };
        if (Object.keys(overrides).length > 0) columns.columnWidths = overrides;
        return columns;
      },
      apply(o, value, isSystem) {
        if (!value && !isSystem) return;
        const cols = value as PresetSnapshot["columns"];
        // System preset with no explicit columnNames falls back to the same
        // visible-only set used by `expandDefault` — `@ui.table.hidden`
        // columns are not auto-included.
        const columnNames = cols?.columnNames ?? defaultVisibleColumnPaths(o);
        const columnWidths = cols?.columnWidths;
        o.columnNames.value = [...columnNames];
        // Reset existing widths to defaults, then apply overrides.
        const next: ColumnWidthsMap = {};
        for (const [path, entry] of Object.entries(o.columnWidths.value)) {
          next[path] = { w: entry.d, d: entry.d };
        }
        if (columnWidths) {
          for (const [path, w] of Object.entries(columnWidths)) {
            const existing = next[path];
            if (existing) next[path] = { w, d: existing.d };
          }
        }
        o.columnWidths.value = next;
      },
      expandDefault(o) {
        return { columnNames: defaultVisibleColumnPaths(o) };
      },
    },
    filters: {
      capture: (o) => [...o.filterFields.value],
      apply(o, value, isSystem) {
        if (!value && !isSystem) return;
        o.filterFields.value = value ? [...(value as string[])] : [];
      },
      expandDefault: () => [],
    },
    filterOps: {
      capture(o) {
        const dict: FieldFilters = {};
        for (const [field, conditions] of Object.entries(o.filters.value)) {
          dict[field] = conditions;
        }
        return dict;
      },
      apply(o, value, isSystem) {
        if (!value && !isSystem) return;
        o.filters.value = value ? { ...(value as FieldFilters) } : {};
      },
      expandDefault: () => ({}),
    },
    sorters: {
      capture: (o) => [...o.sorters.value],
      apply(o, value, isSystem) {
        if (!value && !isSystem) return;
        o.sorters.value = value ? [...(value as SortControl[])] : [];
      },
      expandDefault: () => [],
    },
    itemsPerPage: {
      capture: (o) => o.pagination.value.itemsPerPage,
      apply(o, value) {
        if (value === undefined) return;
        o.pagination.value = { page: 1, itemsPerPage: value as number };
      },
    },
  };

  function maskAllows(aspect: PresetAspect, mask?: AspectMask): boolean {
    if (!availableSet.has(aspect)) return false;
    if (!mask) return true;
    return mask[aspect] === true;
  }

  function captureSnapshot(mask?: AspectMask): PresetSnapshot {
    const out: PresetSnapshot = {};
    for (const aspect of availableAspects) {
      if (!maskAllows(aspect, mask)) continue;
      (out as Record<string, unknown>)[aspect] = ASPECT_HANDLERS[aspect].capture(opts);
    }
    return out;
  }

  function resolveSnapshot(idOrSnapshot: string | PresetSnapshot): {
    snapshot: PresetSnapshot;
    nextActiveId: string | null;
  } {
    if (typeof idOrSnapshot !== "string") {
      return { snapshot: idOrSnapshot, nextActiveId: activeId.value };
    }
    const id = idOrSnapshot;
    if (isSystemPresetId(id)) {
      const sp = systemPresetsById.value.get(id);
      if (sp) return { snapshot: sp.content, nextActiveId: id };
      // Stale system id → fall back to Standard.
      const std = systemPresetsById.value.get(STANDARD_PRESET_ID);
      return { snapshot: std?.content ?? {}, nextActiveId: STANDARD_PRESET_ID };
    }
    const row = presetsById.value.get(id);
    if (!row) return { snapshot: {}, nextActiveId: null };
    const data = row.data as { content?: unknown } | null;
    const wire = data?.content;
    const snapshot = wire ? fromWireSnapshot(wire as Parameters<typeof fromWireSnapshot>[0]) : {};
    return { snapshot, nextActiveId: id };
  }

  function apply(idOrSnapshot: string | PresetSnapshot): void {
    const { snapshot, nextActiveId } = resolveSnapshot(idOrSnapshot);
    // System presets treat missing aspects as "factory default" (claim
    // everything in `availableAspects`); stored presets keep dict-form
    // opt-in so a column-only preset doesn't wipe filters on apply.
    const isSystem =
      typeof idOrSnapshot === "string" && nextActiveId !== null && isSystemPresetId(nextActiveId);

    for (const aspect of availableAspects) {
      const value = (snapshot as Record<string, unknown>)[aspect];
      ASPECT_HANDLERS[aspect].apply(opts, value, isSystem);
    }

    // `itemsPerPage` is the only aspect that doesn't reset on system apply;
    // when the snapshot doesn't pin it, still reset the page to 1 since the
    // data composition may have shifted.
    if (snapshot.itemsPerPage === undefined) {
      const current = opts.pagination.value;
      if (current.page !== 1) opts.pagination.value = { ...current, page: 1 };
    }

    if (typeof idOrSnapshot === "string") {
      activeId.value = nextActiveId;
    }
  }

  function resetActive(): void {
    const id = activeId.value;
    if (!id) return;
    apply(id);
  }

  function clearLocalDraft(): void {
    opts.draftHandle?.clear();
  }

  /**
   * Fill missing aspects with factory defaults so a system preset's snapshot
   * "claims all aspects in `availableAspects`" per spec §3.7. Stored presets
   * keep dict-form opt-in (untouched).
   */
  function expandSystemSnapshot(snapshot: PresetSnapshot): PresetSnapshot {
    const out: PresetSnapshot = { ...snapshot };
    for (const aspect of availableAspects) {
      const handler = ASPECT_HANDLERS[aspect];
      if (!handler.expandDefault) continue;
      if ((out as Record<string, unknown>)[aspect] !== undefined) continue;
      (out as Record<string, unknown>)[aspect] = handler.expandDefault(opts);
    }
    return out;
  }

  const activeSnapshot = computed<PresetSnapshot>(() => {
    const id = activeId.value;
    if (!id) return {};
    if (isSystemPresetId(id)) {
      const sp = systemPresetsById.value.get(id);
      return expandSystemSnapshot(sp?.content ?? {});
    }
    const row = presetsById.value.get(id);
    if (!row) return {};
    const data = row.data as { content?: unknown } | null;
    const wire = data?.content;
    return wire ? fromWireSnapshot(wire as Parameters<typeof fromWireSnapshot>[0]) : {};
  });

  const isDirty = computed(() => isDirtyAgainst(activeSnapshot.value, captureSnapshot()));

  function requirePresets(): UsePresetsReturn {
    if (!opts.presetsHandle) {
      throw new Error("[vue-table] presets feature not configured (preset.url missing)");
    }
    return opts.presetsHandle;
  }

  async function saveActive(): Promise<void> {
    const handle = requirePresets();
    const id = activeId.value;
    if (!id) throw new Error("[vue-table] saveActive: no active preset");
    if (isSystemPresetId(id)) {
      throw new Error("[vue-table] saveActive: system presets cannot be overwritten");
    }
    // Reuse the active preset's existing aspect mask — never widens.
    const existing = activeSnapshot.value;
    const mask: AspectMask = {};
    for (const aspect of availableAspects) {
      if ((existing as Record<string, unknown>)[aspect] !== undefined) mask[aspect] = true;
    }
    await handle.savePreset(captureSnapshot(mask));
    clearLocalDraft();
  }

  async function saveAs(
    label: string,
    saveOpts: { aspects?: AspectMask; public?: boolean } = {},
  ): Promise<string> {
    const handle = requirePresets();
    const id = await handle.savePresetAs(label, captureSnapshot(saveOpts.aspects), {
      public: saveOpts.public,
    });
    clearLocalDraft();
    return id;
  }

  async function rename(id: string, label: string): Promise<void> {
    await requirePresets().renamePreset(id, label);
  }

  async function remove(id: string): Promise<void> {
    const handle = requirePresets();
    const wasActive = activeId.value === id;
    await handle.deletePreset(id);
    if (wasActive) {
      // Re-apply Standard so state arrays reset to baseline.
      apply(STANDARD_PRESET_ID);
      clearLocalDraft();
    }
  }

  async function togglePublic(id: string): Promise<void> {
    await requirePresets().togglePublic(id);
  }

  async function setDefault(id: string | null): Promise<void> {
    await requirePresets().setDefault(id);
  }

  async function toggleFav(id: string): Promise<void> {
    await requirePresets().toggleFav(id);
  }

  async function setFavorites(ids: string[]): Promise<void> {
    await requirePresets().setFavorites(ids);
  }

  // When the preset feature is off, batch is a pass-through so callers can
  // wrap unconditionally without checking `available`.
  function batch<T>(fn: () => Promise<T>): Promise<T> {
    return opts.presetsHandle ? opts.presetsHandle.batch(fn) : fn();
  }

  function resolveDefaultId(): string {
    const pinned = (userConf.value?.data as { defaultPresetId?: string } | undefined)
      ?.defaultPresetId;
    if (!pinned) return STANDARD_PRESET_ID;
    if (isSystemPresetId(pinned)) {
      return systemPresetsById.value.has(pinned) ? pinned : STANDARD_PRESET_ID;
    }
    return presetsById.value.has(pinned) ? pinned : STANDARD_PRESET_ID;
  }

  function bootstrap(): void {
    if (!opts.presetsHandle) return;
    const handle = opts.presetsHandle;
    const stop = watch(
      () => handle.loading.value,
      (loading) => {
        if (loading) return;
        stop();
        // Compose default + persisted draft into one snapshot then apply
        // once — halves per-aspect ref writes vs two back-to-back applies.
        const id = resolveDefaultId();
        const { snapshot, nextActiveId } = resolveSnapshot(id);
        const base = isSystemPresetId(id) ? expandSystemSnapshot(snapshot) : snapshot;
        const draftEnabled = !!(opts.draftHandle && opts.persistDrafts);
        const merged = draftEnabled
          ? (opts.draftHandle as UseLocalDraftReturn).hydrate(base)
          : base;
        apply(merged);
        // apply(snapshot) doesn't touch activeId; set it explicitly.
        activeId.value = nextActiveId;
        if (draftEnabled) {
          (opts.draftHandle as UseLocalDraftReturn).watchAndPersist(
            () => captureSnapshot(),
            () => activeSnapshot.value,
          );
        }
        // Release the gate after apply()'s writes settle.
        void nextTick(() => {
          gate.value = true;
        });
      },
      { immediate: true },
    );
  }

  const slice: PresetStateSlice = {
    presets,
    presetsById,
    userConf,
    capabilities,
    systemPresets,
    systemPresetsById,
    availableAspects,
    available,
    activeId,
    activeSnapshot,
    isDirty,
    canSaveActive,
    currentUser,
    isOwned: (id: string) => handle.isOwned(id),
    dialogOpen,
    ready,
    captureSnapshot,
    apply,
    resetActive,
    clearLocalDraft,
    resolveDefaultId,
    saveActive,
    saveAs,
    rename,
    remove,
    togglePublic,
    setDefault,
    toggleFav,
    setFavorites,
    batch,
  };

  return { slice, internals: { gate, bootstrap } };
}

function inertMutator(): never {
  throw new Error("[vue-table] presets feature not configured (preset.url missing)");
}

// Inert UsePresetsReturn used when the preset feature isn't configured.
// Every reactive field still reads through `handle.*` — no fallback
// aliasing in the consumer.
function createInertHandle(fallbackSystemPresets?: SystemPreset[]): UsePresetsReturn {
  const systemList = fallbackSystemPresets ?? resolveSystemPresets();
  const systemPresets = computed(() => systemList);
  const systemPresetsById = computed(() => {
    const map = new Map<string, SystemPreset>();
    for (const sp of systemList) map.set(sp.id, sp);
    return map;
  });
  return {
    presets: shallowRef([]),
    presetsById: computed(() => new Map<string, AsPresetEntryRow>()),
    userConf: shallowRef(null),
    capabilities: ref(null),
    systemPresets,
    systemPresetsById,
    available: computed(() => false),
    loading: ref(false),
    error: ref(null),
    currentUser: computed(() => null),
    activePresetId: ref(null),
    activePreset: computed(() => null),
    isOwned: () => false,
    reload: async () => {},
    batch: <T>(fn: () => Promise<T>) => fn(),
    savePreset: inertMutator,
    savePresetAs: inertMutator,
    renamePreset: inertMutator,
    deletePreset: inertMutator,
    togglePublic: inertMutator,
    setDefault: inertMutator,
    toggleFav: inertMutator,
    setFavorites: inertMutator,
  };
}
