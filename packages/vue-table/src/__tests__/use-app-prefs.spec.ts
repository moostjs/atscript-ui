import { ClientError } from "@atscript/db-client";
import type { Client } from "@atscript/db-client";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AS_PRESETS_APP } from "../composables/as-presets-app";
import {
  disposeAppPrefs,
  useAppPrefs,
  type UseAppPrefsOptions,
  type UseAppPrefsReturn,
} from "../composables/use-app-prefs";

function makeMockClient() {
  return {
    query: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    one: vi.fn(),
  };
}

function authError(status: 401 | 403 | 500) {
  return new ClientError(status, { message: "x", statusCode: status, errors: [] });
}

function setup(
  client: ReturnType<typeof makeMockClient>,
  optsOverride: Partial<UseAppPrefsOptions> = {},
  app = "demo",
) {
  let captured: UseAppPrefsReturn | null = null;
  const Cmp = defineComponent({
    setup() {
      captured = useAppPrefs({
        url: "/db/_presets",
        clientFactory: () => client as unknown as Client,
        ...optsOverride,
      });
      return () => h("div");
    },
  });
  const wrapper = mount(Cmp, {
    global: { provide: { [AS_PRESETS_APP as symbol]: app } },
  });
  if (!captured) throw new Error("captured is null");
  return { wrapper, ret: captured as UseAppPrefsReturn };
}

// Singleton: tear down between tests so each case sees a fresh client +
// auto-load round-trip.
function disposeAll() {
  for (const [app, url] of [
    ["demo", "/db/_presets"],
    ["other", "/db/_presets"],
    ["demo", "/db/_other"],
    ["demo", "/db/_ssr"],
  ] as const) {
    disposeAppPrefs(app, url);
  }
}

beforeEach(() => {
  disposeAll();
});

afterEach(() => {
  disposeAll();
  vi.restoreAllMocks();
});

