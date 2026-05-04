import { ClientError } from "@atscript/db-client";
import type { Client } from "@atscript/db-client";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AS_PRESETS_APP } from "../composables/as-presets-app";
import { useAppPrefs, type UseAppPrefsReturn } from "../composables/use-app-prefs";

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

function setup(client: ReturnType<typeof makeMockClient>) {
  let captured: UseAppPrefsReturn | null = null;
  const Cmp = defineComponent({
    setup() {
      captured = useAppPrefs({
        url: "/db/_presets",
        clientFactory: () => client as unknown as Client,
      });
      return () => h("div");
    },
  });
  const wrapper = mount(Cmp, {
    global: { provide: { [AS_PRESETS_APP as symbol]: "demo" } },
  });
  if (!captured) throw new Error("captured is null");
  return { wrapper, ret: captured as UseAppPrefsReturn };
}

afterEach(() => {
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

  it("fans save() out to every other useAppPrefs(app) instance", async () => {
    // Instance A (e.g. <SidebarNav>) — auto-loads empty.
    const clientA = makeMockClient();
    clientA.query.mockResolvedValue([]);
    const { ret: a } = setup(clientA);
    await flushPromises();

    // Instance B (e.g. /preferences page) — same app, different mock client.
    const clientB = makeMockClient();
    clientB.query.mockResolvedValue([]);
    clientB.insert.mockResolvedValue({ id: "ac:alice:demo" });
    const { ret: b } = setup(clientB);
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
