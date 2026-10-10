import { clearMetaStore, defaultMetaStore, type Client, type MetaStore } from "@atscript/db-client";
import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { deserializeAnnotatedType } from "@atscript/typescript/utils";
import { getDefaultClientFactory, type ClientFactory } from "../client-factory";
import { createTableDef } from "../table/create-table-def";
import type { MetaResponse, TableDef } from "../table/types";
import type { ResolvedValueHelp } from "../value-help/resolve";
import { invalidateValueHelpCache } from "../value-help/value-help-client";

/**
 * Shared per-URL cache. A single entry holds the `Client` instance, the raw
 * `/meta` promise, the deserialized type, and lazily-populated derived shapes
 * (`ResolvedValueHelp` for value-help, `TableDef` for tables). Both
 * `resolveValueHelp` and `useTable` route through it so a given URL triggers
 * at most one network round-trip and one `deserializeAnnotatedType`.
 *
 * Byte-identical `/meta` bodies (same `ETag`, e.g. one parametric controller
 * under different route params) also share the deserialized type and the
 * `TableDef` across URLs.
 *
 * The cache keeps the {@link setMetaCacheMaxEntries} most recently used
 * URLs; an entry held with {@link retainMetaEntry} is never evicted.
 *
 * `/meta` is projected per viewer, so the cache belongs to one identity
 * (`setMetaCacheIdentity`) and exists only in the browser: during server
 * rendering one process serves many viewers, so every call builds a fresh,
 * uncached entry whose client keeps no `/meta` store.
 */
export interface MetaCacheEntry {
  client: Client;
  meta: Promise<MetaResponse>;
  type: Promise<TAtscriptAnnotatedType>;
  resolved?: Promise<ResolvedValueHelp>;
  tableDef?: Promise<TableDef>;
}

/** Options for {@link getMetaEntry}. */
export interface MetaEntryOptions {
  /**
   * Key under which the `/meta` revalidation store keeps this URL's `ETag`s
   * (default: the `/meta` URL). Give every URL of one parametric mount the
   * route template (e.g. `"/api/db/ticket-issue/:key"`): a new route param
   * then revalidates against the body already loaded for another one and
   * costs a `304` instead of the full `/meta`. Forwarded to the
   * {@link ClientFactory} as `metaKey`; honoured only by the first call per
   * URL, like the factory. Since 0.1.153.
   */
  metaKey?: string;
}

/** What a `/meta` body deserializes to — shared by every URL serving the same bytes. */
interface Derived {
  type: TAtscriptAnnotatedType;
  tableDef?: TableDef;
}

/** Bookkeeping behind each handed-out entry (kept off the public shape). */
interface Slot {
  url: string;
  derived: Promise<Derived>;
  /** Open {@link retainMetaEntry} holds. */
  holds: number;
  /** The `ETag` whose shared `Derived` this entry counts in `derivedByEtag`. */
  etag?: string;
  /** The custom `/meta` store this entry counts in `customStores`. */
  store?: MetaStore;
}

/**
 * Enough for every URL a page touches — a table, the dictionaries its
 * filters and forms pick from — plus the recent navigation history, so going
 * back is instant; small enough to cap a long session at a few MB of parsed
 * `/meta`. Twice the `@atscript/db-client` `MetaStore` body limit, since
 * parametric URLs share bodies.
 */
const DEFAULT_MAX_ENTRIES = 100;
let maxEntries = DEFAULT_MAX_ENTRIES;
/** Per-URL entries, least recently used first. Browser only. */
const cache = new Map<string, MetaCacheEntry>();
const slots = new WeakMap<MetaCacheEntry, Slot>();
/** Derived shapes per `ETag`, counted by the cached entries that use them. Browser only. */
const derivedByEtag = new Map<string, { derived: Derived; refs: number }>();
/** Custom `/meta` stores of cached clients, counted by the entries that use them. */
const customStores = new Map<MetaStore, number>();
/** `undefined` until the first `setMetaCacheIdentity` call; `null` = anonymous. */
let identity: string | null | undefined;
const resetListeners = new Set<() => void>();

/**
 * Get or create the cache entry for `url`. First caller's `factory` (and
 * `options.metaKey`) seeds the `Client`; subsequent callers reuse it. On
 * `meta` rejection, the entry is evicted so the next call retries. A hit
 * marks the URL most recently used; hold an entry you keep using with
 * {@link retainMetaEntry}. Without a browser `window` nothing is cached and
 * the client is asked for `metaStore: false`.
 */
