import { clearMetaStore, type Client } from "@atscript/db-client";
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

interface ClearableStore {
  clear: () => void;
}

const cache = new Map<string, MetaCacheEntry>();
/** Derived shapes per `ETag`, least recently used first. Browser only. */
const derivedByEtag = new Map<string, Derived>();
const MAX_DERIVED = 50;
/** The `Derived` promise behind each handed-out entry (kept off the public shape). */
const derivedOf = new WeakMap<MetaCacheEntry, Promise<Derived>>();
/** Custom `/meta` stores of clients this cache created in the browser. */
const customStores = new Set<ClearableStore>();
/** `undefined` until the first `setMetaCacheIdentity` call; `null` = anonymous. */
let identity: string | null | undefined;
const resetListeners = new Set<() => void>();

/**
 * Get or create the cache entry for `url`. First caller's `factory` (and
 * `options.metaKey`) seeds the `Client`; subsequent callers reuse it. On
 * `meta` rejection, the entry is evicted so the next call retries. Without a
 * browser `window` nothing is cached and the client is asked for
 * `metaStore: false`.
 */
export function getMetaEntry(
  url: string,
  factory?: ClientFactory,
  options?: MetaEntryOptions,
): MetaCacheEntry {
  const browser = typeof window !== "undefined";
  const existing = browser ? cache.get(url) : undefined;
  if (existing) return existing;

  const f = factory ?? getDefaultClientFactory();
  let client: Client;
  if (!browser) client = f(url, { metaStore: false });
  else if (options?.metaKey) client = f(url, { metaKey: options.metaKey });
  else client = f(url);
  if (browser) rememberStore(client);

  const meta = (client.meta() as Promise<MetaResponse>).catch((err) => {
    // A reset may have replaced the entry while this request was in flight.
    if (cache.get(url) === entry) cache.delete(url);
    throw err;
  });
  const derived = meta.then((m) => derive(client, m, browser));
  const type = derived.then((d) => d.type);
  // `meta` carries the failure to callers; don't also report the derived chain as unhandled.
  type.catch(() => {});

  const entry: MetaCacheEntry = { client, meta, type };
  derivedOf.set(entry, derived);
  if (browser) cache.set(url, entry);
  return entry;
}

/**
 * The `TableDef` for a cache entry, built once per entry — and once per
 * `/meta` `ETag` across entries. Since 0.1.153.
 */
export function getMetaTableDef(entry: MetaCacheEntry): Promise<TableDef> {
  if (!entry.tableDef) {
    const derived = derivedOf.get(entry);
    entry.tableDef = derived
      ? Promise.all([entry.meta, derived]).then(
          ([meta, d]) => (d.tableDef ??= createTableDef(meta, d.type)),
        )
      : Promise.all([entry.meta, entry.type]).then(([meta, type]) => createTableDef(meta, type));
  }
  return entry.tableDef;
}

function derive(client: Client, meta: MetaResponse, browser: boolean): Derived {
  // Optional call: custom `ClientFactory` doubles often stub only `meta()`.
  const etag = browser ? client.metaEtag?.() : undefined;
  if (etag === undefined) return { type: deserializeAnnotatedType(meta.type) };
  const hit = derivedByEtag.get(etag);
  if (hit) {
    derivedByEtag.delete(etag);
    derivedByEtag.set(etag, hit);
    return hit;
  }
  const fresh: Derived = { type: deserializeAnnotatedType(meta.type) };
  derivedByEtag.set(etag, fresh);
  if (derivedByEtag.size > MAX_DERIVED) {
    derivedByEtag.delete(derivedByEtag.keys().next().value!);
  }
  return fresh;
}

/**
 * Remember a custom `/meta` store a factory gave `client`, so a reset can
 * clear it. The store is a private field of `Client`, read defensively: the
 * default store is cleared through `clearMetaStore()`, and a store-less
 * client or a test double is skipped.
 */
function rememberStore(client: Client): void {
  const store = (client as unknown as { _metaStore?: Partial<ClearableStore> })._metaStore;
  if (typeof store?.clear === "function") customStores.add(store as ClearableStore);
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
  for (const store of customStores) store.clear();
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
