import { ClientError } from "@atscript/db-client";
import type { Client } from "@atscript/db-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AsPresetEntryRow } from "./preset-data-types";
import { PresetsClient, isAuthError } from "./presets-client";

interface MockClient {
  query: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  one: ReturnType<typeof vi.fn>;
}

function makeMockClient(): MockClient {
  return {
    query: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    one: vi.fn(),
  };
}

function makeMockFetch(impl: (url: string, init: RequestInit) => Response | Promise<Response>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return impl(url, init ?? {});
  }) as unknown as typeof globalThis.fetch;
}

function authError(status: 401 | 403 | 500) {
  return new ClientError(status, { message: "x", statusCode: status, errors: [] });
}

function build(client: MockClient, fetchImpl?: typeof globalThis.fetch) {
  return new PresetsClient({
    url: "/db/_presets",
    app: "demo",
    tableKey: "products",
    client: client as unknown as Client,
    fetch: fetchImpl ?? makeMockFetch(() => new Response("{}", { status: 500 })),
  });
}

describe("PresetsClient.list", () => {
  it("splits rows by type='preset' / 'userConf' and loads capabilities in parallel", async () => {
    const client = makeMockClient();
    const presetRow: AsPresetEntryRow = {
      id: "p1",
      type: "preset",
      app: "demo",
      tableKey: "products",
      user: "alice",
      data: { label: "Active customers" },
      createdAt: 0,
      updatedAt: 0,
    };
    const userConfRow: AsPresetEntryRow = {
      id: "uc:alice:demo:products",
      type: "userConf",
      app: "demo",
      tableKey: "products",
      user: "alice",
      data: { defaultPresetId: "p1" },
      createdAt: 0,
      updatedAt: 0,
    };
    client.query.mockResolvedValue([presetRow, userConfRow]);
    const fetchImpl = makeMockFetch(
      () =>
        new Response(JSON.stringify({ canPublish: true, presetLimit: 10, userId: "alice" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    const sut = build(client, fetchImpl);
    const result = await sut.list();

    expect(result.presets).toEqual([presetRow]);
    expect(result.userConf).toEqual(userConfRow);
    expect(result.capabilities).toEqual({ canPublish: true, presetLimit: 10, userId: "alice" });
    expect(result.denied).toBe(false);
    expect(client.query).toHaveBeenCalledWith({
      filter: { app: "demo", tableKey: "products", type: { $in: ["preset", "userConf"] } },
    });
  });

  it("collapses to denied=true on 401 from the list query", async () => {
    const client = makeMockClient();
    client.query.mockRejectedValue(authError(401));
    const fetchImpl = makeMockFetch(() => new Response("{}", { status: 200 }));
    const sut = build(client, fetchImpl);

    const result = await sut.list();

    expect(result).toEqual({
      presets: [],
      userConf: null,
      capabilities: null,
      denied: true,
    });
  });

  it("collapses to denied=true on 403", async () => {
    const client = makeMockClient();
    client.query.mockRejectedValue(authError(403));
    const sut = build(client);
    const result = await sut.list();
    expect(result.denied).toBe(true);
  });

  it("rethrows non-auth errors from the list query", async () => {
    const client = makeMockClient();
    client.query.mockRejectedValue(authError(500));
    const sut = build(client);
    await expect(sut.list()).rejects.toThrow();
  });

  it("returns capabilities=null when capabilities fetch fails (non-auth) but list succeeds", async () => {
    const client = makeMockClient();
    client.query.mockResolvedValue([]);
    const fetchImpl = makeMockFetch(() => new Response("oops", { status: 500 }));
    const sut = build(client, fetchImpl);

    const result = await sut.list();

    expect(result.denied).toBe(false);
    expect(result.capabilities).toBeNull();
  });

  it("collapses to denied=true when capabilities returns 401", async () => {
    const client = makeMockClient();
    client.query.mockResolvedValue([]);
    const fetchImpl = makeMockFetch(() => new Response("nope", { status: 401 }));
    const sut = build(client, fetchImpl);
    const result = await sut.list();
    expect(result.denied).toBe(true);
  });

  it("skips capabilities fetch when called with { capabilities: false }", async () => {
    const client = makeMockClient();
    client.query.mockResolvedValue([]);
    const fetchSpy = vi.fn(() => Promise.resolve(new Response("{}", { status: 200 })));
    const sut = build(client, fetchSpy as unknown as typeof globalThis.fetch);

    const result = await sut.list({ capabilities: false });

    // Capabilities side-channel never invoked.
    expect(fetchSpy).not.toHaveBeenCalled();
    // Caller signal: undefined means "don't touch the cached value".
    expect(result.capabilities).toBeUndefined();
  });
});

describe("PresetsClient.savePreset (overwrite)", () => {
  it("sends id + label + data.content — label is required by validator", async () => {
    const client = makeMockClient();
    client.update.mockResolvedValue({ id: "p1" });
    const sut = build(client);
    await sut.savePreset("p1", "Active customers", { columns: { columnNames: ["a", "b"] } });
    expect(client.update).toHaveBeenCalledWith({
      id: "p1",
      data: { label: "Active customers", content: { columns: { columnNames: ["a", "b"] } } },
    });
  });

  it("converts dict-form snapshot to wire form on save", async () => {
    const client = makeMockClient();
    client.update.mockResolvedValue({ id: "p1" });
    const sut = build(client);
    await sut.savePreset("p1", "x", {
      columns: { columnNames: ["a"], columnWidths: { a: "100px" } },
      filterOps: { status: [{ type: "eq", value: ["active"] }] },
    });
    const sentArg = client.update.mock.calls[0][0] as { data: { content: unknown } };
    expect(sentArg.data.content).toEqual({
      columns: {
        columnNames: ["a"],
        columnWidths: [{ field: "a", width: "100px" }],
      },
      filterOps: [{ field: "status", conditions: [{ type: "eq", value: ["active"] }] }],
    });
  });
});

describe("PresetsClient.savePresetAs", () => {
  it("creates a preset with type, app, tableKey, label, content and returns the new id", async () => {
    const client = makeMockClient();
    client.insert.mockResolvedValue({ insertedId: "new-id" });
    const sut = build(client);

    const result = await sut.savePresetAs(
      "My view",
      { sorters: [{ field: "name", direction: "asc" }] },
      { public: true },
    );

    expect(result).toEqual({ id: "new-id" });
    expect(client.insert).toHaveBeenCalledWith({
      type: "preset",
      app: "demo",
      tableKey: "products",
      public: true,
      data: {
        label: "My view",
        content: { sorters: [{ field: "name", direction: "asc" }] },
      },
    });
  });

  it("defaults public=false", async () => {
    const client = makeMockClient();
    client.insert.mockResolvedValue({ insertedId: "x" });
    const sut = build(client);
    await sut.savePresetAs("View", {});
    const sent = client.insert.mock.calls[0][0] as { public: boolean };
    expect(sent.public).toBe(false);
  });

  it("throws when the server response has no insertedId", async () => {
    const client = makeMockClient();
    client.insert.mockResolvedValue({});
    const sut = build(client);
    await expect(sut.savePresetAs("View", {})).rejects.toThrow(/did not return an id/);
  });
});

describe("PresetsClient mutators", () => {
  let client: MockClient;
  beforeEach(() => {
    client = makeMockClient();
    client.update.mockResolvedValue({});
    client.remove.mockResolvedValue({});
    client.insert.mockResolvedValue({ id: "new" });
  });

  it("renamePreset sends only label", async () => {
    await build(client).renamePreset("p1", "New name");
    expect(client.update).toHaveBeenCalledWith({ id: "p1", data: { label: "New name" } });
  });

  it("setPublic sends id + public flag", async () => {
    await build(client).setPublic("p1", true);
    expect(client.update).toHaveBeenCalledWith({ id: "p1", public: true });
  });

  it("deletePreset removes by id", async () => {
    await build(client).deletePreset("p1");
    expect(client.remove).toHaveBeenCalledWith("p1");
  });

  it("upsertUserConf updates when existing row provided", async () => {
    const existing: AsPresetEntryRow = {
      id: "uc:alice:demo:products",
      type: "userConf",
      app: "demo",
      tableKey: "products",
      user: "alice",
      data: { defaultPresetId: "old" },
      createdAt: 0,
      updatedAt: 0,
    };
    await build(client).upsertUserConf(existing, { defaultPresetId: "new" });
    expect(client.update).toHaveBeenCalledWith({
      id: "uc:alice:demo:products",
      data: { defaultPresetId: "new" },
    });
    expect(client.insert).not.toHaveBeenCalled();
  });

  it("upsertUserConf inserts when no existing row, omitting id", async () => {
    await build(client).upsertUserConf(null, { favPresetIds: ["a", "b"] });
    expect(client.insert).toHaveBeenCalledWith({
      type: "userConf",
      app: "demo",
      tableKey: "products",
      data: { favPresetIds: ["a", "b"] },
    });
    expect(client.update).not.toHaveBeenCalled();
  });

  it("upsertUserConf inserts with deterministic id when user is supplied", async () => {
    await build(client).upsertUserConf(null, { defaultPresetId: "p1" }, "alice");
    expect(client.insert).toHaveBeenCalledWith({
      id: "uc:alice:demo:products",
      type: "userConf",
      app: "demo",
      tableKey: "products",
      data: { defaultPresetId: "p1" },
    });
  });
});

describe("PresetsClient construction", () => {
  let restoreFetch: typeof globalThis.fetch | undefined;
  beforeEach(() => {
    restoreFetch = globalThis.fetch;
  });
  afterEach(() => {
    if (restoreFetch) globalThis.fetch = restoreFetch;
  });

  it("requires url, app, tableKey", () => {
    expect(() => new PresetsClient({ url: "", app: "demo", tableKey: "p" })).toThrow();
    expect(() => new PresetsClient({ url: "/x", app: "", tableKey: "p" })).toThrow();
    expect(() => new PresetsClient({ url: "/x", app: "demo", tableKey: "" })).toThrow();
  });
});

describe("isAuthError", () => {
  it("recognises ClientError 401/403", () => {
    expect(isAuthError(authError(401))).toBe(true);
    expect(isAuthError(authError(403))).toBe(true);
    expect(isAuthError(authError(500))).toBe(false);
  });

  it("returns false for plain Error", () => {
    expect(isAuthError(new Error("network"))).toBe(false);
    expect(isAuthError(null)).toBe(false);
  });
});