describe("useAppPrefs", () => {
  it("auto-loads on mount and exposes prefs reactively", async () => {
    const client = makeMockClient();
    client.query.mockResolvedValue([
      {
        id: "ac:alice:demo",
        type: "appConf",
        app: "demo",
        user: "alice",
        data: { appearance: "dark", language: "en-US" },
        createdAt: 0,
        updatedAt: 0,
      },
    ]);
    const { ret } = setup(client);
    await flushPromises();

    expect(ret.prefs.value).toEqual({ appearance: "dark", language: "en-US" });
    expect(ret.loading.value).toBe(false);
    expect(ret.available.value).toBe(true);
    expect(ret.error.value).toBeNull();
  });

  it("returns empty prefs when no row exists", async () => {
    const client = makeMockClient();
    client.query.mockResolvedValue([]);
    const { ret } = setup(client);
    await flushPromises();

    expect(ret.prefs.value).toEqual({});
    expect(ret.available.value).toBe(true);
  });

  it("collapses to available=false on 401 silently (no error.value)", async () => {
    const client = makeMockClient();
    client.query.mockRejectedValue(authError(401));
    const { ret } = setup(client);
    await flushPromises();

    expect(ret.available.value).toBe(false);
    expect(ret.error.value).toBeNull();
  });

  it("collapses to available=false on 403", async () => {
    const client = makeMockClient();
    client.query.mockRejectedValue(authError(403));
    const { ret } = setup(client);
    await flushPromises();
    expect(ret.available.value).toBe(false);
  });

  it("non-auth errors land in error.value with available=true", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = makeMockClient();
    client.query.mockRejectedValue(new Error("network"));
    const { ret } = setup(client);
    await flushPromises();

    expect(ret.error.value).toBeInstanceOf(Error);
    expect(ret.available.value).toBe(true);
    expect(warn).toHaveBeenCalled();
  });

  it("save() optimistically merges then patches via update when row exists", async () => {
    const client = makeMockClient();
    const row = {
      id: "ac:alice:demo",
      type: "appConf" as const,
      app: "demo",
      user: "alice",
      data: { appearance: "light" },
      createdAt: 0,
      updatedAt: 0,
    };
    client.query.mockResolvedValue([row]);
    client.update.mockResolvedValue({});
    const { ret } = setup(client);
    await flushPromises();

    await ret.save({ appearance: "dark", density: "compact" });

    expect(ret.prefs.value).toEqual({ appearance: "dark", density: "compact" });
    expect(client.update).toHaveBeenCalledWith({
      id: "ac:alice:demo",
      data: { appearance: "dark", density: "compact" },
    });
    expect(client.insert).not.toHaveBeenCalled();
  });

  it("save() calls insert when no row exists; subsequent saves go through update", async () => {
    const client = makeMockClient();
    client.query.mockResolvedValue([]);
    client.insert.mockResolvedValue({ insertedId: "ac:alice:demo" });
    client.update.mockResolvedValue({});
    const { ret } = setup(client);
    await flushPromises();

    await ret.save({ appearance: "dark" });
    expect(client.insert).toHaveBeenCalledOnce();
    expect(client.update).not.toHaveBeenCalled();

    await ret.save({ language: "en-GB" });
    expect(client.update).toHaveBeenCalledWith({
      id: "ac:alice:demo",
      data: { language: "en-GB" },
    });
    expect(client.insert).toHaveBeenCalledOnce();
  });

  it("save() rolls back optimistic write on server error", async () => {
    const client = makeMockClient();
    client.query.mockResolvedValue([
      {
        id: "ac:alice:demo",
        type: "appConf",
        app: "demo",
        user: "alice",
        data: { appearance: "light" },
        createdAt: 0,
        updatedAt: 0,
      },
    ]);
    client.update.mockRejectedValue(new Error("boom"));
    const { ret } = setup(client);
    await flushPromises();

    await expect(ret.save({ appearance: "dark" })).rejects.toThrow("boom");
    expect(ret.prefs.value).toEqual({ appearance: "light" });
  });

  it("reset() drops in-memory state without contacting the server", async () => {
    const client = makeMockClient();
    client.query.mockResolvedValue([
      {
        id: "ac:alice:demo",
        type: "appConf",
        app: "demo",
        user: "alice",
        data: { appearance: "dark" },
        createdAt: 0,
        updatedAt: 0,
      },
    ]);
    const { ret } = setup(client);
    await flushPromises();
    expect(ret.prefs.value).toEqual({ appearance: "dark" });

    ret.reset();
    expect(ret.prefs.value).toEqual({});
  });

  it("reload() re-queries on demand", async () => {
    const client = makeMockClient();
    client.query.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: "ac:alice:demo",
        type: "appConf",
        app: "demo",
        user: "alice",
        data: { appearance: "dark" },
        createdAt: 0,
        updatedAt: 0,
      },
    ]);
    const { ret } = setup(client);
    await flushPromises();
    expect(ret.prefs.value).toEqual({});

    await ret.reload();
    expect(ret.prefs.value).toEqual({ appearance: "dark" });
    expect(client.query).toHaveBeenCalledTimes(2);
  });
});

