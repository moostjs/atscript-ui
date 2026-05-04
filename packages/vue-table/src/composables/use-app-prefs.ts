import {
  AppPrefsClient,
  type AppConfData,
  type AsPresetEntryRow,
  isAuthError,
} from "@atscript/ui-table";
import { type ClientFactory } from "@atscript/ui";
import { type EventBusKey, StorageSerializers, useEventBus, useStorage } from "@vueuse/core";
import {
  type ComputedRef,
  type Ref,
  type WritableComputedRef,
  computed,
  ref,
  shallowRef,
} from "vue";

import { injectPresetsApp } from "./as-presets-app";

export interface UseAppPrefsOptions {
  /** App namespace; defaults to `inject(AS_PRESETS_APP)`. */
  app?: string;
  /** Presets controller URL, e.g. `"/db/_presets"`. */
  url: string;
  /** Custom client factory (auth-configured). Defaults to `getDefaultClientFactory()`. */
  clientFactory?: ClientFactory;
  /** Auto-load on setup. Default `true`. */
  autoLoad?: boolean;
  /**
   * Cache the most recent prefs in `localStorage` keyed by app, so the
   * next mount paints from cache (no flash of defaults while the network
   * settles) and a failed/denied load still surfaces a usable theme.
   * Server responses always overwrite the cache, so when a different
   * user signs in, their state replaces the previous user's after one
   * round-trip. Default `true` — pass `false` to opt out (e.g. tests,
   * sensitive environments).
   */
  cache?: boolean;
}

export interface UseAppPrefsReturn {
  /**
   * Reactive prefs object. Always non-null — defaults to `{}` until the
   * first load resolves. Read-only at the surface; mutate via `save()`.
   */
  prefs: WritableComputedRef<AppConfData>;
  loading: Ref<boolean>;
  /** Last non-auth error, or `null`. Auth errors flip `available` instead. */
  error: Ref<unknown>;
  /** False on 401/403 from initial load; UI should hide pref-bound controls. */
  available: ComputedRef<boolean>;
  reload(): Promise<void>;
  /**
   * Optimistic shallow-merge save. The local `prefs` is updated immediately
   * for snappy UI; on server error the optimistic write is rolled back and
   * the error is re-thrown for the caller to surface.
   */
  save(patch: Partial<AppConfData>): Promise<void>;
  /** Drop in-memory state. Useful from sign-out flows. */
  reset(): void;
}

interface BusSavePayload {
  app: string;
  prefs: AppConfData;
  row: AsPresetEntryRow | null;
}
interface BusResetPayload {
  app: string;
  reset: true;
}
type BusPayload = BusSavePayload | BusResetPayload;

// Module-scoped bus key so every `useAppPrefs(app)` listener (sidebar, prefs
// page, etc.) sees save/reset events from any other instance. VueUse's
// `useEventBus(key)` shares listeners across calls with the same key and
// auto-removes them on `onScopeDispose`.
const APP_PREFS_BUS: EventBusKey<BusPayload> = Symbol("as-app-prefs");

const CACHE_PREFIX = "as-app-prefs";

/**
 * Public dev-facing composable for app-wide user preferences. Independent
 * of presets / tables — devs can use it on any settings surface to read
 * and write `appearance`, `language`, `density`, `customJson` etc. for
 * `(currentUser, app)`.
 *
 * @example
 * ```ts
 * const { prefs, save } = useAppPrefs({ url: "/db/_presets" })
 * // prefs.value.appearance is reactive in templates
 * await save({ appearance: "dark" })
 * ```
 */
