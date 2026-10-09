import type { Client } from "@atscript/db-client";
import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { deserializeAnnotatedType } from "@atscript/typescript/utils";
import { getDefaultClientFactory, type ClientFactory } from "../client-factory";
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
 * `/meta` is projected per viewer, so the cache belongs to one identity
 * (`setMetaCacheIdentity`) and exists only in the browser: during server
 * rendering one process serves many viewers, so every call builds a fresh,
 * uncached entry.
 */
export interface MetaCacheEntry {
  client: Client;
  meta: Promise<MetaResponse>;
  type: Promise<TAtscriptAnnotatedType>;
  resolved?: Promise<ResolvedValueHelp>;
  tableDef?: Promise<TableDef>;
}

const cache = new Map<string, MetaCacheEntry>();
/** `undefined` until the first `setMetaCacheIdentity` call; `null` = anonymous. */
let identity: string | null | undefined;

/**
 * Get or create the cache entry for `url`. First caller's `factory` seeds the
 * `Client`; subsequent callers reuse it. On `meta` rejection, the entry is
 * evicted so the next call retries. Without a browser `window` nothing is
 * cached.
 */
export function getMetaEntry(url: string, factory?: ClientFactory): MetaCacheEntry {
  const browser = typeof window !== "undefined";
  const existing = browser ? cache.get(url) : undefined;
  if (existing) return existing;

  const f = factory ?? getDefaultClientFactory();
  const client = f(url);

  const meta = (client.meta() as Promise<MetaResponse>).catch((err) => {
    // A reset may have replaced the entry while this request was in flight.
    if (cache.get(url) === entry) cache.delete(url);
    throw err;
  });
  const type = meta.then((m) => deserializeAnnotatedType(m.type));

  const entry: MetaCacheEntry = { client, meta, type };
  if (browser) cache.set(url, entry);
  return entry;
}

/**
 * Drop every cached `/meta` — including the copy each cached `Client`
 * memoizes — and the value-help searches shared under them. Entries already
 * handed out keep working; the next `getMetaEntry` refetches.
 */
export function resetMetaCache(): void {
  const entries = [...cache.values()];
  cache.clear();
  // Optional call: custom `ClientFactory` doubles often stub only `meta()`.
  for (const entry of entries) entry.client.invalidateMeta?.();
  // Shared value-help search results belong to the same session.
  invalidateValueHelpCache();
}

/**
 * Bind the meta cache to the current viewer. Call it whenever the signed-in
 * user or their role may have changed — after login, after logout and on
 * every reload of the current user. A key that differs from the previous
 * one resets the cache (`resetMetaCache`); the same key keeps it. `null` /
 * `undefined` = anonymous.
 */
export function setMetaCacheIdentity(key: string | null | undefined): void {
  const next = key ?? null;
  if (next === identity) return;
  identity = next;
  resetMetaCache();
}
