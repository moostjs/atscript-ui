import { resetMetaCache, setMetaCacheIdentity } from "@atscript/ui";
import type { Client } from "@atscript/db-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AsPresetEntryRow, PresetCapabilities } from "./preset-data-types";
import type { PresetsListResult } from "./presets-client";
import {
  cachedPresetCapabilities,
  cachedPresetRows,
  invalidatePresetsCache,
  isPresetsCacheActive,
  loadPresetCapabilities,
  loadPresetRows,
  presetsCacheKey,
  publishPresetsWrite,
  setPresetsCacheMaxAge,
  sharedPresetsClient,
  subscribePresetsCache as subscribe,
  type PresetsCacheListener,
} from "./presets-cache";

const subscriptions: (() => void)[] = [];
function subscribePresetsCache(key: string, l: PresetsCacheListener): () => void {
  const off = subscribe(key, l);
  subscriptions.push(off);
  return off;
}

const KEY = presetsCacheKey("/db/_presets/", "demo", "products");

function row(id: string, user: string, isPublic = false): AsPresetEntryRow {
  return {
    id,
    type: "preset",
    app: "demo",
    tableKey: "products",
    user,
    public: isPublic,
    label: id,
    data: { label: id, content: {} },
    createdAt: 0,
    updatedAt: 0,
  } as AsPresetEntryRow;
}

function list(rows: AsPresetEntryRow[], denied = false): PresetsListResult {
  return { presets: rows, userConf: null, capabilities: undefined, denied };
}

