import { Client } from "@atscript/db-client";
import type { ClientFactory } from "@atscript/ui";
import { sharedFetch } from "./fetch";

const cache = new Map<string, Client>();

/**
 * App-wide `ClientFactory` for this demo. Every `Client` is configured with
 * `sharedFetch` so session cookies, 401 → login redirect, 500 → retry toast,
 * etc. apply uniformly. Registered via `setDefaultClientFactory` at startup.
 */
export const clientFactory: ClientFactory = (url) => {
  const key = url.replace(/^\/+|\/+$/g, "");
  let c = cache.get(key);
  if (!c) {
    c = new Client(url, { fetch: sharedFetch });
    cache.set(key, c);
  }
  return c;
};

/** Demo-internal helper for call sites that only know the table name. */
export function clientForTable<T = Record<string, unknown>>(path: string): Client<T> {
  const key = path.replace(/^\/+|\/+$/g, "");
  return clientFactory(`/api/db/tables/${key}`) as Client<T>;
}
