import {
  PresetsClient,
  STANDARD_PRESET_ID,
  cachedPresetCapabilities,
  cachedPresetRows,
  isPresetsCacheActive,
  isUnavailableError,
  isSystemPresetId,
  loadPresetCapabilities,
  loadPresetRows,
  presetsCacheKey,
  publishPresetsWrite,
  resolveSystemPresets,
  sharedPresetsClient,
  subscribePresetsCache,
  type AsPresetEntryRow,
  type PresetCapabilities,
  type PresetRows,
  type PresetsCacheListener,
  type PresetsListResult,
  type PresetSnapshot,
  type SystemPreset,
  type SystemPresetInput,
} from "@atscript/ui-table";
import { type ClientFactory } from "@atscript/ui";
import {
  type ComputedRef,
  type Ref,
  type ShallowRef,
  computed,
  getCurrentScope,
  onScopeDispose,
  ref,
  shallowRef,
} from "vue";

import { injectPresetsApp } from "./as-presets-app";

export interface UsePresetsOptions {
  /** App namespace; defaults to `inject(AS_PRESETS_APP)`. */
  app?: string;
  /** Per-table identifier. Required. */
  tableKey: string;
  /** Presets controller URL, e.g. `"/db/_presets"`. */
  url: string;
  /** Custom client factory (auth-configured). */
  clientFactory?: ClientFactory;
  /** Consumer-defined synthetic presets (`sys:*` namespace). */
  systemPresets?: SystemPresetInput[];
  /** Auto-load on setup. Default `true`. */
  autoLoad?: boolean;
}

export type ActivePresetView =
  | { kind: "system"; entry: SystemPreset }
  | { kind: "stored"; entry: AsPresetEntryRow };

export interface UsePresetsReturn {
  presets: ShallowRef<AsPresetEntryRow[]>;
  presetsById: ComputedRef<Map<string, AsPresetEntryRow>>;
  userConf: ShallowRef<AsPresetEntryRow | null>;
  capabilities: Ref<PresetCapabilities | null>;
  systemPresets: ComputedRef<SystemPreset[]>;
  systemPresetsById: ComputedRef<Map<string, SystemPreset>>;
  /** False on 401/403 from initial load — UI hides itself. */
  available: ComputedRef<boolean>;
  /**
   * True while the preset rows load. Capabilities load beside it and never
   * hold it (they arrive in `capabilities`); a load served from the session
   * cache never sets it.
   */
  loading: Ref<boolean>;
  /**
   * Load failure from `reload()`, or null. Mutator failures are NOT recorded
   * here — they rethrow, and the table-state slice's
   * `state.preset.lastError` is the single channel UI renders.
   */
  error: Ref<unknown>;
  /**
   * Authoritative current-user id. `capabilities.userId` when caps are
   * loaded, else best-effort derivation from any private row.
   */
  currentUser: ComputedRef<string | null>;

  /** Currently applied preset id (`sys:*` for system or stored row id). */
  activePresetId: Ref<string | null>;
  /** Resolved view of the active preset (system / stored / null). */
  activePreset: ComputedRef<ActivePresetView | null>;

  /**
   * "Owned by current user" predicate for stored rows. Used by canSave /
   * delete / public-toggle gating. Returns false for system presets.
   */
  isOwned(id: string): boolean;

  reload(): Promise<void>;

  /**
   * Run `fn` with the trailing `reload()` of every mutator (save / saveAs /
   * rename / delete / togglePublic / setDefault / setFavorites / toggleFav)
   * deferred until `fn` resolves. One coalesced reload fires at the end —
   * collapses N round-trips into 1 for batched UI flows like the manage
   * dialog's Save button. Re-entrant; outer batch wins.
   */
  batch<T>(fn: () => Promise<T>): Promise<T>;

  /**
   * Overwrite the active preset's content. The caller supplies the
   * snapshot — the table-state composable uses `state.captureSnapshot()`
   * here. Throws when the active preset is a system preset (never saveable).
   */
  savePreset(snapshot: PresetSnapshot): Promise<void>;

  /**
   * Create a new preset row. Returns the new id; sets `activePresetId` to
   * it so the picker switches to the new preset.
   */
  savePresetAs(
    label: string,
    snapshot: PresetSnapshot,
    opts?: { public?: boolean },
  ): Promise<string>;

