import type { Client } from "@atscript/db-client";
import {
  getDefaultClientFactory,
  getMetaCacheIdentity,
  onMetaCacheReset,
  type ClientFactory,
} from "@atscript/ui";

import type { AsPresetEntryRow, PresetCapabilities } from "./preset-data-types";
import type { PresetsListResult } from "./presets-client";

// ── Session cache for table presets ─────────────────────────────────────────
//
// Shared by every presets consumer in the page, keyed by
// `(presets url, app, tableKey)`:
// - capabilities: fetched once per key for the session;
// - preset + userConf rows: served from the cache on the next mount, and
//   revalidated in the background once they are older than the max age;
// - one db `Client` per presets URL, so writes validate against one
//   `_presets/meta` instead of one per mount.
//
// Rows and capabilities belong to the signed-in viewer, so the cache is
// active only in the browser and only after the app has bound the viewer
// with `setMetaCacheIdentity()` — the identity change (or `resetMetaCache()`)
// drops it. Failures are never cached.
//
// The cache keeps the `MAX_ENTRIES` most recently used scopes; a scope a
// mounted table is subscribed to is never dropped.

/** Preset rows for one `(url, app, tableKey)`. */
export interface PresetRows {
  presets: AsPresetEntryRow[];
  userConf: AsPresetEntryRow | null;
}

/** A mounted presets consumer, notified when the shared entry changes. */
export interface PresetsCacheListener {
  /** Another consumer committed fresher rows (a write, a revalidation). */
  onRows(rows: PresetRows): void;
  /** Another consumer loaded the capabilities. */
  onCapabilities(caps: PresetCapabilities): void;
  /**
   * The cached data went stale (a write in another tab) — refetch in the
   * background; `full` also refetches capabilities (the server-reported
   * user changed).
   */
  refresh(full: boolean): void;
}

interface Entry {
  rows?: PresetRows;
  /** `Date.now()` when `rows` was committed. */
  rowsAt: number;
  rowsInflight?: Promise<PresetsListResult>;
  /** Sequence of the last started / committed rows fetch — an older fetch never overwrites a newer one. */
  started: number;
  committed: number;
  caps?: PresetCapabilities;
  capsInflight?: Promise<PresetCapabilities>;
}

const DEFAULT_MAX_AGE = 30_000;
let maxAge = DEFAULT_MAX_AGE;
/**
 * Scopes kept, as many as the meta cache keeps URLs: one per table a session
 * visits, so only parametric `tableKey`s reach it. An entry is a few rows
 * and is refetched in one request, so this is not worth a public setting.
 */
const MAX_ENTRIES = 100;
/** Least recently used first. */
let entries = new Map<string, Entry>();
let clients = new Map<ClientFactory, Map<string, Client>>();
const listeners = new Map<string, Set<PresetsCacheListener>>();
let wired = false;
let lastMismatch: string | undefined;
let channel: BroadcastChannel | null = null;

interface ChannelMessage {
  type: "write";
  identity: string | null;
  key: string;
}

/**
 * How long (ms) cached preset rows are served on mount without a background
 * revalidation. Default `30000`. `0` revalidates in the background on every
 * mount; a negative value turns the presets cache off. Capabilities are
 * cached for the session either way (while the cache is on). Since 0.1.153.
 */
export function setPresetsCacheMaxAge(ms: number): void {
  maxAge = ms;
}

/**
 * Whether the shared presets cache is in use: in the browser, once the app
 * has called `setMetaCacheIdentity()`, and not turned off with
 * {@link setPresetsCacheMaxAge}. Since 0.1.153.
 */
export function isPresetsCacheActive(): boolean {
  return typeof window !== "undefined" && maxAge >= 0 && getMetaCacheIdentity() !== undefined;
}

/** Cache key for one presets scope. Since 0.1.153. */
export function presetsCacheKey(url: string, app: string, tableKey: string): string {
  return `${url.replace(/\/+$/, "")}|${app}|${tableKey}`;
}

/**
 * Drop every cached preset row, capability and shared client. Runs on every
 * `resetMetaCache()` / identity change; call it yourself after changing
 * presets outside the presets API (e.g. a server-side import). Mounted
 * tables keep what they show until they next load. Since 0.1.153.
 */
