import { ClientError } from "@atscript/db-client";
import type { Client } from "@atscript/db-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppPrefsClient } from "./app-prefs-client";
import type { AsPresetEntryRow } from "./preset-data-types";

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

function build(client: MockClient) {
  return new AppPrefsClient({
    url: "/db/_presets",
    app: "demo",
    client: client as unknown as Client,
  });
}

function authError(status: 401 | 403) {
  return new ClientError(status, { message: "x", statusCode: status, errors: [] });
}

describe("AppPrefsClient.load", () => {
  it("returns prefs from the first appConf row", async () => {
    const client = makeMockClient();
    const row: AsPresetEntryRow = {
      id: "ac:alice:demo",
      type: "appConf",
      app: "demo",
      user: "alice",
      data: { appearance: "dark", language: "en-US" },
      createdAt: 0,
      updatedAt: 0,
    };
    client.query.mockResolvedValue([row]);
    const sut = build(client);

    const result = await sut.load();

    expect(result).toEqual({
      row,
      prefs: { appearance: "dark", language: "en-US" },
      denied: false,
    });
    expect(client.query).toHaveBeenCalledWith({ filter: { app: "demo", type: "appConf" } });
  });

  it("returns prefs=null when no row exists", async () => {
    const client = makeMockClient();
    client.query.mockResolvedValue([]);
    const sut = build(client);
    const result = await sut.load();
    expect(result).toEqual({ row: null, prefs: null, denied: false });
  });

  it("collapses to denied=true on 401", async () => {
    const client = makeMockClient();
    client.query.mockRejectedValue(authError(401));
    const sut = build(client);
    const result = await sut.load();
    expect(result).toEqual({ row: null, prefs: null, denied: true });
  });

  it("collapses to denied=true on 403", async () => {
    const client = makeMockClient();
    client.query.mockRejectedValue(authError(403));
    const sut = build(client);
    const result = await sut.load();
    expect(result.denied).toBe(true);
  });

  it("rethrows non-auth errors", async () => {
    const client = makeMockClient();
    client.query.mockRejectedValue(new Error("network"));
    const sut = build(client);
    await expect(sut.load()).rejects.toThrow();
  });
});

describe("AppPrefsClient.save", () => {
  let client: MockClient;
  beforeEach(() => {
    client = makeMockClient();
    client.update.mockResolvedValue({});
    client.insert.mockResolvedValue({ insertedId: "ac:alice:demo" });
  });

  it("updates the existing row when present", async () => {
    const existing: AsPresetEntryRow = {
      id: "ac:alice:demo",
      type: "appConf",
      app: "demo",
      user: "alice",
      data: { appearance: "light" },
      createdAt: 0,
      updatedAt: 0,
    };
    await build(client).save(existing, { appearance: "dark" });
    expect(client.update).toHaveBeenCalledWith({
      id: "ac:alice:demo",
      data: { appearance: "dark" },
    });
    expect(client.insert).not.toHaveBeenCalled();
  });

  it("inserts when no row exists, omitting id (server forces from session)", async () => {
    await build(client).save(null, { density: "compact" });
    expect(client.insert).toHaveBeenCalledWith({
      type: "appConf",
      app: "demo",
      data: { density: "compact" },
    });
    expect(client.update).not.toHaveBeenCalled();
  });

  it("inserts with deterministic id when user is supplied", async () => {
    await build(client).save(null, { language: "en-GB" }, "alice");
    expect(client.insert).toHaveBeenCalledWith({
      id: "ac:alice:demo",
      type: "appConf",
      app: "demo",
      data: { language: "en-GB" },
    });
  });

  it("save patch is partial — only the changed fields ship", async () => {
    const existing: AsPresetEntryRow = {
      id: "ac:alice:demo",
      type: "appConf",
      app: "demo",
      user: "alice",
      data: { appearance: "light", language: "en", density: "cozy" },
      createdAt: 0,
      updatedAt: 0,
    };
    await build(client).save(existing, { appearance: "dark" });
    const sent = client.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(Object.keys(sent.data)).toEqual(["appearance"]);
  });
});

describe("AppPrefsClient construction", () => {
  it("requires url and app", () => {
    expect(() => new AppPrefsClient({ url: "", app: "x" })).toThrow();
    expect(() => new AppPrefsClient({ url: "/y", app: "" })).toThrow();
  });
});
