import { Client } from "@atscript/db-client";

/**
 * Factory that creates a `Client` for a given URL.
 *
 * Single contract shared by every atscript-ui primitive that needs to talk
 * to an atscript-db-compatible endpoint: table composables, FK value-help,
 * and any future consumer. Produces a `Client` configured with whatever
 * transport / auth wiring the host application wants.
 */
export type ClientFactory = (url: string) => Client;

const builtin: ClientFactory = (url) => new Client(url);

let _default: ClientFactory = builtin;

/**
 * Override the app-wide default factory. Call once at startup (e.g. in
 * `entry-client.ts`) to wire shared fetch, credentials, error handling, etc.
 * Every table, value-help picker, and other client consumer will pick it up.
 */
export function setDefaultClientFactory(factory: ClientFactory): void {
  _default = factory;
}

/** Current app-wide default factory. Falls back to `new Client(url)`. */
export function getDefaultClientFactory(): ClientFactory {
  return _default;
}

/** Reset the default factory to the built-in one (primarily for tests). */
export function resetDefaultClientFactory(): void {
  _default = builtin;
}