export function invalidatePresetsCache(): void {
  entries = new Map();
  // A factory that reuses `Client`s per URL would hand the next viewer the
  // `_presets/meta` this one loaded. Optional call: test doubles stub little.
  for (const byUrl of clients.values()) for (const c of byUrl.values()) c.invalidateMeta?.();
  clients = new Map();
}

function wire(): void {
  if (wired) return;
  wired = true;
  onMetaCacheReset(invalidatePresetsCache);
  if (typeof BroadcastChannel !== "function") return;
  try {
    channel = new BroadcastChannel("as-presets");
  } catch {
    return;
  }
  // Node (SSR, tests) keeps a process alive while a channel is open.
  (channel as { unref?: () => void }).unref?.();
  // The channel does not echo messages back to the sender.
  channel.addEventListener("message", (e: MessageEvent) => {
    const msg = e.data as ChannelMessage | null;
    if (!msg || msg.type !== "write" || typeof msg.key !== "string") return;
    if (!isPresetsCacheActive() || msg.identity !== getMetaCacheIdentity()) return;
    const entry = entries.get(msg.key);
    if (entry) {
      // The next mount loads fresh rows (never joining a fetch started before
      // the write); mounted tables refresh in the background.
      entry.rows = undefined;
      entry.rowsInflight = undefined;
      entry.started++;
      entry.committed = entry.started;
    }
    const first = listeners.get(msg.key)?.values().next().value;
    first?.refresh(false);
  });
}

function entryFor(key: string): Entry {
  wire();
  let entry = lookup(key);
  if (!entry) {
    entry = { rowsAt: 0, started: 0, committed: 0 };
    entries.set(key, entry);
    trim();
  }
  return entry;
}

/** The entry for `key`, marked most recently used. */
function lookup(key: string): Entry | undefined {
  const entry = entries.get(key);
  if (entry) {
    entries.delete(key);
    entries.set(key, entry);
  }
  return entry;
}

/**
 * Whether `entry` is still the cached one for `key`. A fetch that settles
 * after its entry was dropped (reset, identity change, size limit) answers
 * its caller only: it never commits, nor reaches the scope's listeners.
 */
function isCurrent(key: string, entry: Entry): boolean {
  return entries.get(key) === entry;
}

/** Drop least recently used scopes no mounted table is subscribed to. */
function trim(): void {
  if (entries.size <= MAX_ENTRIES) return;
  for (const key of entries.keys()) {
    if (!listeners.has(key)) entries.delete(key);
    if (entries.size <= MAX_ENTRIES) return;
  }
}

/**
 * The shared db `Client` for a presets URL (one per URL and factory). Since 0.1.153.
 */
export function sharedPresetsClient(url: string, factory?: ClientFactory): Client {
  wire();
  const f = factory ?? getDefaultClientFactory();
  let byUrl = clients.get(f);
  if (!byUrl) {
    byUrl = new Map();
    clients.set(f, byUrl);
  }
  let client = byUrl.get(url);
  if (!client) {
    client = f(url);
    byUrl.set(url, client);
  }
  return client;
}

/**
 * Cached rows for `key`, with whether they are still within the max age.
 * Since 0.1.153.
 */
export function cachedPresetRows(key: string): { rows: PresetRows; fresh: boolean } | undefined {
  const entry = lookup(key);
  if (!entry?.rows) return undefined;
  return { rows: entry.rows, fresh: Date.now() - entry.rowsAt < maxAge };
}

/** Cached capabilities for `key`. Since 0.1.153. */
export function cachedPresetCapabilities(key: string): PresetCapabilities | undefined {
  return lookup(key)?.caps;
}

/**
 * Load preset rows through the cache. Joins a fetch already in flight unless
 * `force` (a write or a revalidation must see the server's latest). A
 * successful, non-denied result is committed and handed to every other
 * listener of `key` (not to `origin`, which gets it as the return value).
 * A fetch that settles after a newer one committed resolves to the newer
 * rows. Denied results drop the cached rows; errors are never cached.
 * Since 0.1.153.
 */
