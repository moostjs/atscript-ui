import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMetaCache } from "../shared/meta-cache";
import {
  ValueHelpClient,
  invalidateValueHelpCache,
  setValueHelpCacheTtl,
} from "./value-help-client";
import type { ResolvedValueHelp } from "./resolve";

function resolved(over: Partial<ResolvedValueHelp> = {}): ResolvedValueHelp {
  return {
    url: "/attribute-values",
    primaryKeys: ["attribute", "value"],
    labelField: "label",
    descrField: undefined,
    attrFields: [],
    filterableFields: [],
    sortableFields: [],
    searchable: false,
    targetType: undefined as never,
    ...over,
  };
}

function setup() {
  const query = vi.fn().mockResolvedValue([]);
  return { query, vh: new ValueHelpClient({ query } as never) };
}

describe("ValueHelpClient.search", () => {
  it("sends the static filter alone when there is no search text", async () => {
    const { query, vh } = setup();
    const filter = { attribute: { $eq: "color" } };
    await vh.search(resolved(), { filter: filter as never });
    expect(query).toHaveBeenCalledWith({
      filter,
      controls: { $select: ["attribute", "value", "label"], $limit: 20 },
    });
  });

  it("ANDs the static filter with the non-searchable $or search, matching exactly on the value field", async () => {
    const { query, vh } = setup();
    const filter = { attribute: { $eq: "color" } };
    await vh.search(resolved(), { text: "bl", filter: filter as never, valueField: "value" });
    const arg = query.mock.calls[0][0];
    expect(arg.filter.$and[0]).toEqual(filter);
    const or = arg.filter.$and[1].$or;
    // regex over the select fields except the exact-match key …
    expect(or).toContainEqual({ attribute: { $regex: "/^bl/i" } });
    expect(or).toContainEqual({ label: { $regex: "/^bl/i" } });
    expect(or).not.toContainEqual({ value: { $regex: "/^bl/i" } });
    // … and an exact match on `value`, not on primaryKeys[0] (`attribute`)
    expect(or).toContainEqual({ value: "bl" });
    expect(or).not.toContainEqual({ attribute: "bl" });
  });

  it("selects the value field even when it is not a key or label (unique non-PK)", async () => {
    const { query, vh } = setup();
    await vh.search(resolved({ primaryKeys: ["id"], labelField: "name" }), { valueField: "code" });
    expect(query.mock.calls[0][0].controls.$select).toEqual(["id", "name", "code"]);
  });

  it("keeps $search server-side and AND-able with the static filter", async () => {
    const { query, vh } = setup();
    const filter = { attribute: { $eq: "color" } };
    await vh.search(resolved({ searchable: true }), { text: "bl", filter: filter as never });
    expect(query).toHaveBeenCalledWith({
      filter,
      controls: { $select: ["attribute", "value", "label"], $limit: 20, $search: "bl" },
    });
  });

  it("defaults the exact-match key to primaryKeys[0] (unchanged for single-key dictionaries)", async () => {
    const { query, vh } = setup();
    await vh.search(resolved({ primaryKeys: ["id"], labelField: "name" }), { text: "7" });
    expect(query.mock.calls[0][0].filter.$or).toContainEqual({ id: 7 });
  });
});

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("ValueHelpClient search sharing", () => {
  const rows = [{ attribute: "color", value: "red", label: "Red" }];
  function deferredClient() {
    const pending: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];
    const query = vi.fn(
      () =>
        new Promise((resolve, reject) => {
          pending.push({ resolve, reject });
        }),
    );
    return { query, pending, client: { query } as never };
  }

  beforeEach(() => {
    vi.stubGlobal("window", {});
    invalidateValueHelpCache();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    setValueHelpCacheTtl(5000);
  });

  it("N identical searches on one client share one request; each caller gets its own array", async () => {
    const { query, pending, client } = deferredClient();
    const calls = Array.from({ length: 50 }, () =>
      new ValueHelpClient(client).search(resolved(), { valueField: "value" }),
    );
    expect(query).toHaveBeenCalledTimes(1);
    pending[0]!.resolve(rows);
    const results = await Promise.all(calls);
    expect(results[0]!.items).toEqual(rows);
    expect(results[0]!.items).not.toBe(results[1]!.items);
    expect(results[0]!.items[0]).toBe(results[1]!.items[0]);
  });

  it("reuses a settled result within the TTL; differing text / limit / filter / mode do not share", async () => {
    const query = vi.fn().mockResolvedValue(rows);
    const vh = new ValueHelpClient({ query } as never);
    await vh.search(resolved(), { text: "re" });
    await vh.search(resolved(), { text: "re" });
    expect(query).toHaveBeenCalledTimes(1);
    await vh.search(resolved(), { text: "r" });
    await vh.search(resolved(), { text: "re", limit: 5 });
    await vh.search(resolved(), { text: "re", filter: { attribute: "size" } as never });
    await vh.search(resolved(), { text: "re", mode: "filter", select: ["label"] });
    expect(query).toHaveBeenCalledTimes(5);
  });

  it("different Client instances never share", async () => {
    const a = vi.fn().mockResolvedValue(rows);
    const b = vi.fn().mockResolvedValue(rows);
    await new ValueHelpClient({ query: a } as never).search(resolved());
    await new ValueHelpClient({ query: b } as never).search(resolved());
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("TTL 0 shares only in-flight searches; a negative TTL shares nothing", async () => {
    setValueHelpCacheTtl(0);
    const query = vi.fn().mockResolvedValue(rows);
    const vh = new ValueHelpClient({ query } as never);
    await Promise.all([vh.search(resolved()), vh.search(resolved())]);
    expect(query).toHaveBeenCalledTimes(1);
    await vh.search(resolved());
    expect(query).toHaveBeenCalledTimes(2);
    setValueHelpCacheTtl(-1);
    await Promise.all([vh.search(resolved()), vh.search(resolved())]);
    expect(query).toHaveBeenCalledTimes(4);
  });

  it("a failed search is not cached — the next call retries", async () => {
    const query = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue(rows);
    const vh = new ValueHelpClient({ query } as never);
    await expect(vh.search(resolved())).rejects.toThrow("down");
    await expect(vh.search(resolved())).resolves.toEqual({ items: rows });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("invalidateValueHelpCache(client) and resetMetaCache() force a refetch, also past an in-flight request", async () => {
    const { query, pending, client } = deferredClient();
    const vh = new ValueHelpClient(client);
    const first = vh.search(resolved());
    invalidateValueHelpCache(client);
    const second = vh.search(resolved());
    expect(query).toHaveBeenCalledTimes(2);
    pending[0]!.resolve(rows);
    pending[1]!.resolve(rows);
    await Promise.all([first, second]);
    await flush();
    resetMetaCache();
    const third = vh.search(resolved());
    expect(query).toHaveBeenCalledTimes(3);
    pending[2]!.resolve(rows);
    await third;
  });

  it("never shares without a browser window (server rendering serves many viewers)", async () => {
    vi.unstubAllGlobals();
    const query = vi.fn().mockResolvedValue(rows);
    const vh = new ValueHelpClient({ query } as never);
    await Promise.all([vh.search(resolved()), vh.search(resolved())]);
    expect(query).toHaveBeenCalledTimes(2);
  });
});
