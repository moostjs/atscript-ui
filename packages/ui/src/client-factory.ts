import { Client, type AtscriptClientShape, type ClientOptions } from "@atscript/db-client";

/**
 * Client options the library itself may ask a {@link ClientFactory} for —
 * spread them into the `Client` options your factory builds:
 *
 * ```ts
 * setDefaultClientFactory((url, opts) => new Client(url, { ...opts, fetch: myFetch }))
 * ```
 *
 * - `metaKey` — the store key for `/meta` revalidation, set when a table is
 *   given `metaKey` (e.g. the route template of a parametric mount). Since 0.1.153.
 * - `metaStore` — `false` during server rendering, so `/meta` bodies are never
 *   kept in a process-wide store shared by every viewer. Since 0.1.153.
 * - `locale` — the UI locale the client is for (`provideAsLocale` /
 *   `setUiLocale`), sent as `Accept-Language`: `/meta`, its action forms and
 *   error bodies come back in it. Set only when the app has a locale. Since 0.1.165.
 */
export type ClientFactoryOptions = Pick<ClientOptions, "metaKey" | "metaStore"> & {
  locale?: string;
};

/**
 * Factory that creates a `Client` for a given URL.
 *
 * Single contract shared by every atscript-ui primitive that needs to talk
 * to an atscript-db-compatible endpoint: table composables, FK value-help,
 * and any future consumer. Produces a `Client` configured with whatever
 * transport / auth wiring the host application wants. Forward the optional
 * second argument ({@link ClientFactoryOptions}) into the `Client` options.
 *
 * Any function returning a `Client` fits — one that builds a new client or
 * one that hands back a cached one.
 */
export type ClientFactory = (url: string, options?: ClientFactoryOptions) => Client;

/**
 * The app-wide factory as {@link getDefaultClientFactory} returns it: generic
 * like `Client`. `factory<typeof Product>(url)` is a `Client<typeof Product>`
 * with typed reads and writes; without a type argument it is the untyped
 * `Client`. The type argument only types the client — nothing is checked at
 * runtime.
 */
export type TypedClientFactory = <T extends AtscriptClientShape = AtscriptClientShape>(
  url: string,
  options?: ClientFactoryOptions,
) => Client<T>;

const builtin: ClientFactory = (url, options) => new Client(url, options);

let _default: ClientFactory = builtin;

/**
 * Override the app-wide default factory. Call once at startup (e.g. in
 * `entry-client.ts`) to wire shared fetch, credentials, error handling, etc.
 * Every table, value-help picker, and other client consumer will pick it up.
 */
export function setDefaultClientFactory(factory: ClientFactory): void {
  _default = factory;
}

/**
 * Current app-wide default factory. Falls back to `new Client(url, options)`.
 * Pass the model to get a typed client: `getDefaultClientFactory()<typeof Product>(url)`.
 */
export function getDefaultClientFactory(): TypedClientFactory {
  // `Client`'s type argument is compile-time only: the same instance serves any `T`.
  return _default as TypedClientFactory;
}

/** Reset the default factory to the built-in one (primarily for tests). */
export function resetDefaultClientFactory(): void {
  _default = builtin;
}