export function getMetaEntry(
  url: string,
  factory?: ClientFactory,
  options?: MetaEntryOptions,
): MetaCacheEntry {
  const browser = typeof window !== "undefined";
  const existing = browser ? cache.get(url) : undefined;
  if (existing) {
    touch(url, existing);
    return existing;
  }

  const f = factory ?? getDefaultClientFactory();
  let client: Client;
  if (!browser) client = f(url, { metaStore: false });
  else if (options?.metaKey) client = f(url, { metaKey: options.metaKey });
  else client = f(url);

  const meta = (client.meta() as Promise<MetaResponse>).catch((err) => {
    // A reset may have replaced the entry while this request was in flight.
    if (cache.get(url) === entry) evict(url, entry);
    throw err;
  });
  const derived = meta.then((m) => derive(entry, client, m));
  const type = derived.then((d) => d.type);
  // `meta` carries the failure to callers; don't also report the derived chain as unhandled.
  type.catch(() => {});

  const entry: MetaCacheEntry = { client, meta, type };
  const slot: Slot = { url, derived, holds: 0 };
  slots.set(entry, slot);
  if (browser) {
    slot.store = customStoreOf(client);
    if (slot.store) customStores.set(slot.store, (customStores.get(slot.store) ?? 0) + 1);
    cache.set(url, entry);
    trim(entry);
  }
  return entry;
}

/**
 * Keep `entry` in the cache while it is in use: a held entry is never
 * evicted by the size limit ({@link setMetaCacheMaxEntries}), so later
 * `getMetaEntry` / `resolveValueHelp` calls for its URL keep returning it.
 * Call the returned function (idempotent) once done — `useTable` and the
 * form value-help do this for their component's lifetime. A reset still
 * drops held entries. Since 0.1.154.
 */
export function retainMetaEntry(entry: MetaCacheEntry): () => void {
  const slot = slots.get(entry);
  if (!slot) return () => {};
  slot.holds++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    slot.holds--;
    // In use until now: most recently used.
    if (slot.holds === 0 && cache.get(slot.url) === entry) {
      touch(slot.url, entry);
      trim();
    }
  };
}

/**
 * How many URLs the meta cache keeps (default `100`). Least recently used
 * entries beyond it are dropped — entries held with {@link retainMetaEntry}
 * (every mounted table and form value-help) never are, and may exceed it.
 * At least `1`; `Infinity` turns the limit off; no argument restores the
 * default. Since 0.1.154.
 */
export function setMetaCacheMaxEntries(max?: number): void {
  maxEntries = max === undefined ? DEFAULT_MAX_ENTRIES : max >= 1 ? max : 1;
  trim();
}

function touch(url: string, entry: MetaCacheEntry): void {
  cache.delete(url);
  cache.set(url, entry);
}

/**
 * Drop least recently used entries nothing holds until the cache fits.
 * `spare` — the entry just handed out, about to be retained by its caller.
 */
function trim(spare?: MetaCacheEntry): void {
  if (cache.size <= maxEntries) return;
  for (const [url, entry] of cache) {
    if (entry !== spare && slots.get(entry)!.holds === 0) evict(url, entry);
    if (cache.size <= maxEntries) return;
  }
}

/**
 * Remove `entry` and release what only it kept: its shared `Derived` and
 * custom store. A reset no longer reaches its client, so the client's memoized
 * `/meta` goes now — a factory that reuses clients per URL would otherwise
 * hand it to the next viewer.
 */
function evict(url: string, entry: MetaCacheEntry): void {
  cache.delete(url);
  // Optional call: custom `ClientFactory` doubles often stub only `meta()`.
  entry.client.invalidateMeta?.();
  // Only a cached entry gets here, and a reset clears the counts with the cache.
  const slot = slots.get(entry)!;
  if (slot.etag !== undefined && --derivedByEtag.get(slot.etag)!.refs === 0) {
    derivedByEtag.delete(slot.etag);
  }
  if (slot.store) {
    const refs = customStores.get(slot.store)!;
    if (refs > 1) customStores.set(slot.store, refs - 1);
    else {
      // No cached client uses it any more: nothing would clear it on a reset.
      slot.store.clear();
      customStores.delete(slot.store);
    }
  }
}

