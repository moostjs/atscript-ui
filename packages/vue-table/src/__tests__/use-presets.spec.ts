import type { Client } from "@atscript/db-client";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AS_PRESETS_APP } from "../composables/as-presets-app";
import { usePresets, type UsePresetsReturn } from "../composables/use-presets";

function makeMockClient() {
  return {
    query: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    one: vi.fn(),
  };
}

const presetRow = {
  id: "p1",
  type: "preset" as const,
  app: "demo",
  tableKey: "products",
  user: "alice",
  label: "Active customers",
  data: {
    label: "Active customers",
    content: { columns: { columnNames: ["name", "sku"] } },
  },
  createdAt: 0,
  updatedAt: 0,
};

const userConfRow = {
  id: "uc:alice:demo:products",
  type: "userConf" as const,
  app: "demo",
  tableKey: "products",
  user: "alice",
  data: { defaultPresetId: "p1", favPresetIds: [] },
  createdAt: 0,
  updatedAt: 0,
};

interface SetupOpts {
  systemPresets?: { id: string; label: string; content: object }[];
}

function setup(client: ReturnType<typeof makeMockClient>, opts: SetupOpts = {}) {
  // Default: presets list returns one preset + userConf row.
  if (client.query.mock.calls.length === 0 && client.query.getMockImplementation() === undefined) {
    client.query.mockResolvedValue([presetRow, userConfRow]);
  }
  let captured: UsePresetsReturn | null = null;
  const Cmp = defineComponent({
    setup() {
      captured = usePresets({
        url: "/db/_presets",
        tableKey: "products",
        clientFactory: () => client as unknown as Client,
        systemPresets: opts.systemPresets,
      });
      return () => h("div");
    },
  });
  // Override globalThis.fetch to a 500 stub so the capabilities side-channel
  // returns null (we don't assert on it here).
  const origFetch = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.resolve(new Response("{}", { status: 500 }))) as typeof globalThis.fetch;
  const wrapper = mount(Cmp, {
    global: { provide: { [AS_PRESETS_APP as symbol]: "demo" } },
  });
  return { wrapper, ret: captured as unknown as UsePresetsReturn, restoreFetch: origFetch };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("usePresets", () => {
  it("loads presets and userConf, splitting by type", async () => {
    const client = makeMockClient();
    const { ret, restoreFetch } = setup(client);
    try {
      await flushPromises();
      expect(ret.presets.value).toEqual([presetRow]);
      expect(ret.userConf.value).toEqual(userConfRow);
      expect(ret.available.value).toBe(true);
    } finally {
      globalThis.fetch = restoreFetch;
    }
  });

  it("exposes Standard at the top of systemPresets when prop omitted", async () => {
    const client = makeMockClient();
    const { ret, restoreFetch } = setup(client);
    try {
      await flushPromises();
      const sys = ret.systemPresets.value;
      expect(sys).toHaveLength(1);
      expect(sys[0].id).toBe("sys:standard");
    } finally {
      globalThis.fetch = restoreFetch;
    }
  });

  it("renders consumer-supplied system presets in array order after Standard", async () => {
    const client = makeMockClient();
    const { ret, restoreFetch } = setup(client, {
      systemPresets: [
        { id: "audit", label: "Audit", content: {} },
        { id: "monitoring", label: "Monitoring", content: {} },
      ],
    });
    try {
      await flushPromises();
      expect(ret.systemPresets.value.map((p) => p.id)).toEqual([
        "sys:standard",
        "sys:audit",
        "sys:monitoring",
      ]);
    } finally {
      globalThis.fetch = restoreFetch;
    }
  });

  it("activePreset resolves system + stored entries", async () => {
    const client = makeMockClient();
    const { ret, restoreFetch } = setup(client);
    try {
      await flushPromises();

      ret.activePresetId.value = "sys:standard";
      expect(ret.activePreset.value).toEqual({
        kind: "system",
        entry: { id: "sys:standard", label: "Standard", content: {} },
      });

      ret.activePresetId.value = "p1";
      expect(ret.activePreset.value).toEqual({ kind: "stored", entry: presetRow });

      ret.activePresetId.value = "missing";
      expect(ret.activePreset.value).toBeNull();
    } finally {
      globalThis.fetch = restoreFetch;
    }
  });

  it("isOwned: true for private rows; false for system; uses currentUser heuristic for public", async () => {
    const client = makeMockClient();
    client.query.mockResolvedValue([
      presetRow,
      {
        ...presetRow,
        id: "p2",
        public: true,
        label: "Public-mine",
        data: { label: "Public-mine" },
      },
      {
        ...presetRow,
        id: "p3",
        user: "bob",
        public: true,
        label: "Public-other",
        data: { label: "Public-other" },
      },
    ]);
    const { ret, restoreFetch } = setup(client);
    try {
      await flushPromises();
      expect(ret.isOwned("p1")).toBe(true);
      expect(ret.isOwned("p2")).toBe(true);
      expect(ret.isOwned("p3")).toBe(false);
      expect(ret.isOwned("sys:standard")).toBe(false);
    } finally {
      globalThis.fetch = restoreFetch;
    }
  });

  it("savePresetAs creates the row and switches activePresetId to the new id", async () => {
    const client = makeMockClient();
    client.insert.mockResolvedValue({ insertedId: "p2" });
    // Second list() call after the mutation:
    client.query.mockResolvedValueOnce([presetRow, userConfRow]).mockResolvedValueOnce([
      presetRow,
      {
        ...presetRow,
        id: "p2",
        label: "New view",
        data: { label: "New view", content: { sorters: [] } },
      },
      userConfRow,
    ]);
    const { ret, restoreFetch } = setup(client);
    try {
      await flushPromises();

      const id = await ret.savePresetAs("New view", { sorters: [] }, { public: false });

      expect(id).toBe("p2");
      expect(ret.activePresetId.value).toBe("p2");
      expect(ret.presets.value.some((p) => p.id === "p2")).toBe(true);
    } finally {
      globalThis.fetch = restoreFetch;
    }
  });

  it("savePreset throws on system preset (synthetic, not saveable)", async () => {
    const client = makeMockClient();
    const { ret, restoreFetch } = setup(client);
    try {
      await flushPromises();
      ret.activePresetId.value = "sys:standard";
      await expect(ret.savePreset({ columns: { columnNames: ["x"] } })).rejects.toThrow(
        /system presets/,
      );
    } finally {
      globalThis.fetch = restoreFetch;
    }
  });

  it("savePreset on a stored preset updates content via Client.update", async () => {
    const client = makeMockClient();
    client.update.mockResolvedValue({});
    client.query
      .mockResolvedValueOnce([presetRow, userConfRow])
      .mockResolvedValueOnce([
        { ...presetRow, data: { label: "Active customers", content: { sorters: [] } } },
        userConfRow,
      ]);
    const { ret, restoreFetch } = setup(client);
    try {
      await flushPromises();
      ret.activePresetId.value = "p1";
      await ret.savePreset({ sorters: [{ field: "x", direction: "asc" }] });
      expect(client.update).toHaveBeenCalledWith({
        id: "p1",
        // Label travels through so the validator can pick the preset
        // variant of the `data` union — server still shallow-merges,
        // but the validator can't accept partial union members.
        data: {
          label: "Active customers",
          content: { sorters: [{ field: "x", direction: "asc" }] },
        },
      });
    } finally {
      globalThis.fetch = restoreFetch;
    }
  });

  it("deletePreset of active sets activePresetId back to Standard", async () => {
    const client = makeMockClient();
    client.remove.mockResolvedValue({});
    client.query
      .mockResolvedValueOnce([presetRow, userConfRow])
      .mockResolvedValueOnce([userConfRow]);
    const { ret, restoreFetch } = setup(client);
    try {
      await flushPromises();
      ret.activePresetId.value = "p1";
      await ret.deletePreset("p1");
      expect(ret.activePresetId.value).toBe("sys:standard");
      expect(client.remove).toHaveBeenCalledWith("p1");
    } finally {
      globalThis.fetch = restoreFetch;
    }
  });

  it("setDefault upserts userConf via update when row exists", async () => {
    const client = makeMockClient();
    client.update.mockResolvedValue({});
    client.query
      .mockResolvedValueOnce([presetRow, userConfRow])
      .mockResolvedValueOnce([
        presetRow,
        { ...userConfRow, data: { ...userConfRow.data, defaultPresetId: "sys:standard" } },
      ]);
    const { ret, restoreFetch } = setup(client);
    try {
      await flushPromises();
      await ret.setDefault("sys:standard");
      expect(client.update).toHaveBeenCalledWith({
        id: "uc:alice:demo:products",
        data: { defaultPresetId: "sys:standard" },
      });
    } finally {
      globalThis.fetch = restoreFetch;
    }
  });

  it("toggleFav adds then removes the id from userConf.favPresetIds", async () => {
    const client = makeMockClient();
    client.update.mockResolvedValue({});

    // First load: empty favs
    const ucEmpty = { ...userConfRow, data: { defaultPresetId: "p1", favPresetIds: [] } };
    const ucWithP1 = {
      ...userConfRow,
      data: { defaultPresetId: "p1", favPresetIds: ["p1"] },
    };
    client.query
      .mockResolvedValueOnce([presetRow, ucEmpty])
      .mockResolvedValueOnce([presetRow, ucWithP1])
      .mockResolvedValueOnce([presetRow, ucEmpty]);

    const { ret, restoreFetch } = setup(client);
    try {
      await flushPromises();
      await ret.toggleFav("p1");
      expect(client.update).toHaveBeenLastCalledWith({
        id: "uc:alice:demo:products",
        data: { favPresetIds: ["p1"] },
      });

      await ret.toggleFav("p1");
      expect(client.update).toHaveBeenLastCalledWith({
        id: "uc:alice:demo:products",
        data: { favPresetIds: [] },
      });
    } finally {
      globalThis.fetch = restoreFetch;
    }
  });

  it("renamePreset / togglePublic / deletePreset reject system ids", async () => {
    const client = makeMockClient();
    const { ret, restoreFetch } = setup(client);
    try {
      await flushPromises();
      await expect(ret.renamePreset("sys:standard", "X")).rejects.toThrow();
      await expect(ret.togglePublic("sys:standard")).rejects.toThrow();
      await expect(ret.deletePreset("sys:standard")).rejects.toThrow();
    } finally {
      globalThis.fetch = restoreFetch;
    }
  });
});