export function useAppPrefs(opts: UseAppPrefsOptions): UseAppPrefsReturn {
  const app = injectPresetsApp(opts.app);
  const cacheEnabled = opts.cache !== false;
  const client = new AppPrefsClient({
    url: opts.url,
    app,
    clientFactory: opts.clientFactory,
  });

  // `useStorage` (when cached) handles JSON encode/decode, SSR-null storage,
  // and try/catch around quota errors. `null` removes the key on assignment,
  // matching the previous `clearCache` semantics. When `cache: false`, fall
  // back to a plain ref so we don't even READ from localStorage on mount.
  const cacheKey = `${CACHE_PREFIX}:${app}`;
  const cache = cacheEnabled
    ? useStorage<AppConfData | null>(cacheKey, null, undefined, {
        listenToStorageChanges: true,
        serializer: StorageSerializers.object,
        // Sync flush so optimistic writes / reset hit localStorage before
        // the next assertion / mount — matches the previous direct-write
        // semantics callers rely on.
        flush: "sync",
      })
    : ref<AppConfData | null>(null);

  function clearCache(): void {
    // Setting `cache.value = null` only triggers the watcher when the ref
    // was non-null; if a foreign tab wrote to the same key while ours was
    // already null, the watcher would no-op and the stale entry would
    // survive. Force-remove via the storage API to keep that case clean.
    cache.value = null;
    if (cacheEnabled) {
      try {
        globalThis.localStorage?.removeItem(cacheKey);
      } catch {
        // ignored — sandboxed iframes / quota / SSR
      }
    }
  }

  const prefs = computed<AppConfData>({
    get: () => cache.value ?? {},
    set: (value) => {
      cache.value = value;
    },
  });
  const existing = shallowRef<AsPresetEntryRow | null>(null);
  const loading = ref(false);
  const error = ref<unknown>(null);
  const denied = ref(false);

  const available = computed(() => !denied.value);

  async function reload(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const result = await client.load();
      if (result.denied) {
        denied.value = true;
        clearCache();
        existing.value = null;
        return;
      }
      denied.value = false;
      cache.value = { ...result.prefs };
      existing.value = result.row;
    } catch (err) {
      if (isAuthError(err)) {
        denied.value = true;
        clearCache();
        existing.value = null;
        return;
      }
      error.value = err;
      // eslint-disable-next-line no-console
      console.warn("[vue-table] useAppPrefs load failed:", err);
    } finally {
      loading.value = false;
    }
  }

  async function save(patch: Partial<AppConfData>): Promise<void> {
    const prev = { ...prefs.value };
    // Optimistic: writes flow through the cache ref so subscribers (other
    // instances + storage event listeners) see the new value before the
    // network settles.
    cache.value = { ...prev, ...patch };
    try {
      const id = await client.save(existing.value, patch);
      if (!existing.value && id) {
        existing.value = {
          id,
          type: "appConf",
          app,
          user: "",
          data: { ...prefs.value },
          createdAt: 0,
          updatedAt: 0,
        };
      }
      bus.emit({ app, prefs: prefs.value, row: existing.value });
    } catch (err) {
      cache.value = prev;
      throw err;
    }
  }

  function reset(): void {
    clearCache();
    existing.value = null;
    error.value = null;
    denied.value = false;
    bus.emit({ app, reset: true });
  }

  // Cross-instance sync: any `useAppPrefs(app)` save/reset fans out to
  // every other instance sharing the same `app` namespace. Saver also
  // publishes the server-stamped row so receivers route the next save
  // through update (not a duplicate insert).
  const bus = useEventBus(APP_PREFS_BUS);
  bus.on((payload) => {
    if (payload.app !== app) return;
    if ("reset" in payload) {
      clearCache();
      existing.value = null;
      return;
    }
    cache.value = { ...payload.prefs };
    if (payload.row && !existing.value) existing.value = payload.row;
  });

  // Skip the SSR pass — `fetch` / `localStorage` aren't available, the
  // load would warn and the cached value (or {}) is what SSR should serialise.
  if (opts.autoLoad !== false && typeof window !== "undefined") void reload();

  return {
    prefs,
    loading,
    error,
    available,
    reload,
    save,
    reset,
  };
}
