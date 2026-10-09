// @vitest-environment happy-dom
import type { Client } from "@atscript/db-client";
import { resetMetaCache, setMetaCacheIdentity, type ClientFactory } from "@atscript/ui";
import { setPresetsCacheMaxAge, type AsPresetEntryRow } from "@atscript/ui-table";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AS_PRESETS_APP } from "../composables/as-presets-app";
import { useTable } from "../composables/use-table";
import { usePresets, type UsePresetsReturn } from "../composables/use-presets";
import type { ReactiveTableState } from "../types";
import { createMockClient, createMockMeta } from "./helpers";

// FW-33: preset rows + capabilities are cached per (presets url, app,
// tableKey) for the signed-in viewer, and capabilities never hold the first
// data query.

const PRESETS_URL = "/db/_presets";

function presetRow(id: string, label: string, user = "alice"): AsPresetEntryRow {
  return {
    id,
    type: "preset",
    app: "demo",
    tableKey: "products",
    user,
    label,
    data: { label, content: { columns: { columnNames: ["name"] } } },
    createdAt: 0,
    updatedAt: 0,
  } as AsPresetEntryRow;
}

function userConf(defaultPresetId: string): AsPresetEntryRow {
  return {
    id: "uc:alice:demo:products",
    type: "userConf",
    app: "demo",
    tableKey: "products",
    user: "alice",
    data: { defaultPresetId, favPresetIds: [] },
    createdAt: 0,
    updatedAt: 0,
  } as AsPresetEntryRow;
}

function presetsServer(rows: AsPresetEntryRow[]) {
  const db = {
    rows,
    query: vi.fn(async () => db.rows),
    insert: vi.fn(),
    update: vi.fn(async (patch: { id: string; data?: { label?: string } }) => {
      db.rows = db.rows.map((r) =>
        r.id === patch.id && patch.data?.label ? { ...r, label: patch.data.label } : r,
      );
    }),
    remove: vi.fn(),
    one: vi.fn(),
  };
  return db;
}

/** `globalThis.fetch` stub for `GET _presets/capabilities`. */
function stubCapabilities(impl: () => Promise<Response>) {
  const fetch = vi.fn(impl);
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

function capsResponse(userId = "alice") {
  return Promise.resolve(
    new Response(JSON.stringify({ canPublish: true, presetLimit: 10, userId }), {
      headers: { "content-type": "application/json" },
    }),
  );
}

const mounted: { unmount: () => void }[] = [];

function mountPresets(factory: ClientFactory): UsePresetsReturn {
  let handle!: UsePresetsReturn;
  mounted.push(
    mount(
      defineComponent({
        setup() {
          handle = usePresets({ url: PRESETS_URL, tableKey: "products", clientFactory: factory });
          return () => h("div");
        },
      }),
      { global: { provide: { [AS_PRESETS_APP as symbol]: "demo" } } },
    ),
  );
  return handle;
}

function mountTable(factory: ClientFactory) {
  let state!: ReactiveTableState;
  const w = mount(
    defineComponent({
      setup() {
        state = useTable("/products", {
          clientFactory: factory,
          preset: { url: PRESETS_URL, tableKey: "products" },
        });
        return () => h("div");
      },
    }),
    { global: { provide: { [AS_PRESETS_APP as symbol]: "demo" } } },
  );
  mounted.push(w);
  return { state, unmount: () => w.unmount() };
}

function setupFactory(db: ReturnType<typeof presetsServer>) {
  const { client: tableClient, pagesFn } = createMockClient({
    meta: createMockMeta(["name", "sku"]),
    data: [{ name: "a", sku: "1" }],
  });
  const factory = vi.fn<ClientFactory>((url) =>
    url === PRESETS_URL ? (db as unknown as Client) : tableClient,
  );
  return { factory, pagesFn };
}

beforeEach(() => {
  setMetaCacheIdentity("1:alice");
});

afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount();
  setPresetsCacheMaxAge(30_000);
  resetMetaCache();
  vi.unstubAllGlobals();
});

describe("usePresets — capabilities off the critical path", () => {
  it("the first data query fires while capabilities are still loading", async () => {
    const db = presetsServer([presetRow("p1", "Mine"), userConf("p1")]);
    const caps = stubCapabilities(() => new Promise<Response>(() => {})); // never settles
    const { factory, pagesFn } = setupFactory(db);

    const { state } = mountTable(factory);
    await flushPromises();

    expect(caps).toHaveBeenCalledTimes(1);
    expect(pagesFn).toHaveBeenCalledTimes(1);
    expect(state.preset.activeId.value).toBe("p1");
    expect(state.preset.capabilities.value).toBeNull();
  });
});

