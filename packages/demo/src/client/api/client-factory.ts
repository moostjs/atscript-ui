import { Client } from "@atscript/db-client";
import { sharedFetch } from "./fetch";

const cache = new Map<string, Client<unknown>>();

export function clientForTable<T = unknown>(path: string): Client<T> {
  const key = path.replace(/^\/+|\/+$/g, "");
  let c = cache.get(key);
  if (!c) {
    c = new Client(`/api/db/tables/${key}`, { fetch: sharedFetch }) as Client<unknown>;
    cache.set(key, c);
  }
  return c as Client<T>;
}

export function valueHelpFactory(url: string): Client<unknown> {
  const m = url.match(/\/api\/db\/tables\/([^/?#]+)/);
  if (m) return clientForTable(m[1]);
  return new Client(url, { fetch: sharedFetch });
}