/**
 * The `TableDef` for a cache entry, built once per entry — and once per
 * `/meta` `ETag` across entries. Since 0.1.153.
 */
export function getMetaTableDef(entry: MetaCacheEntry): Promise<TableDef> {
  if (!entry.tableDef) {
    const derived = slots.get(entry)?.derived;
    entry.tableDef = derived
      ? Promise.all([entry.meta, derived]).then(
          ([meta, d]) => (d.tableDef ??= createTableDef(meta, d.type)),
        )
      : Promise.all([entry.meta, entry.type]).then(([meta, type]) => createTableDef(meta, type));
  }
  return entry.tableDef;
}

/**
 * Shares the `Derived` of one `ETag` among the cached entries that loaded it;
 * an entry no longer cached (evicted, reset, server render) keeps its own.
 */
function derive(entry: MetaCacheEntry, client: Client, meta: MetaResponse): Derived {
  const slot = slots.get(entry)!;
  // Optional call: custom `ClientFactory` doubles often stub only `meta()`.
  const etag = cache.get(slot.url) === entry ? client.metaEtag?.() : undefined;
  if (etag === undefined) return { type: deserializeAnnotatedType(meta.type) };
  let shared = derivedByEtag.get(etag);
  if (shared) shared.refs++;
  else {
    shared = { derived: { type: deserializeAnnotatedType(meta.type) }, refs: 1 };
    derivedByEtag.set(etag, shared);
  }
  slot.etag = etag;
  return shared.derived;
}

/**
 * The custom `/meta` store a factory gave `client`, so a reset (and the
 * eviction of its last cached client) can clear it. The shared
 * `defaultMetaStore` is skipped: a reset clears it through
 * `clearMetaStore()`, and an eviction must not drop the ETags of every
 * other URL. A store-less client (`metaStore: false`) is skipped too.
 */
function customStoreOf(client: Client): MetaStore | undefined {
  // Optional by nature: custom `ClientFactory` doubles often stub only `meta()`.
  const store = client.metaStore;
  return store && store !== defaultMetaStore ? store : undefined;
}

/**
 * Drop every cached `/meta` — including the copy each cached `Client`
 * memoizes and the `@atscript/db-client` meta stores used to revalidate it
 * (the shared default one and any custom one a factory supplied) — the
 * value-help searches shared under them, and everything registered through
 * {@link onMetaCacheReset} (e.g. the table-presets cache). Entries already
 * handed out keep working; the next `getMetaEntry` refetches.
 */
export function resetMetaCache(): void {
  const entries = [...cache.values()];
  cache.clear();
  derivedByEtag.clear();
  // Optional call: custom `ClientFactory` doubles often stub only `meta()`.
  for (const entry of entries) entry.client.invalidateMeta?.();
  clearMetaStore();
  for (const store of customStores.keys()) store.clear();
  customStores.clear();
  // Shared value-help search results belong to the same session.
  invalidateValueHelpCache();
  for (const listener of resetListeners) listener();
}

/**
 * Bind the meta cache to the current viewer. Call it whenever the signed-in
 * user or their role may have changed — after login, after logout and on
 * every reload of the current user. A key that differs from the previous
 * one resets the cache (`resetMetaCache`); the same key keeps it. `null` /
 * `undefined` = anonymous.
 *
 * Binding an identity also turns on caches that are only safe when the app
 * reports sign-in changes, such as the table-presets cache.
 */
export function setMetaCacheIdentity(key: string | null | undefined): void {
  const next = key ?? null;
  if (next === identity) return;
  identity = next;
  resetMetaCache();
}

/**
 * The identity last passed to {@link setMetaCacheIdentity}: `undefined` when
 * the app never bound one, `null` for anonymous. Since 0.1.153.
 */
export function getMetaCacheIdentity(): string | null | undefined {
  return identity;
}

/**
 * Run `listener` on every {@link resetMetaCache} (and so on every identity
 * change). For caches that belong to the signed-in viewer. Returns an
 * unsubscribe function. Since 0.1.153.
 */
export function onMetaCacheReset(listener: () => void): () => void {
  resetListeners.add(listener);
  return () => {
    resetListeners.delete(listener);
  };
}
