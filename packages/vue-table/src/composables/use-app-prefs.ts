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
  effectScope,
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

type ChannelMessage =
  | { type: "save"; prefs: AppConfData; row: AsPresetEntryRow | null }
  | { type: "reset" };

// Module-scoped bus so two singletons sharing one app namespace (different
// `url`s) still see each other's save/reset events in-window.
const APP_PREFS_BUS: EventBusKey<BusPayload> = Symbol("as-app-prefs");

const CACHE_PREFIX = "as-app-prefs";

interface AppPrefsInstance {
  cacheEnabled: boolean;
  public: UseAppPrefsReturn;
  dispose: () => void;
}

// Singleton registry keyed by `${app}|${url}`. Prevents N parallel
// `/query?type=appConf` requests when multiple widgets call the composable.
const REGISTRY = new Map<string, AppPrefsInstance>();

function instanceKey(app: string, url: string): string {
  return `${app}|${url}`;
}

/**
 * Public dev-facing composable for app-wide user preferences. Independent
 * of presets / tables — devs can use it on any settings surface to read
 * and write `appearance`, `language`, `density`, `customJson` etc. for
 * `(currentUser, app)`.
 *
 * Multiple calls with the same `(app, url)` share one underlying instance,
 * so duplicate widgets (sidebar + page header + /preferences) make a single
 * `/query?type=appConf` request total.
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
  const key = instanceKey(app, opts.url);
  const existing = REGISTRY.get(key);
  if (existing) {
    const requested = opts.cache !== false;
    if (requested !== existing.cacheEnabled) {
      // eslint-disable-next-line no-console
      console.warn(
        `[vue-table] useAppPrefs("${app}", "${opts.url}"): cache=${requested} ignored — first caller registered cache=${existing.cacheEnabled}.`,
      );
    }
    return existing.public;
  }
  const instance = createInstance(app, opts);
  REGISTRY.set(key, instance);
  return instance.public;
}

/** Tear down a singleton instance — closes its BroadcastChannel and clears the registry slot. Test escape hatch. */
export function disposeAppPrefs(app: string, url: string): void {
  const key = instanceKey(app, url);
  const instance = REGISTRY.get(key);
  if (!instance) return;
  instance.dispose();
  REGISTRY.delete(key);
}

function createInstance(app: string, opts: UseAppPrefsOptions): AppPrefsInstance {
  // Detached scope: the singleton outlives any individual component's scope,
  // so its watchers/listeners must not be torn down by `onScopeDispose`.
  const scope = effectScope(true);
  return scope.run((): AppPrefsInstance => {
    const cacheEnabled = opts.cache !== false;
    const client = new AppPrefsClient({
      url: opts.url,
      app,
      clientFactory: opts.clientFactory,
    });

    const cacheKey = `${CACHE_PREFIX}:${app}`;
    // `useStorage` (when cached) handles JSON encode/decode, SSR-null storage,
    // and try/catch around quota errors. Sync flush so optimistic writes hit
    // localStorage before the next assertion / mount. `cache: false` falls back
    // to a plain ref so we never read from localStorage on mount.
    const cache = cacheEnabled
      ? useStorage<AppConfData | null>(cacheKey, null, undefined, {
          listenToStorageChanges: true,
          serializer: StorageSerializers.object,
          flush: "sync",
        })
      : ref<AppConfData | null>(null);

    function clearCache(): void {
      // Foreign-tab safety: if a peer wrote to `cacheKey` while ours was
      // already null, `cache.value = null` no-ops; force-remove via the
      // storage API to keep the entry from surviving.
      cache.value = null;
      if (cacheEnabled) {
        try {
          globalThis.localStorage?.removeItem(cacheKey);
        } catch {
          /* sandboxed iframes / quota / SSR */
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

    const channel = createChannel(app);

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
        const snapshot = { ...prefs.value };
        bus.emit({ app, prefs: snapshot, row: existing.value });
        channel?.postMessage({ type: "save", prefs: snapshot, row: existing.value });
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
      channel?.postMessage({ type: "reset" });
    }

    // In-window cross-instance sync (covers two singletons under one app w/
    // different `url`s). Saver also publishes the server-stamped row so
    // receivers route the next save through update, not a duplicate insert.
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

    // Cross-tab sync — peers in other tabs/windows. The channel does not echo
    // messages back to the sender.
    channel?.addEventListener("message", (e: MessageEvent) => {
      const msg = e.data as ChannelMessage;
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "reset") {
        clearCache();
        existing.value = null;
        return;
      }
      if (msg.type === "save") {
        cache.value = { ...msg.prefs };
        if (msg.row && !existing.value) existing.value = msg.row;
      }
    });

    // Skip SSR — `fetch` / `localStorage` aren't available; serialise the
    // cached value (or {}) as-is.
    if (opts.autoLoad !== false && typeof window !== "undefined") void reload();

    return {
      cacheEnabled,
      public: { prefs, loading, error, available, reload, save, reset },
      dispose() {
        channel?.close();
        scope.stop();
      },
    };
  })!;
}

function createChannel(app: string): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (typeof BroadcastChannel !== "function") return null;
  try {
    return new BroadcastChannel(`as-app-prefs:${app}`);
  } catch {
    return null;
  }
}
