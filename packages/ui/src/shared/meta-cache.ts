import type { Client } from "@atscript/db-client";
import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { deserializeAnnotatedType } from "@atscript/typescript/utils";
import { getDefaultClientFactory, type ClientFactory } from "../client-factory";
import type { MetaResponse, TableDef } from "../table/types";
import type { ResolvedValueHelp } from "../value-help/resolve";

/**
 * Shared per-URL cache. A single entry holds the `Client` instance, the raw
 * `/meta` promise, the deserialized type, and lazily-populated derived shapes
 * (`ResolvedValueHelp` for value-help, `TableDef` for tables). Both
 * `resolveValueHelp` and `useTable` route through it so a given URL triggers
 * at most one network round-trip and one `deserializeAnnotatedType`.
 */
export interface MetaCacheEntry {
  client: Client;
  meta: Promise<MetaResponse>;
  type: Promise<TAtscriptAnnotatedType>;
  resolved?: Promise<ResolvedValueHelp>;
  tableDef?: Promise<TableDef>;
}

const cache = new Map<string, MetaCacheEntry>();

/**
 * Get or create the cache entry for `url`. First caller's `factory` seeds the
 * `Client`; subsequent callers reuse it. On `meta` rejection, the entry is
 * evicted so the next call retries.
 */
export function getMetaEntry(url: string, factory?: ClientFactory): MetaCacheEntry {
  const existing = cache.get(url);
  if (existing) return existing;

  const f = factory ?? getDefaultClientFactory();
  const client = f(url);

  const meta = (client.meta() as Promise<MetaResponse>).catch((err) => {
    cache.delete(url);
    throw err;
  });
  const type = meta.then((m) => deserializeAnnotatedType(m.type));

  const entry: MetaCacheEntry = { client, meta, type };
  cache.set(url, entry);
  return entry;
}

export function resetMetaCache(): void {
  cache.clear();
}
