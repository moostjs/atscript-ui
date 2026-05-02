import { Client, type AtscriptClientShape } from "@atscript/db-client";
import type { ClientFactory } from "@atscript/ui";
import { sharedFetch } from "./fetch";

const cache = new Map<string, Client>();

/**
 * Router-aware `processor: 'navigate'` handler. Registered by
 * `entry-client.ts` after the Vue Router is created so `Client.action()`
 * dispatches navigations through `router.push()` (SPA mode) instead of
 * the default `location.assign(url)` (full page reload). Falls back to the
 * Client's default browser-navigation path when unset (SSR / no router).
 */
let routerNavigate: ((url: string) => void | Promise<void>) | undefined;

export function setRouterNavigate(fn: (url: string) => void | Promise<void>) {
  routerNavigate = fn;
}

/**
 * App-wide `ClientFactory` for this demo. Every `Client` is configured with
 * `sharedFetch` so session cookies, 401 → login redirect, 500 → retry toast,
 * etc. apply uniformly. Registered via `setDefaultClientFactory` at startup.
 *
 * `navigate` is a thin closure over the module-level `routerNavigate` so
 * the same Client instance can be created before the router exists (SSR,
 * tests) and still gain SPA-mode navigation once `setRouterNavigate` is
 * called. External URLs (`http(s)://`) bypass the router and fall through
 * to a full-page navigation — vue-router rejects non-route paths.
 */
export const clientFactory: ClientFactory = (url) => {
  const key = url.replace(/^\/+|\/+$/g, "");
  let c = cache.get(key);
  if (!c) {
    c = new Client(url, {
      fetch: sharedFetch,
      navigate: async (target) => {
        if (routerNavigate && !/^https?:\/\//i.test(target)) {
          await routerNavigate(target);
          return;
        }
        const loc = (globalThis as { location?: { assign?: (u: string) => void } }).location;
        loc?.assign?.(target);
      },
    });
    cache.set(key, c);
  }
  return c;
};

/** Demo-internal helper for call sites that only know the table name. */
export function clientForTable<T extends AtscriptClientShape = AtscriptClientShape>(
  path: string,
): Client<T> {
  const key = path.replace(/^\/+|\/+$/g, "");
  return clientFactory(`/api/db/tables/${key}`) as Client<T>;
}