  renamePreset(id: string, label: string): Promise<void>;
  deletePreset(id: string): Promise<void>;
  togglePublic(id: string): Promise<void>;

  /** Pin a preset as default for this `(user, app, tableKey)`. */
  setDefault(id: string | null): Promise<void>;
  /** Toggle a preset's pinned-as-favorite state. */
  toggleFav(id: string): Promise<void>;
  /**
   * Replace the full favorites list in one upsert. Lets a batched UI
   * (e.g. the manage dialog's "Save" button) commit a whole new set instead
   * of N round-trips through {@link toggleFav}.
   */
  setFavorites(ids: string[]): Promise<void>;
}

/**
 * Public dev-facing composable for table presets. Powers `<AsPresetPicker>`
 * internally and is exported for devs who want to wire bespoke surfaces.
 *
 * Stateful: holds reactive `presets` / `userConf` / `capabilities` and
 * supports optimistic mutators that re-list after each successful write.
 *
 * Once the app binds the viewer with `setMetaCacheIdentity()`, loads go
 * through the browser session cache of `@atscript/ui-table`: a re-mount
 * applies the cached rows synchronously (no request inside the max age,
 * a background revalidation after it), capabilities load once per session,
 * and a write here updates every other mounted consumer of the same
 * `(url, app, tableKey)` — in this tab directly, in other tabs through a
 * `BroadcastChannel`.
 *
 * Active-preset selection (`activePresetId`) is **owned by the caller** —
 * the composable provides the ref but doesn't auto-resolve it on mount;
 * that's the table-state's responsibility (Slice 4) since it depends on
 * `userConf.defaultPresetId` resolution + Standard fallback.
 */