export function loadPresetRows(
  key: string,
  fetchRows: () => Promise<PresetsListResult>,
  opts: { force?: boolean; origin?: PresetsCacheListener } = {},
): Promise<PresetsListResult> {
  const entry = entryFor(key);
  if (!opts.force && entry.rowsInflight) return entry.rowsInflight;
  const token = ++entry.started;
  const p = fetchRows().then(
    (result) => {
      if (entry.rowsInflight === p) entry.rowsInflight = undefined;
      if (!isCurrent(key, entry)) return result;
      // A newer fetch already committed: hand the caller its rows, not this
      // older answer, so a late revalidation never rolls a consumer back.
      if (token <= entry.committed)
        return entry.rows ? { ...result, ...entry.rows, denied: false } : result;
      entry.committed = token;
      if (result.denied) {
        entry.rows = undefined;
        return result;
      }
      const rows: PresetRows = { presets: result.presets, userConf: result.userConf };
      entry.rows = rows;
      entry.rowsAt = Date.now();
      if (!checkSession(entry)) {
        for (const l of listenersOf(key)) if (l !== opts.origin) l.onRows(rows);
      }
      return result;
    },
    (err: unknown) => {
      if (entry.rowsInflight === p) entry.rowsInflight = undefined;
      throw err;
    },
  );
  entry.rowsInflight = p;
  return p;
}

/**
 * Load the capabilities through the cache: once per key for the session,
 * joined while in flight. A success is committed and handed to every other
 * listener; a failure is not cached and rejects. Since 0.1.153.
 */
export function loadPresetCapabilities(
  key: string,
  fetchCaps: () => Promise<PresetCapabilities>,
  origin?: PresetsCacheListener,
): Promise<PresetCapabilities> {
  const entry = entryFor(key);
  if (entry.caps) return Promise.resolve(entry.caps);
  if (entry.capsInflight) return entry.capsInflight;
  const p = fetchCaps().then(
    (caps) => {
      if (entry.capsInflight === p) entry.capsInflight = undefined;
      if (!isCurrent(key, entry)) return caps;
      entry.caps = caps;
      if (!checkSession(entry)) {
        for (const l of listenersOf(key)) if (l !== origin) l.onCapabilities(caps);
      }
      return caps;
    },
    (err: unknown) => {
      if (entry.capsInflight === p) entry.capsInflight = undefined;
      throw err;
    },
  );
  entry.capsInflight = p;
  return p;
}

/**
 * Tell other tabs (same viewer) that this scope's presets changed. Call it
 * after a successful write. Since 0.1.153.
 */
export function publishPresetsWrite(key: string): void {
  if (!isPresetsCacheActive()) return;
  wire();
  try {
    channel?.postMessage({
      type: "write",
      identity: getMetaCacheIdentity() ?? null,
      key,
    } satisfies ChannelMessage);
  } catch {
    /* closed channel */
  }
}

/**
 * Subscribe a mounted consumer to the shared entry for `key`. Returns the
 * unsubscribe function. Since 0.1.153.
 */
export function subscribePresetsCache(key: string, listener: PresetsCacheListener): () => void {
  wire();
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0 && listeners.get(key) === set) {
      listeners.delete(key);
      // In use until now: most recently used, and evictable again.
      lookup(key);
      trim();
    }
  };
}

function listenersOf(key: string): PresetsCacheListener[] {
  return [...(listeners.get(key) ?? [])];
}

/**
 * The rows' owner must be the user the capabilities name. A mismatch means
 * the session changed without `setMetaCacheIdentity()`: drop everything and
 * have every mounted consumer reload rows and capabilities. Returns `true`
 * on a mismatch.
 */
function checkSession(entry: Entry): boolean {
  const caps = entry.caps;
  const rows = entry.rows;
  if (!caps || !rows || typeof caps.userId !== "string") return false;
  const owner = rowsOwner(rows);
  if (owner === undefined || owner === caps.userId) return false;
  // A server whose row owner and `userId` simply differ in format would
  // mismatch on every load: react to each distinct pair once.
  const pair = `${owner}\u0000${caps.userId}`;
  if (pair === lastMismatch) return false;
  lastMismatch = pair;
  invalidatePresetsCache();
  for (const set of listeners.values()) for (const l of set) l.refresh(true);
  return true;
}

/** The user owning the private rows (every private row is the viewer's own). */
function rowsOwner(rows: PresetRows): string | undefined {
  const fromConf = rows.userConf?.user;
  if (typeof fromConf === "string" && fromConf.length > 0) return fromConf;
  for (const row of rows.presets) {
    if (row.public !== true && typeof row.user === "string" && row.user.length > 0) {
      return row.user;
    }
  }
  return undefined;
}
