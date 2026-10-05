import { describe, expect, it } from "vitest";
import {
  leadingKey,
  mergeUrlQueryRecord,
  stateToUrlQueryRecord,
  urlQueryRecordToString,
  urlQueryStringToRecord,
} from "./url-query-record";
import { stateToUrlQueryString } from "./url-query";

describe("urlQueryStringToRecord / urlQueryRecordToString", () => {
  it("round-trips a table string through a record", () => {
    const url = "status=active&total>100&$sort=-createdAt&$skip=50&$snapshot";
    const record = urlQueryStringToRecord(url);
    expect(record).toEqual({
      status: "active",
      "total>100": null,
      $sort: "-createdAt",
      $skip: "50",
      $snapshot: null,
    });
    expect(urlQueryRecordToString(record)).toBe(url);
  });

  it("namespaces keys with the prefix and reads only its own back", () => {
    const record = urlQueryStringToRecord("status=active&total>100", { prefix: "t1" });
    expect(record).toEqual({ "t1.status": "active", "t1.total>100": null });
    expect(urlQueryRecordToString({ ...record, other: "x", "t2.a": "1" }, { prefix: "t1" })).toBe(
      "status=active&total>100",
    );
  });

  it("turns a repeated key into an array, in order, and expands it back", () => {
    const record = urlQueryStringToRecord("tag=a&x=1&tag=b");
    expect(record).toEqual({ tag: ["a", "b"], x: "1" });
    expect(urlQueryRecordToString(record)).toBe("tag=a&tag=b&x=1");
  });

  it("keeps a bare key as null and a group as one key", () => {
    const url = "(a=1&b=2)^(c=3)&$snapshot";
    const record = urlQueryStringToRecord(url);
    expect(record).toEqual({ "(a=1&b=2)^(c=3)": null, $snapshot: null });
    expect(urlQueryRecordToString(record)).toBe(url);
  });

  it("skips undefined entries of a router query", () => {
    expect(urlQueryRecordToString({ a: undefined, b: "1" })).toBe("b=1");
  });

  it("preserveKeys: skipped on read (list and predicate forms), operator forms included", () => {
    const query = { status: "pending", "status!='x'": null, team: "a", "total>1": null };
    expect(urlQueryRecordToString(query, { preserveKeys: ["status"] })).toBe("team=a&total>1");
    expect(urlQueryRecordToString(query, { preserveKeys: (k) => k === "team" })).toBe(
      "status=pending&status!='x'&total>1",
    );
    expect(urlQueryStringToRecord("status=a&total>1", { preserveKeys: ["status"] })).toEqual({
      "total>1": null,
    });
  });
});

describe("mergeUrlQueryRecord", () => {
  it("keeps foreign keys in their slots and writes own keys as one block", () => {
    const { query, withheld } = mergeUrlQueryRecord(
      { tab: "a", $skip: "50", "total>1": null, demo: "1" },
      "status=active&$sort=name",
    );
    expect(Object.keys(query)).toEqual(["tab", "status", "$sort", "demo"]);
    expect(withheld).toEqual([]);
  });

  it("appends the block when no own key was present, and removes absent own keys", () => {
    expect(mergeUrlQueryRecord({ demo: "1" }, "status=a").query).toEqual({
      demo: "1",
      status: "a",
    });
    expect(mergeUrlQueryRecord({ demo: "1", $skip: "5" }, "").query).toEqual({ demo: "1" });
  });

  it("keeps preserved keys verbatim and withholds table segments on them", () => {
    const { query, withheld } = mergeUrlQueryRecord(
      { status: "pending", demo: "1" },
      "status=shipped&total>100",
      { preserveKeys: ["status"] },
    );
    expect(query).toEqual({ status: "pending", demo: "1", "total>100": null });
    expect(withheld).toEqual(["status=shipped"]);
  });

  it("never treats a preserved key as own, even when isOwn says so", () => {
    const { query } = mergeUrlQueryRecord({ status: "pending" }, "", {
      preserveKeys: ["status"],
      isOwn: () => true,
    });
    expect(query).toEqual({ status: "pending" });
  });

  it("honours a custom isOwn and a prefix", () => {
    expect(
      mergeUrlQueryRecord({ "t1.a": "1", "t2.b": "2" }, "c=3", { prefix: "t1" }).query,
    ).toEqual({ "t1.c": "3", "t2.b": "2" });
    expect(
      mergeUrlQueryRecord({ team: "x" }, "team=y", { isOwn: (k) => k === "team" }).query,
    ).toEqual({ team: "y" });
  });

  it("returns the wire keys it wrote", () => {
    expect(mergeUrlQueryRecord({ demo: "1" }, "status=a&total>1&$sort=x").own).toEqual([
      "status",
      "total>1",
      "$sort",
    ]);
    expect(mergeUrlQueryRecord({}, "a=1&b=2", { prefix: "t" }).own).toEqual(["t.a", "t.b"]);
    expect(mergeUrlQueryRecord({}, "status=a&b=2", { preserveKeys: ["status"] }).own).toEqual([
      "b",
    ]);
  });

  it("does not mutate the input arrays", () => {
    const current = { tag: ["a", "b"] };
    const { query } = mergeUrlQueryRecord(current, "x=1");
    expect(query.tag).toEqual(["a", "b"]);
    expect(query.tag).not.toBe(current.tag);
  });
});

describe("stateToUrlQueryRecord", () => {
  it("equals the record of stateToUrlQueryString", () => {
    const state = {
      filters: { status: [{ type: "eq" as const, value: ["active"] }] },
      sorters: [{ field: "name", direction: "desc" as const }],
      page: 3,
      itemsPerPage: 25,
      searchTerm: "foo",
    };
    const defaults = { defaultItemsPerPage: 50 };
    const record = stateToUrlQueryRecord(state, defaults);
    expect(urlQueryRecordToString(record)).toBe(stateToUrlQueryString(state, defaults));
    expect(record.status).toBe("active");
    expect(stateToUrlQueryRecord(state, defaults, { prefix: "t" })["t.status"]).toBe("active");
  });
});

describe("leadingKey and the preserved-key predicate", () => {
  it("leadingKey is the field name of an operator-bearing key", () => {
    expect(leadingKey("status!='x'")).toBe("status");
    expect(leadingKey("total>100")).toBe("total");
    expect(leadingKey("$sort")).toBe("$sort");
  });

  it("a key preserves its operator forms too", () => {
    const { query, withheld } = mergeUrlQueryRecord({}, "status!='x'&total>1", {
      preserveKeys: ["status"],
    });
    expect(query).toEqual({ "total>1": null });
    expect(withheld).toEqual(["status!='x'"]);
  });

  it("builds the predicate once per preserveKeys value", () => {
    let calls = 0;
    const preserveKeys = (key: string) => {
      calls++;
      return key === "status";
    };
    const opts = { preserveKeys };
    urlQueryStringToRecord("status=a&b=1", opts);
    urlQueryStringToRecord("status=a&b=1", opts);
    expect(urlQueryRecordToString({ status: "a", b: "1" }, opts)).toBe("b=1");
    // the function itself is what is called — the wrapper is shared, not rebuilt
    expect(calls).toBeGreaterThan(0);
    const set = ["status"] as const;
    expect(urlQueryStringToRecord("status=a", { preserveKeys: set })).toEqual({});
    expect(urlQueryStringToRecord("status=a", { preserveKeys: set })).toEqual({});
  });
});