export function usePresets(opts: UsePresetsOptions): UsePresetsReturn {
  const app = injectPresetsApp(opts.app);
  if (!opts.tableKey) {
    throw new Error("[vue-table] usePresets: `tableKey` is required");
  }
  // Session cache: browser only, and only once the app binds the viewer
  // (`setMetaCacheIdentity`) — otherwise a sign-out / sign-in in the same tab
  // could show the previous user's presets.
  const cached = isPresetsCacheActive();
  const cacheKey = presetsCacheKey(opts.url, app, opts.tableKey);
  const client = new PresetsClient({
    url: opts.url,
    app,
    tableKey: opts.tableKey,
    client: cached ? sharedPresetsClient(opts.url, opts.clientFactory) : undefined,
    clientFactory: opts.clientFactory,
  });

  const systemPresetsResolved = computed(() => resolveSystemPresets(opts.systemPresets));

  const presets = shallowRef<AsPresetEntryRow[]>([]);
  const userConf = shallowRef<AsPresetEntryRow | null>(null);
  const capabilities = ref<PresetCapabilities | null>(null);
  const loading = ref(false);
  const error = ref<unknown>(null);
  const denied = ref(false);
  const activePresetId = ref<string | null>(null);

  const available = computed(() => !denied.value);

  const presetsById = computed(() => {
    const map = new Map<string, AsPresetEntryRow>();
    for (const row of presets.value) map.set(row.id, row);
    return map;
  });
  const systemPresetsById = computed(() => {
    const map = new Map<string, SystemPreset>();
    for (const sp of systemPresetsResolved.value) map.set(sp.id, sp);
    return map;
  });

  const activePreset = computed<ActivePresetView | null>(() => {
    const id = activePresetId.value;
    if (!id) return null;
    if (isSystemPresetId(id)) {
      const entry = systemPresetsById.value.get(id);
      return entry ? { kind: "system", entry } : null;
    }
    const entry = presetsById.value.get(id);
    return entry ? { kind: "stored", entry } : null;
  });

  // Read gate guarantees that if `public !== true`, then `user === currentUser`.
  // For public rows the server-stamped `currentUser` (caps → row scan) is the
  // only source that distinguishes own-public from others-public.
  const currentUser = computed<string | null>(() => {
    const fromCaps = capabilities.value?.userId;
    if (typeof fromCaps === "string" && fromCaps.length > 0) return fromCaps;
    for (const row of presets.value) {
      if (row.public !== true && typeof row.user === "string" && row.user.length > 0) {
        return row.user;
      }
    }
    return null;
  });

  function isOwned(id: string): boolean {
    if (isSystemPresetId(id)) return false;
    const row = presetsById.value.get(id);
    if (!row) return false;
    if (row.public !== true) return true;
    const me = currentUser.value;
    return me !== null && row.user === me;
  }

  function applyRows(rows: PresetRows): void {
    denied.value = false;
    presets.value = rows.presets;
    userConf.value = rows.userConf;
  }

  function applyDenied(): void {
    denied.value = true;
    presets.value = [];
    userConf.value = null;
    capabilities.value = null;
  }

  function applyResult(result: PresetsListResult): void {
    if (result.denied) applyDenied();
    else applyRows(result);
  }

  const listener: PresetsCacheListener = {
    onRows: applyRows,
    onCapabilities: (caps) => {
      if (!denied.value) capabilities.value = caps;
    },
    refresh: (full) => {
      void revalidate();
      if (full) void loadCapabilities();
    },
  };
  // Only with a scope to unsubscribe on: a scope-less subscription would leak.
  if (cached && getCurrentScope()) onScopeDispose(subscribePresetsCache(cacheKey, listener));

  function fetchRows(force: boolean): Promise<PresetsListResult> {
    const fetch = () => client.list({ capabilities: false });
    return cached ? loadPresetRows(cacheKey, fetch, { force, origin: listener }) : fetch();
  }

  /**
   * Capabilities load beside the rows and never block the first query —
   * only the rows (default preset) and the table definition do. They only
   * gate save / publish / limit UI.
   */
  async function loadCapabilities(): Promise<void> {
    // A cache hit lands synchronously, before the first render.
    const hit = cached ? cachedPresetCapabilities(cacheKey) : undefined;
    if (hit) {
      if (!denied.value) capabilities.value = hit;
      return;
    }
    const fetch = () => client.loadCapabilities();
    try {
      const caps = await (cached ? loadPresetCapabilities(cacheKey, fetch, listener) : fetch());
      if (!denied.value) capabilities.value = caps;
    } catch {
      // Best-effort: the UI degrades gracefully when capabilities are null.
      capabilities.value = null;
    }
  }

  /** Background row refresh: no `loading`, failures keep what is shown. */
  async function revalidate(): Promise<void> {
    try {
      applyResult(await fetchRows(true));
    } catch {
      /* keep the rows on screen; the next load retries */
    }
  }

  /**
   * @param opts.capabilities — set `false` for refresh-after-mutation calls
   *   (fav-toggle, save, rename, delete, public-toggle, set-default) where
   *   role-derived capabilities can't have changed. Default `true`.
   */
  // Reload-deferral: when batch depth > 0, mutators flag a pending reload
  // and skip their trailing call; one coalesced reload fires when depth
  // returns to zero.
  let batchDepth = 0;
  let reloadPending = false;

  async function maybeReloadAfterMutation(): Promise<void> {
    if (batchDepth > 0) {
      reloadPending = true;
      return;
    }
    await reloadAfterWrite();
  }

  /** The trailing reload of a write: refreshes the shared entry (other mounted tables follow) and tells other tabs. */
  async function reloadAfterWrite(): Promise<void> {
    await reload({ capabilities: false });
    if (cached) publishPresetsWrite(cacheKey);
  }

  async function batch<T>(fn: () => Promise<T>): Promise<T> {
    batchDepth++;
    try {
      return await fn();
    } finally {
      batchDepth--;
      if (batchDepth === 0 && reloadPending) {
        reloadPending = false;
        await reloadAfterWrite();
      }
    }
  }

  async function reload(reloadOpts: { capabilities?: boolean } = {}): Promise<void> {
    if (reloadOpts.capabilities !== false) void loadCapabilities();
    await load(true);
  }

  /** Foreground row load: drives `loading` and `error`. */
  async function load(force: boolean): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      applyResult(await fetchRows(force));
    } catch (err) {
      if (isUnavailableError(err)) {
        applyDenied();
        return;
      }
      error.value = err;
      // eslint-disable-next-line no-console
      console.warn("[vue-table] usePresets load failed:", err);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Initial load. From the session cache when it holds this scope: rows are
   * applied synchronously (the default preset resolves with no network
   * wait) and revalidated in the background once past the max age — a
   * revalidation updates the list but never re-applies the default.
   */
  async function initialLoad(): Promise<void> {
    const hit = cached ? cachedPresetRows(cacheKey) : undefined;
    if (hit) applyRows(hit.rows);
    void loadCapabilities();
    // `load` raises `loading` synchronously, before the preset bootstrap looks.
    if (!hit) await load(false);
    else if (!hit.fresh) await revalidate();
  }

  async function savePreset(snapshot: PresetSnapshot): Promise<void> {
    const id = activePresetId.value;
    if (!id) throw new Error("[vue-table] usePresets.savePreset: no active preset");
    if (isSystemPresetId(id)) {
      throw new Error("[vue-table] usePresets.savePreset: system presets cannot be overwritten");
    }
    const row = presetsById.value.get(id);
    const label = row?.label ?? (row?.data as { label?: string } | null)?.label ?? "";
    if (!label) {
      throw new Error("[vue-table] usePresets.savePreset: existing preset has no label");
    }
    await client.savePreset(id, label, snapshot);
    await maybeReloadAfterMutation();
  }

  async function savePresetAs(
    label: string,
    snapshot: PresetSnapshot,
    saveOpts: { public?: boolean } = {},
  ): Promise<string> {
    const result = await client.savePresetAs(label, snapshot, saveOpts);
    await maybeReloadAfterMutation();
    activePresetId.value = result.id;
    return result.id;
  }

  async function renamePreset(id: string, label: string): Promise<void> {
    if (isSystemPresetId(id)) {
      throw new Error("[vue-table] usePresets.renamePreset: system presets cannot be renamed");
    }
    await client.renamePreset(id, label);
    await maybeReloadAfterMutation();
  }

  async function deletePreset(id: string): Promise<void> {
    if (isSystemPresetId(id)) {
      throw new Error("[vue-table] usePresets.deletePreset: system presets cannot be deleted");
    }
    await client.deletePreset(id);
    if (activePresetId.value === id) {
      // Active row gone — picker falls back to Standard via the table state.
      activePresetId.value = STANDARD_PRESET_ID;
    }
    await maybeReloadAfterMutation();
  }

  async function togglePublic(id: string): Promise<void> {
    if (isSystemPresetId(id)) {
      throw new Error("[vue-table] usePresets.togglePublic: system presets are not public");
    }
    const row = presetsById.value.get(id);
    if (!row) return;
    await client.setPublic(id, row.public !== true);
    await maybeReloadAfterMutation();
  }

  async function setDefault(id: string | null): Promise<void> {
    const user = currentUser.value ?? undefined;
    await client.upsertUserConf(userConf.value, { defaultPresetId: id ?? undefined }, user);
    await maybeReloadAfterMutation();
  }

  async function toggleFav(id: string): Promise<void> {
    const current = (userConf.value?.data as { favPresetIds?: string[] } | undefined)?.favPresetIds;
    const set = new Set(current ?? []);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    await setFavorites([...set]);
  }

  async function setFavorites(ids: string[]): Promise<void> {
    const user = currentUser.value ?? undefined;
    await client.upsertUserConf(userConf.value, { favPresetIds: ids }, user);
    // Optimistically merge userConf so the picker's filled-in star re-renders
    // before the trailing reload settles.
    if (userConf.value) {
      userConf.value = {
        ...userConf.value,
        data: { ...userConf.value.data, favPresetIds: ids },
      };
    }
    await maybeReloadAfterMutation();
  }

  if (opts.autoLoad !== false) {
    void initialLoad();
  }

  return {
    presets,
    presetsById,
    userConf,
    capabilities,
    systemPresets: systemPresetsResolved,
    systemPresetsById,
    available,
    loading,
    error,
    currentUser,
    activePresetId,
    activePreset,
    isOwned,
    reload,
    batch,
    savePreset,
    savePresetAs,
    renamePreset,
    deletePreset,
    togglePublic,
    setDefault,
    toggleFav,
    setFavorites,
  };
}