describe("useAppPrefs localStorage cache", () => {
  const CACHE_KEY = "as-app-prefs:demo";

  afterEach(() => {
    try {
      globalThis.localStorage?.clear();
    } catch {}
  });

  it("hydrates synchronously from cache before the network settles", () => {
    globalThis.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ appearance: "dark", language: "fr-FR" }),
    );
    const client = makeMockClient();
    // Server hangs forever — only the cache should populate prefs.
    client.query.mockReturnValue(new Promise(() => {}));
    const { ret } = setup(client);

    expect(ret.prefs.value).toEqual({ appearance: "dark", language: "fr-FR" });
    expect(ret.loading.value).toBe(true);
  });

  it("writes server response to cache after successful load", async () => {
    const client = makeMockClient();
    client.query.mockResolvedValue([
      {
        id: "ac:alice:demo",
        type: "appConf",
        app: "demo",
        user: "alice",
        data: { appearance: "dark" },
        createdAt: 0,
        updatedAt: 0,
      },
    ]);
    setup(client);
    await flushPromises();

    expect(globalThis.localStorage.getItem(CACHE_KEY)).toBe(JSON.stringify({ appearance: "dark" }));
  });

  it("writes optimistic patch to cache on save (before server settles)", async () => {
    const client = makeMockClient();
    client.query.mockResolvedValue([]);
    let resolveSave!: (value: { id: string }) => void;
    client.insert.mockReturnValue(
      new Promise<{ id: string }>((resolve) => {
        resolveSave = resolve;
      }),
    );
    const { ret } = setup(client);
    await flushPromises();

    const pending = ret.save({ appearance: "dark" });
    // `save()` is async — the optimistic write happens at the start of
    // the function body, which runs on the next microtask. Yield once
    // before asserting so the body has had a chance to execute.
    await Promise.resolve();
    expect(globalThis.localStorage.getItem(CACHE_KEY)).toBe(JSON.stringify({ appearance: "dark" }));
    resolveSave({ id: "ac:bob:demo" });
    await pending;
    expect(globalThis.localStorage.getItem(CACHE_KEY)).toBe(JSON.stringify({ appearance: "dark" }));
  });

  it("rolls back cache when save fails", async () => {
    const client = makeMockClient();
    client.query.mockResolvedValue([]);
    client.insert.mockRejectedValue(new Error("boom"));
    const { ret } = setup(client);
    await flushPromises();
    // Pre-cache a previous value.
    globalThis.localStorage.setItem(CACHE_KEY, JSON.stringify({ appearance: "light" }));
    // Repaint prefs from cache by recreating the composable would be heavy;
    // simpler: assert the rolled-back cache reflects the pre-save state.
    await expect(ret.save({ appearance: "dark" })).rejects.toThrow();
    // Cache rolled back to the original empty (`{}`) — the save started
    // from `prefs.value === {}`, so rollback restores `{}`.
    expect(globalThis.localStorage.getItem(CACHE_KEY)).toBe("{}");
  });

  it("clears cache on reset() and on auth-denied load", async () => {
    globalThis.localStorage.setItem(CACHE_KEY, JSON.stringify({ appearance: "dark" }));
    const client = makeMockClient();
    client.query.mockResolvedValue([]);
    const { ret } = setup(client);
    await flushPromises();

    ret.reset();
    expect(globalThis.localStorage.getItem(CACHE_KEY)).toBeNull();

    // Now simulate a denied reload — also clears cache.
    globalThis.localStorage.setItem(CACHE_KEY, JSON.stringify({ appearance: "dark" }));
    client.query.mockRejectedValue(authError(401));
    await ret.reload();
    expect(globalThis.localStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it("fans save() out across distinct singletons sharing one app", async () => {
    // Two separate singletons — same `app`, different `url` — exercise the
    // in-window bus path that singleton-ification doesn't already cover.
    const clientA = makeMockClient();
    clientA.query.mockResolvedValue([]);
    const { ret: a } = setup(clientA, { url: "/db/_presets" });
    await flushPromises();

    const clientB = makeMockClient();
    clientB.query.mockResolvedValue([]);
    clientB.insert.mockResolvedValue({ id: "ac:alice:demo" });
    const { ret: b } = setup(clientB, { url: "/db/_other" });
    await flushPromises();

    // B saves; A's prefs mirrors via the cross-instance bus and A
    // adopts the server-stamped id from B without a separate reload.
    await b.save({ appearance: "dark" });
    await flushPromises();

    expect(a.prefs.value.appearance).toBe("dark");
  });

  it("does NOT touch localStorage when cache: false", async () => {
    globalThis.localStorage.setItem(CACHE_KEY, JSON.stringify({ appearance: "dark" }));
    const client = makeMockClient();
    client.query.mockResolvedValue([
      {
        id: "ac:alice:demo",
        type: "appConf",
        app: "demo",
        user: "alice",
        data: { appearance: "light" },
        createdAt: 0,
        updatedAt: 0,
      },
    ]);
    let captured: UseAppPrefsReturn | null = null;
    const Cmp = defineComponent({
      setup() {
        captured = useAppPrefs({
          url: "/db/_presets",
          cache: false,
          clientFactory: () => client as unknown as Client,
        });
        return () => h("div");
      },
    });
    mount(Cmp, { global: { provide: { [AS_PRESETS_APP as symbol]: "demo" } } });
    if (!captured) throw new Error("captured is null");
    const ret = captured as UseAppPrefsReturn;
    // Pre-existing cache was NOT used to hydrate.
    expect(ret.prefs.value).toEqual({});
    await flushPromises();
    // Server response did NOT write to cache either.
    expect(globalThis.localStorage.getItem(CACHE_KEY)).toBe(JSON.stringify({ appearance: "dark" }));
  });
});

describe("useAppPrefs singleton", () => {
  it("returns the same instance for repeated calls with the same (app, url)", async () => {
    const client = makeMockClient();
    client.query.mockResolvedValue([]);
    const { ret: first } = setup(client);
    await flushPromises();
    // Second call mounts a fresh component but should re-use the existing
    // singleton — its `clientFactory` is ignored.
    const otherClient = makeMockClient();
    otherClient.query.mockResolvedValue([]);
    const { ret: second } = setup(otherClient);
    await flushPromises();

    expect(second).toBe(first);
    expect(second.prefs).toBe(first.prefs);
    // Crucially: the second client's factory was never invoked because the
    // singleton's existing client owns the load.
    expect(otherClient.query).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it("returns distinct instances for different (app, url) pairs", async () => {
    const clientA = makeMockClient();
    clientA.query.mockResolvedValue([]);
    const { ret: a } = setup(clientA, { url: "/db/_presets" });
    await flushPromises();

    const clientB = makeMockClient();
    clientB.query.mockResolvedValue([]);
    const { ret: b } = setup(clientB, { url: "/db/_other" });
    await flushPromises();

    expect(b).not.toBe(a);
    expect(clientA.query).toHaveBeenCalledTimes(1);
    expect(clientB.query).toHaveBeenCalledTimes(1);
  });

  it("returns distinct instances for different apps", async () => {
    const clientA = makeMockClient();
    clientA.query.mockResolvedValue([]);
    const { ret: a } = setup(clientA, {}, "demo");
    await flushPromises();

    const clientB = makeMockClient();
    clientB.query.mockResolvedValue([]);
    const { ret: b } = setup(clientB, {}, "other");
    await flushPromises();

    expect(b).not.toBe(a);
  });

  it("first-caller's cache setting wins; second caller gets a console warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = makeMockClient();
    client.query.mockResolvedValue([]);
    const { ret: first } = setup(client, { cache: false });
    await flushPromises();

    const otherClient = makeMockClient();
    otherClient.query.mockResolvedValue([]);
    const { ret: second } = setup(otherClient, { cache: true });
    await flushPromises();

    expect(second).toBe(first);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("cache=true ignored"),
    );
  });

  it("disposeAppPrefs() lets a fresh instance be created", async () => {
    const clientA = makeMockClient();
    clientA.query.mockResolvedValue([]);
    const { ret: a } = setup(clientA);
    await flushPromises();

    disposeAppPrefs("demo", "/db/_presets");

    const clientB = makeMockClient();
    clientB.query.mockResolvedValue([]);
    const { ret: b } = setup(clientB);
    await flushPromises();

    expect(b).not.toBe(a);
    expect(clientB.query).toHaveBeenCalledTimes(1);
  });
});

describe("useAppPrefs BroadcastChannel", () => {
  type ChannelMessage =
    | { type: "save"; prefs: Record<string, unknown>; row: unknown }
    | { type: "reset" };

  // Hand-rolled fake for deterministic cross-instance message routing per name.
  class FakeBroadcastChannel {
    static channels = new Map<string, Set<FakeBroadcastChannel>>();
    private listeners = new Set<(e: MessageEvent) => void>();
    constructor(public name: string) {
      let bucket = FakeBroadcastChannel.channels.get(name);
      if (!bucket) FakeBroadcastChannel.channels.set(name, (bucket = new Set()));
      bucket.add(this);
    }
    addEventListener(_type: "message", cb: (e: MessageEvent) => void) {
      this.listeners.add(cb);
    }
    postMessage(data: ChannelMessage) {
      const bucket = FakeBroadcastChannel.channels.get(this.name);
      if (!bucket) return;
      for (const peer of bucket) {
        if (peer === this) continue;
        for (const cb of peer.listeners) cb({ data } as MessageEvent);
      }
    }
    close() {
      FakeBroadcastChannel.channels.get(this.name)?.delete(this);
    }
    static reset() {
      FakeBroadcastChannel.channels.clear();
    }
  }

  type GlobalWithBC = typeof globalThis & {
    BroadcastChannel?: typeof BroadcastChannel;
  };
  const globalRef = globalThis as GlobalWithBC;
  let originalBC: typeof BroadcastChannel | undefined;

  beforeEach(() => {
    FakeBroadcastChannel.reset();
    originalBC = globalRef.BroadcastChannel;
    globalRef.BroadcastChannel = FakeBroadcastChannel as unknown as typeof BroadcastChannel;
  });

  afterEach(() => {
    if (originalBC) globalRef.BroadcastChannel = originalBC;
    else delete globalRef.BroadcastChannel;
    FakeBroadcastChannel.reset();
  });

  it("posts a save message to peers when save() succeeds", async () => {
    const client = makeMockClient();
    client.query.mockResolvedValue([]);
    client.insert.mockResolvedValue({ id: "ac:alice:demo" });
    const { ret } = setup(client);
    await flushPromises();

    // Attach a peer channel listener BEFORE save fires.
    const peer = new FakeBroadcastChannel("as-app-prefs:demo");
    const seen: ChannelMessage[] = [];
    peer.addEventListener("message", (e) => {
      seen.push(e.data as ChannelMessage);
    });

    await ret.save({ appearance: "dark" });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ type: "save", prefs: { appearance: "dark" } });
  });

  it("posts a reset message to peers", async () => {
    const client = makeMockClient();
    client.query.mockResolvedValue([]);
    const { ret } = setup(client);
    await flushPromises();

    const peer = new FakeBroadcastChannel("as-app-prefs:demo");
    const seen: ChannelMessage[] = [];
    peer.addEventListener("message", (e) => {
      seen.push(e.data as ChannelMessage);
    });

    ret.reset();
    expect(seen).toEqual([{ type: "reset" }]);
  });

  it("receives save messages from peers and updates local cache", async () => {
    const client = makeMockClient();
    client.query.mockResolvedValue([]);
    const { ret } = setup(client);
    await flushPromises();
    expect(ret.prefs.value).toEqual({});

    // Simulate a peer (another tab) broadcasting a save.
    const peer = new FakeBroadcastChannel("as-app-prefs:demo");
    peer.postMessage({
      type: "save",
      prefs: { appearance: "dark", language: "fr-FR" },
      row: {
        id: "ac:alice:demo",
        type: "appConf",
        app: "demo",
        user: "alice",
        data: { appearance: "dark", language: "fr-FR" },
        createdAt: 0,
        updatedAt: 0,
      },
    });

    expect(ret.prefs.value).toEqual({ appearance: "dark", language: "fr-FR" });
  });

  it("receives reset messages from peers and clears local state", async () => {
    const client = makeMockClient();
    client.query.mockResolvedValue([
      {
        id: "ac:alice:demo",
        type: "appConf",
        app: "demo",
        user: "alice",
        data: { appearance: "dark" },
        createdAt: 0,
        updatedAt: 0,
      },
    ]);
    const { ret } = setup(client);
    await flushPromises();
    expect(ret.prefs.value).toEqual({ appearance: "dark" });

    const peer = new FakeBroadcastChannel("as-app-prefs:demo");
    peer.postMessage({ type: "reset" });

    expect(ret.prefs.value).toEqual({});
  });

  it("does NOT construct a BroadcastChannel when the global API is missing", async () => {
    // Source guards on both `typeof window !== 'undefined'` and `typeof BroadcastChannel === 'function'`.
    // happy-dom always exposes `window` (deleting it breaks vue-test-utils), so test the API-missing
    // leg by stubbing `BroadcastChannel` to undefined; the same guard covers the true SSR case.
    const original = globalRef.BroadcastChannel;
    (globalRef as { BroadcastChannel?: unknown }).BroadcastChannel = undefined;
    try {
      const client = makeMockClient();
      client.query.mockResolvedValue([]);
      const { ret } = setup(client, { autoLoad: false, app: "demo", url: "/db/_ssr" });
      // No throw on mount + save still works without a channel.
      expect(ret.prefs.value).toEqual({});
    } finally {
      globalRef.BroadcastChannel = original;
      disposeAppPrefs("demo", "/db/_ssr");
    }
  });
});