describe("usePresets — session cache", () => {
  it("a re-mount serves rows + capabilities from the cache: no preset request, query fires", async () => {
    const db = presetsServer([presetRow("p1", "Mine"), userConf("p1")]);
    const caps = stubCapabilities(() => capsResponse());
    const { factory, pagesFn } = setupFactory(db);

    const first = mountTable(factory);
    await flushPromises();
    first.unmount();
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(caps).toHaveBeenCalledTimes(1);

    const second = mountTable(factory);
    // Rows are applied synchronously — nothing to wait for but the table def.
    expect(second.state.preset.presets.value.map((r) => r.id)).toEqual(["p1"]);
    await flushPromises();
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(caps).toHaveBeenCalledTimes(1);
    expect(second.state.preset.activeId.value).toBe("p1");
    expect(second.state.preset.capabilities.value?.userId).toBe("alice");
    expect(pagesFn).toHaveBeenCalledTimes(2);
    // One shared presets client for both mounts.
    expect(factory.mock.calls.filter(([url]) => url === PRESETS_URL)).toHaveLength(1);
  });

  it("past the max age, a background revalidation updates the list but never re-applies the default", async () => {
    const db = presetsServer([presetRow("p1", "Mine"), presetRow("p2", "Other"), userConf("p1")]);
    stubCapabilities(() => capsResponse());
    const { factory } = setupFactory(db);

    mountTable(factory).unmount();
    await flushPromises();

    setPresetsCacheMaxAge(0);
    db.rows = [
      presetRow("p1", "Mine"),
      presetRow("p2", "Other"),
      presetRow("p3", "New"),
      userConf("p2"),
    ];
    const { state } = mountTable(factory);
    await flushPromises();

    expect(db.query).toHaveBeenCalledTimes(2);
    expect(state.preset.presets.value.map((r) => r.id)).toEqual(["p1", "p2", "p3"]);
    expect(state.preset.activeId.value).toBe("p1"); // applied from the cache, kept
  });

  it("a write in one mounted consumer updates another with the same key", async () => {
    const db = presetsServer([presetRow("p1", "Mine"), userConf("p1")]);
    stubCapabilities(() => capsResponse());
    const { factory } = setupFactory(db);

    const a = mountPresets(factory);
    const b = mountPresets(factory);
    await flushPromises();
    expect(db.query).toHaveBeenCalledTimes(1); // concurrent mounts share one load

    await a.renamePreset("p1", "Renamed");
    await flushPromises();
    expect(b.presets.value[0]!.label).toBe("Renamed");
  });

  it("a background revalidation settling after a write never rolls the list back", async () => {
    const db = presetsServer([presetRow("p1", "Mine"), userConf("p1")]);
    stubCapabilities(() => capsResponse());
    const { factory } = setupFactory(db);
    mountPresets(factory);
    await flushPromises();

    setPresetsCacheMaxAge(0);
    let release!: () => void;
    const before = db.rows;
    db.query.mockImplementationOnce(
      () => new Promise((resolve) => (release = () => resolve(before))),
    );
    const handle = mountPresets(factory); // stale hit → slow background revalidation
    await handle.renamePreset("p1", "Renamed");
    release();
    await flushPromises();
    expect(handle.presets.value[0]!.label).toBe("Renamed");
  });

  it("a write in another tab refreshes a mounted consumer in the background", async () => {
    const db = presetsServer([presetRow("p1", "Mine"), userConf("p1")]);
    stubCapabilities(() => capsResponse());
    const { factory } = setupFactory(db);
    const handle = mountPresets(factory);
    await flushPromises();

    db.rows = [presetRow("p1", "From other tab"), userConf("p1")];
    const peer = new BroadcastChannel("as-presets");
    const msg = { type: "write", identity: "1:alice", key: "/db/_presets|demo|products" };
    peer.postMessage(msg); // oxlint-disable-line unicorn/require-post-message-target-origin
    peer.close();
    await vi.waitFor(() => expect(handle.presets.value[0]!.label).toBe("From other tab"));
  });

  it("an identity change drops the cache", async () => {
    const db = presetsServer([presetRow("p1", "Mine"), userConf("p1")]);
    let user = "alice";
    stubCapabilities(() => capsResponse(user));
    const { factory } = setupFactory(db);
    mountTable(factory).unmount();
    await flushPromises();

    setMetaCacheIdentity("2:bob");
    user = "bob";
    db.rows = [presetRow("b1", "Bob's", "bob")];
    const { state } = mountTable(factory);
    expect(state.preset.presets.value).toEqual([]); // nothing from alice
    await flushPromises();
    expect(state.preset.presets.value.map((r) => r.id)).toEqual(["b1"]);
    expect(db.query).toHaveBeenCalledTimes(2);
  });

  it("caches nothing until the app binds an identity", async () => {
    vi.resetModules();
    const ui = await import("@atscript/ui");
    // A fresh module graph has no identity bound.
    expect(ui.getMetaCacheIdentity()).toBeUndefined();
    const { usePresets: freshUsePresets } = await import("../composables/use-presets");
    const { AS_PRESETS_APP: freshApp } = await import("../composables/as-presets-app");
    const db = presetsServer([presetRow("p1", "Mine")]);
    stubCapabilities(() => capsResponse());
    const factory = (() => db as unknown as Client) as ClientFactory;
    const mountFresh = () =>
      mount(
        defineComponent({
          setup() {
            freshUsePresets({ url: PRESETS_URL, tableKey: "products", clientFactory: factory });
            return () => h("div");
          },
        }),
        { global: { provide: { [freshApp as symbol]: "demo" } } },
      );
    mountFresh().unmount();
    await flushPromises();
    mountFresh().unmount();
    await flushPromises();
    expect(db.query).toHaveBeenCalledTimes(2);
  });
});
