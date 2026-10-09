import { Client, type ClientOptions } from "@atscript/db-client";

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
 */
export type ClientFactoryOptions = Pick<ClientOptions, "metaKey" | "metaStore">;

/**
 * Factory that creates a `Client` for a given URL.
 *
 * Single contract shared by every atscript-ui primitive that needs to talk
 * to an atscript-db-compatible endpoint: table composables, FK value-help,
 * and any future consumer. Produces a `Client` configured with whatever
 * transport / auth wiring the host application wants. Forward the optional
 * second argument ({@link ClientFactoryOptions}) into the `Client` options.
 */
export type ClientFactory = (url: string, options?: ClientFactoryOptions) => Client;

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

/** Current app-wide default factory. Falls back to `new Client(url, options)`. */
export function getDefaultClientFactory(): ClientFactory {
  return _default;
}

/** Reset the default factory to the built-in one (primarily for tests). */
export function resetDefaultClientFactory(): void {
  _default = builtin;
}