function caps(userId: string): PresetCapabilities {
  return { canPublish: true, presetLimit: 10, userId };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function listener() {
  return {
    onRows: vi.fn<PresetsCacheListener["onRows"]>(),
    onCapabilities: vi.fn<PresetsCacheListener["onCapabilities"]>(),
    refresh: vi.fn<PresetsCacheListener["refresh"]>(),
  };
}

beforeEach(() => {
  vi.stubGlobal("window", {});
  setMetaCacheIdentity("1:alice");
});

afterEach(() => {
  for (const off of subscriptions.splice(0)) off();
  setPresetsCacheMaxAge(30_000);
  resetMetaCache();
  vi.unstubAllGlobals();
});

describe("presets cache — activation", () => {
  it("is active in the browser once an identity is bound", () => {
    expect(isPresetsCacheActive()).toBe(true);
    vi.unstubAllGlobals();
    expect(isPresetsCacheActive()).toBe(false); // server: never
  });

  it("is off with a negative max age", () => {
    setPresetsCacheMaxAge(-1);
    expect(isPresetsCacheActive()).toBe(false);
  });

  it("normalizes the trailing slash of the presets URL in the key", () => {
    expect(KEY).toBe(presetsCacheKey("/db/_presets", "demo", "products"));
    expect(KEY).not.toBe(presetsCacheKey("/db/_presets", "demo", "orders"));
  });
});

describe("presets cache — rows", () => {
  it("joins a fetch in flight, commits it, and serves it as fresh within the max age", async () => {
    const fetch = vi.fn(async () => list([row("p1", "alice")]));
    await Promise.all([loadPresetRows(KEY, fetch), loadPresetRows(KEY, fetch)]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(cachedPresetRows(KEY)).toMatchObject({ fresh: true, rows: { presets: [{ id: "p1" }] } });

    setPresetsCacheMaxAge(0);
    expect(cachedPresetRows(KEY)?.fresh).toBe(false);
  });

  it("keeps scopes apart", async () => {
    await loadPresetRows(KEY, async () => list([row("p1", "alice")]));
    expect(cachedPresetRows(presetsCacheKey("/db/_presets", "demo", "orders"))).toBeUndefined();
    expect(cachedPresetRows(presetsCacheKey("/db/_presets", "other", "products"))).toBeUndefined();
  });

  it("never caches a failure or a denied answer", async () => {
    await expect(
      loadPresetRows(KEY, async () => {
        throw new Error("network");
      }),
    ).rejects.toThrow("network");
    expect(cachedPresetRows(KEY)).toBeUndefined();

    await loadPresetRows(KEY, async () => list([row("p1", "alice")]));
    await loadPresetRows(KEY, async () => list([], true), { force: true });
    expect(cachedPresetRows(KEY)).toBeUndefined();
  });

  it("hands committed rows to every listener but the one that fetched them", async () => {
    const a = listener();
    const b = listener();
    subscribePresetsCache(KEY, a);
    const off = subscribePresetsCache(KEY, b);
    await loadPresetRows(KEY, async () => list([row("p1", "alice")]), { origin: a });
    expect(a.onRows).not.toHaveBeenCalled();
    expect(b.onRows).toHaveBeenCalledWith({
      presets: [expect.objectContaining({ id: "p1" })],
      userConf: null,
    });

    off();
    await loadPresetRows(KEY, async () => list([]), { force: true, origin: a });
    expect(b.onRows).toHaveBeenCalledTimes(1);
  });

  it("an older fetch settling late never overwrites a newer one", async () => {
    const slow = deferred<PresetsListResult>();
    const old = loadPresetRows(KEY, () => slow.promise);
    await loadPresetRows(KEY, async () => list([row("new", "alice")]), { force: true });
    slow.resolve(list([row("old", "alice")]));
    // The caller of the older fetch gets the newer rows too — never a rollback.
    expect((await old).presets.map((r) => r.id)).toEqual(["new"]);
    expect(cachedPresetRows(KEY)?.rows.presets.map((r) => r.id)).toEqual(["new"]);
  });

  it("a fetch in flight across an identity change never fills the new cache", async () => {
    const slow = deferred<PresetsListResult>();
    const pending = loadPresetRows(KEY, () => slow.promise);
    setMetaCacheIdentity("2:bob");
    slow.resolve(list([row("p1", "alice")]));
    await pending;
    expect(cachedPresetRows(KEY)).toBeUndefined();
  });
});

describe("presets cache — capabilities", () => {
  it("loads once for the session and never caches a failure", async () => {
    const fail = vi.fn(async (): Promise<PresetCapabilities> => {
      throw new Error("500");
    });
    await expect(loadPresetCapabilities(KEY, fail)).rejects.toThrow("500");
    expect(cachedPresetCapabilities(KEY)).toBeUndefined();

    const ok = vi.fn(async () => caps("alice"));
    await loadPresetCapabilities(KEY, ok);
    await loadPresetCapabilities(KEY, ok);
    expect(ok).toHaveBeenCalledTimes(1);
    expect(cachedPresetCapabilities(KEY)?.userId).toBe("alice");
  });
});

describe("presets cache — identity scoping", () => {
  it("resetMetaCache / a new identity drop rows, capabilities and shared clients", async () => {
    const invalidateMeta = vi.fn();
    const factory = vi.fn((url: string) => ({ url, invalidateMeta }) as unknown as Client);
    const client = sharedPresetsClient("/db/_presets", factory);
    expect(sharedPresetsClient("/db/_presets", factory)).toBe(client);
    await loadPresetRows(KEY, async () => list([row("p1", "alice")]));
    await loadPresetCapabilities(KEY, async () => caps("alice"));

    setMetaCacheIdentity("2:bob");
    expect(cachedPresetRows(KEY)).toBeUndefined();
    expect(cachedPresetCapabilities(KEY)).toBeUndefined();
    expect(sharedPresetsClient("/db/_presets", factory)).not.toBe(client);
    // A factory reusing clients per URL must not keep the previous viewer's `_presets/meta`.
    expect(invalidateMeta).toHaveBeenCalledTimes(1);

    await loadPresetRows(KEY, async () => list([row("p2", "bob")]));
    resetMetaCache();
    expect(cachedPresetRows(KEY)).toBeUndefined();
  });

  it("invalidatePresetsCache drops everything", async () => {
    await loadPresetRows(KEY, async () => list([row("p1", "alice")]));
    invalidatePresetsCache();
    expect(cachedPresetRows(KEY)).toBeUndefined();
  });

  it("rows owned by another user than the capabilities name drop the cache and reload everyone", async () => {
    const l = listener();
    subscribePresetsCache(KEY, l);
    await loadPresetCapabilities(KEY, async () => caps("alice"));
    await loadPresetRows(KEY, async () => list([row("p1", "bob")]), { origin: l });
    expect(cachedPresetRows(KEY)).toBeUndefined();
    expect(cachedPresetCapabilities(KEY)).toBeUndefined();
    expect(l.refresh).toHaveBeenCalledWith(true);
    // Public rows of other users are not a mismatch.
    l.refresh.mockClear();
    await loadPresetCapabilities(KEY, async () => caps("alice"));
    await loadPresetRows(KEY, async () => list([row("p9", "carol", true)]), { force: true });
    expect(l.refresh).not.toHaveBeenCalled();
    expect(cachedPresetRows(KEY)).toBeDefined();
  });
});

async function receive(identity: string | null, key = KEY): Promise<void> {
  const peer = new BroadcastChannel("as-presets");
  peer.postMessage({ type: "write", identity, key }); // oxlint-disable-line unicorn/require-post-message-target-origin
  peer.close();
  await new Promise((r) => setTimeout(r, 20));
}

describe("presets cache — other tabs", () => {
  it("a write in another tab of the same viewer drops the rows and refreshes one mounted consumer", async () => {
    const a = listener();
    const b = listener();
    subscribePresetsCache(KEY, a);
    subscribePresetsCache(KEY, b);
    await loadPresetRows(KEY, async () => list([row("p1", "alice")]));

    await receive("1:alice");
    expect(cachedPresetRows(KEY)).toBeUndefined();
    expect(a.refresh).toHaveBeenCalledWith(false);
    expect(b.refresh).not.toHaveBeenCalled();
  });

  it("a mount after another tab's write never joins a fetch started before it", async () => {
    const slow = deferred<PresetsListResult>();
    const before = loadPresetRows(KEY, () => slow.promise);
    await receive("1:alice");
    const after = loadPresetRows(KEY, async () => list([row("fresh", "alice")]));
    expect((await after).presets.map((r) => r.id)).toEqual(["fresh"]);
    slow.resolve(list([row("stale", "alice")]));
    await before;
    expect(cachedPresetRows(KEY)?.rows.presets.map((r) => r.id)).toEqual(["fresh"]);
  });

  it("ignores messages of another viewer", async () => {
    const a = listener();
    subscribePresetsCache(KEY, a);
    await loadPresetRows(KEY, async () => list([row("p1", "alice")]));
    await receive("2:bob");
    expect(cachedPresetRows(KEY)).toBeDefined();
    expect(a.refresh).not.toHaveBeenCalled();
  });

  it("publishes writes for its own viewer", async () => {
    const peer = new BroadcastChannel("as-presets");
    const got: unknown[] = [];
    peer.addEventListener("message", (e) => got.push(e.data));
    publishPresetsWrite(KEY);
    await new Promise((r) => setTimeout(r, 20));
    peer.close();
    expect(got).toEqual([{ type: "write", identity: "1:alice", key: KEY }]);
  });
});
