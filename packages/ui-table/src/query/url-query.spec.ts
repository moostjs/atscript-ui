import { describe, expect, it, vi } from "vitest";
import {
  URL_SNAPSHOT_KEY,
  gateOwns,
  resolveAspectGate,
  stateToUrlQueryString,
  urlQueryConsumesKey,
  urlQueryStringToState,
} from "./url-query";
import { uniqueryFilterToFieldFilters } from "../filters/uniquery-to-filters";
import { filtersToUniqueryFilter } from "../filters/filters-to-uniquery";
import type { FieldFilters } from "../filters/filter-types";
import { parseFilterInput } from "../filters/filter-input-format";

const DEFAULTS = { defaultItemsPerPage: 50 };

describe("stateToUrlQueryString — encoding", () => {
  it("returns the bare snapshot marker for the default view", () => {
    expect(
      stateToUrlQueryString({ filters: {}, sorters: [], page: 1, searchTerm: "" }, DEFAULTS),
    ).toBe("$snapshot");
  });

  it("encodes filters via the existing Uniquery format", () => {
    const filters: FieldFilters = { status: [{ type: "eq", value: ["active"] }] };
    expect(stateToUrlQueryString({ filters, sorters: [] }, DEFAULTS)).toBe(
      "status=active&$snapshot",
    );
  });

  it("encodes sorters with - prefix for desc", () => {
    expect(
      stateToUrlQueryString(
        {
          filters: {},
          sorters: [
            { field: "createdAt", direction: "desc" },
            { field: "name", direction: "asc" },
          ],
        },
        DEFAULTS,
      ),
    ).toBe("$sort=-createdAt,name&$snapshot");
  });

  it("encodes searchTerm as $search", () => {
    expect(stateToUrlQueryString({ filters: {}, sorters: [], searchTerm: "foo" }, DEFAULTS)).toBe(
      "$search=foo&$snapshot",
    );
  });

  it("omits $skip when page is 1", () => {
    expect(stateToUrlQueryString({ filters: {}, sorters: [], page: 1 }, DEFAULTS)).toBe(
      "$snapshot",
    );
  });

  it("encodes page > 1 as $skip", () => {
    expect(
      stateToUrlQueryString({ filters: {}, sorters: [], page: 3, itemsPerPage: 50 }, DEFAULTS),
    ).toBe("$skip=100&$snapshot");
  });

  it("never emits $limit (page size is a private user preference)", () => {
    // Default itemsPerPage:
    expect(stateToUrlQueryString({ filters: {}, sorters: [], itemsPerPage: 50 }, DEFAULTS)).toBe(
      "$snapshot",
    );
    // Non-default itemsPerPage — still no $limit; only the offset is shareable.
    expect(stateToUrlQueryString({ filters: {}, sorters: [], itemsPerPage: 25 }, DEFAULTS)).toBe(
      "$snapshot",
    );
  });

  it("$skip uses the linker's itemsPerPage to compute offset (records, not pages)", () => {
    // Page 3 at size 25 → records 50..74 → $skip=50.
    expect(
      stateToUrlQueryString({ filters: {}, sorters: [], page: 3, itemsPerPage: 25 }, DEFAULTS),
    ).toBe("$skip=50&$snapshot");
  });

  it("composes filter + sort + page + search (no $limit)", () => {
    const out = stateToUrlQueryString(
      {
        filters: { status: [{ type: "eq", value: ["active"] }] },
        sorters: [{ field: "createdAt", direction: "desc" }],
        page: 2,
        itemsPerPage: 25,
        searchTerm: "foo",
      },
      DEFAULTS,
    );
    expect(out).toBe("status=active&$sort=-createdAt&$skip=25&$search=foo&$snapshot");
  });
});

describe("urlQueryStringToState — decoding", () => {
  it("returns zeroed state for empty string", () => {
    expect(urlQueryStringToState("")).toEqual({
      filters: {},
      sorters: [],
      searchTerm: "",
    });
  });

  it("decodes filters", () => {
    const out = urlQueryStringToState("status=active");
    expect(out.filters).toEqual({ status: [{ type: "eq", value: ["active"] }] });
  });

  it("decodes sorters", () => {
    const out = urlQueryStringToState("$sort=-createdAt,name");
    expect(out.sorters).toEqual([
      { field: "createdAt", direction: "desc" },
      { field: "name", direction: "asc" },
    ]);
  });

  it("decodes searchTerm", () => {
    const out = urlQueryStringToState("$search=foo");
    expect(out.searchTerm).toBe("foo");
  });

  it("ignores $limit on the wire (recipient keeps their own page size)", () => {
    // URL says $limit=50; decoder ignores it. Only the raw $skip survives —
    // the consumer divides by their own current itemsPerPage to pick a page.
    const out = urlQueryStringToState("$skip=100&$limit=50");
    expect(out.skip).toBe(100);
  });

  it("returns raw $skip; page math is the consumer's responsibility", () => {
    const out = urlQueryStringToState("$skip=50");
    expect(out.skip).toBe(50);
  });

  it("omits skip when URL has no $skip", () => {
    const out = urlQueryStringToState("status=active");
    expect(out.skip).toBeUndefined();
  });

  // ── Schema-drift tolerance — silent drops ─────────────────

  it("drops conditions on unknown fields", () => {
    const out = urlQueryStringToState("status=active&bogus=42", {
      knownFields: ["status"],
    });
    expect(out.filters).toEqual({ status: [{ type: "eq", value: ["active"] }] });
  });

  it("drops sorters on unknown fields", () => {
    const out = urlQueryStringToState("$sort=-knownField,unknownField", {
      knownFields: ["knownField"],
    });
    expect(out.sorters).toEqual([{ field: "knownField", direction: "desc" }]);
  });

  it("ignores unknown controls without throwing", () => {
    const out = urlQueryStringToState("status=active&$weird=42&$another=x");
    expect(out.filters).toEqual({ status: [{ type: "eq", value: ["active"] }] });
    expect(out.sorters).toEqual([]);
  });

  it("returns zeroed state on malformed input", () => {
    const out = urlQueryStringToState("@@@(((not a query");
    expect(out.filters).toEqual({});
    expect(out.sorters).toEqual([]);
    expect(out.searchTerm).toBe("");
  });
});

describe("uniqueryFilterToFieldFilters — operator coverage", () => {
  it("decodes bare primitive as eq", () => {
    expect(uniqueryFilterToFieldFilters({ status: "active" })).toEqual({
      status: [{ type: "eq", value: ["active"] }],
    });
  });

  it("decodes $ne", () => {
    expect(uniqueryFilterToFieldFilters({ status: { $ne: "deleted" } })).toEqual({
      status: [{ type: "ne", value: ["deleted"] }],
    });
  });

  it("decodes $gt / $lt", () => {
    expect(uniqueryFilterToFieldFilters({ age: { $gt: 18 } })).toEqual({
      age: [{ type: "gt", value: [18] }],
    });
    expect(uniqueryFilterToFieldFilters({ price: { $lt: 100 } })).toEqual({
      price: [{ type: "lt", value: [100] }],
    });
  });

  it("collapses $gte + $lte into bw", () => {
    expect(uniqueryFilterToFieldFilters({ age: { $gte: 18, $lte: 65 } })).toEqual({
      age: [{ type: "bw", value: [18, 65] }],
    });
  });

  it("decodes $exists:false → null, $exists:true → notNull", () => {
    expect(uniqueryFilterToFieldFilters({ note: { $exists: false } })).toEqual({
      note: [{ type: "null", value: [] }],
    });
    expect(uniqueryFilterToFieldFilters({ note: { $exists: true } })).toEqual({
      note: [{ type: "notNull", value: [] }],
    });
  });

  it("decodes /…/i regex as contains", () => {
    expect(uniqueryFilterToFieldFilters({ name: { $regex: "/foo/i" } })).toEqual({
      name: [{ type: "contains", value: ["foo"] }],
    });
  });

  it("decodes /^foo/i as starts", () => {
    expect(uniqueryFilterToFieldFilters({ name: { $regex: "/^foo/i" } })).toEqual({
      name: [{ type: "starts", value: ["foo"] }],
    });
  });

  it("decodes /foo$/i as ends", () => {
    expect(uniqueryFilterToFieldFilters({ name: { $regex: "/foo$/i" } })).toEqual({
      name: [{ type: "ends", value: ["foo"] }],
    });
  });

  it("flattens $and branches", () => {
    const expr = {
      $and: [{ status: "active" }, { age: { $gte: 18 } }],
    };
    expect(uniqueryFilterToFieldFilters(expr)).toEqual({
      status: [{ type: "eq", value: ["active"] }],
      age: [{ type: "gte", value: [18] }],
    });
  });

  it("merges same-field $or branches into the field's OR'd conditions", () => {
    const expr = {
      $or: [{ status: "active" }, { status: "pending" }],
    };
    expect(uniqueryFilterToFieldFilters(expr)).toEqual({
      status: [
        { type: "eq", value: ["active"] },
        { type: "eq", value: ["pending"] },
      ],
    });
  });

  it("inverts a $not of equality", () => {
    expect(uniqueryFilterToFieldFilters({ $not: { status: "deleted" } })).toEqual({
      status: [{ type: "ne", value: ["deleted"] }],
    });
  });

  it("leaves out unknown operators (reported) and keeps the known ones", () => {
    const onUnsupported = vi.fn();
    expect(
      uniqueryFilterToFieldFilters(
        { name: { $weirdOp: "x", $eq: "ok" } },
        undefined,
        onUnsupported,
      ),
    ).toEqual({
      name: [{ type: "eq", value: ["ok"] }],
    });
    expect(onUnsupported).toHaveBeenCalledTimes(1);
  });

  it("returns {} for undefined input", () => {
    expect(uniqueryFilterToFieldFilters(undefined)).toEqual({});
  });
});

describe("round-trip — filters via Uniquery encoder + URL bridge", () => {
  function roundTrip(filters: FieldFilters): FieldFilters {
    return uniqueryFilterToFieldFilters(filtersToUniqueryFilter(filters));
  }

  it("eq", () => {
    const f: FieldFilters = { status: [{ type: "eq", value: ["active"] }] };
    expect(roundTrip(f)).toEqual(f);
  });

  it("ne", () => {
    const f: FieldFilters = { status: [{ type: "ne", value: ["deleted"] }] };
    expect(roundTrip(f)).toEqual(f);
  });

  it("gt / gte / lt / lte (single)", () => {
    expect(roundTrip({ age: [{ type: "gt", value: [18] }] })).toEqual({
      age: [{ type: "gt", value: [18] }],
    });
    expect(roundTrip({ age: [{ type: "gte", value: [18] }] })).toEqual({
      age: [{ type: "gte", value: [18] }],
    });
    expect(roundTrip({ price: [{ type: "lt", value: [100] }] })).toEqual({
      price: [{ type: "lt", value: [100] }],
    });
    expect(roundTrip({ price: [{ type: "lte", value: [100] }] })).toEqual({
      price: [{ type: "lte", value: [100] }],
    });
  });

  it("bw", () => {
    const f: FieldFilters = { age: [{ type: "bw", value: [18, 65] }] };
    expect(roundTrip(f)).toEqual(f);
  });

  it("contains / starts / ends", () => {
    expect(roundTrip({ name: [{ type: "contains", value: ["foo"] }] })).toEqual({
      name: [{ type: "contains", value: ["foo"] }],
    });
    expect(roundTrip({ name: [{ type: "starts", value: ["foo"] }] })).toEqual({
      name: [{ type: "starts", value: ["foo"] }],
    });
    expect(roundTrip({ name: [{ type: "ends", value: ["foo"] }] })).toEqual({
      name: [{ type: "ends", value: ["foo"] }],
    });
  });

  it("null / notNull", () => {
    expect(roundTrip({ note: [{ type: "null", value: [] }] })).toEqual({
      note: [{ type: "null", value: [] }],
    });
    expect(roundTrip({ note: [{ type: "notNull", value: [] }] })).toEqual({
      note: [{ type: "notNull", value: [] }],
    });
  });

  // Regression: a boolean column filter typed as `false` used to serialize as
  // the quoted string "false" and match nothing.
  it("boolean values stay booleans", () => {
    expect(roundTrip({ archived: [{ type: "eq", value: [true] }] })).toEqual({
      archived: [{ type: "eq", value: [true] }],
    });
    expect(roundTrip({ archived: [{ type: "eq", value: [false] }] })).toEqual({
      archived: [{ type: "eq", value: [false] }],
    });
    expect(roundTrip({ archived: [{ type: "ne", value: [false] }] })).toEqual({
      archived: [{ type: "ne", value: [false] }],
    });
  });
});

describe("boolean filter input → URL → state", () => {
  it("round-trips a typed `false` as a real boolean", () => {
    for (const [text, expected] of [
      ["true", true],
      ["false", false],
    ] as const) {
      const cond = parseFilterInput(text, "boolean")!;
      expect(cond.value).toEqual([expected]);
      const url = stateToUrlQueryString(
        { filters: { archived: [cond] }, sorters: [], searchTerm: "" },
        DEFAULTS,
      );
      const parsed = urlQueryStringToState(url, { knownFields: ["archived"] });
      expect(parsed.filters).toEqual({ archived: [{ type: "eq", value: [expected] }] });
    }
  });
});

describe("round-trip — full state via URL string", () => {
  it("preserves filters + sorters + searchTerm + raw skip", () => {
    const state = {
      filters: {
        status: [{ type: "eq" as const, value: ["active"] }],
        age: [{ type: "bw" as const, value: [18, 65] }],
      },
      sorters: [
        { field: "createdAt", direction: "desc" as const },
        { field: "name", direction: "asc" as const },
      ],
      page: 3,
      itemsPerPage: 25,
      searchTerm: "foo bar",
    };
    const url = stateToUrlQueryString(state, DEFAULTS);
    const back = urlQueryStringToState(url);
    expect(back.filters).toEqual(state.filters);
    expect(back.sorters).toEqual(state.sorters);
    // Raw offset survives the round-trip; consumer computes page from this.
    expect(back.skip).toBe((state.page - 1) * state.itemsPerPage);
    expect(back.searchTerm).toBe(state.searchTerm);
  });

  it("consumer reproduces the same page when their itemsPerPage matches the linker's", () => {
    // Linker on size 25, page 4 → $skip=75. Recipient also on size 25:
    // page = floor(75 / 25) + 1 = 4.
    const url = stateToUrlQueryString(
      { filters: {}, sorters: [], page: 4, itemsPerPage: 25 },
      DEFAULTS,
    );
    expect(url).toBe("$skip=75&$snapshot");
    const back = urlQueryStringToState(url);
    const recipientSize = 25;
    expect(Math.floor((back.skip ?? 0) / recipientSize) + 1).toBe(4);
  });

  it("consumer with a different itemsPerPage lands on a containing page", () => {
    // Linker on size 25, page 4 → $skip=75. Recipient on size 50:
    // page = floor(75 / 50) + 1 = 2 → records 50–99 (contains linker's 75–99).
    const url = stateToUrlQueryString(
      { filters: {}, sorters: [], page: 4, itemsPerPage: 25 },
      DEFAULTS,
    );
    const back = urlQueryStringToState(url);
    const recipientSize = 50;
    expect(Math.floor((back.skip ?? 0) / recipientSize) + 1).toBe(2);
  });

  it("default view round-trips through the bare marker", () => {
    const url = stateToUrlQueryString({ filters: {}, sorters: [] }, DEFAULTS);
    expect(url).toBe("$snapshot");
    const back = urlQueryStringToState(url);
    expect(back).toEqual({ filters: {}, sorters: [], searchTerm: "", snapshot: true });
  });
});

// ── $relevance (ignoreSorters flag) ───────────────────────────

describe("$relevance — ignoreSorters round-trip", () => {
  it("omits $relevance when the flag equals the default", () => {
    expect(
      stateToUrlQueryString(
        { filters: {}, sorters: [], searchTerm: "foo", ignoreSorters: false },
        DEFAULTS,
      ),
    ).toBe("$search=foo&$snapshot");
    expect(
      stateToUrlQueryString(
        { filters: {}, sorters: [], searchTerm: "foo", ignoreSorters: true },
        { ...DEFAULTS, defaultIgnoreSorters: true },
      ),
    ).toBe("$search=foo&$snapshot");
  });

  it("emits $relevance=1 when flag is true and default is false", () => {
    expect(
      stateToUrlQueryString(
        { filters: {}, sorters: [], searchTerm: "foo", ignoreSorters: true },
        DEFAULTS,
      ),
    ).toBe("$search=foo&$relevance=1&$snapshot");
  });

  it("emits $relevance=0 when flag is false and default is true", () => {
    expect(
      stateToUrlQueryString(
        {
          filters: {},
          sorters: [{ field: "name", direction: "asc" }],
          searchTerm: "foo",
          ignoreSorters: false,
        },
        { ...DEFAULTS, defaultIgnoreSorters: true },
      ),
    ).toBe("$sort=name&$search=foo&$relevance=0&$snapshot");
  });

  it("omits $relevance without a search term (flag is meaningless)", () => {
    expect(
      stateToUrlQueryString(
        { filters: {}, sorters: [], searchTerm: "", ignoreSorters: true },
        DEFAULTS,
      ),
    ).toBe("$snapshot");
  });

  it("omits $relevance when search sync is off", () => {
    expect(
      stateToUrlQueryString(
        { filters: {}, sorters: [], searchTerm: "foo", ignoreSorters: true },
        { ...DEFAULTS, sync: { search: false } },
      ),
    ).toBe("$snapshot");
  });

  it("decodes $relevance=1 / $relevance=0", () => {
    expect(urlQueryStringToState("$search=foo&$relevance=1").ignoreSorters).toBe(true);
    expect(urlQueryStringToState("$search=foo&$relevance=0").ignoreSorters).toBe(false);
  });

  it("leaves ignoreSorters undefined when the URL has no $relevance", () => {
    expect(urlQueryStringToState("$search=foo").ignoreSorters).toBeUndefined();
  });

  it("ignores $relevance when search sync is off", () => {
    expect(
      urlQueryStringToState("$search=foo&$relevance=1", { sync: { search: false } }).ignoreSorters,
    ).toBeUndefined();
  });

  it("round-trips mid-search explicit sort + flag", () => {
    const url = stateToUrlQueryString(
      {
        filters: {},
        sorters: [{ field: "createdAt", direction: "desc" }],
        searchTerm: "foo",
        ignoreSorters: true,
      },
      DEFAULTS,
    );
    const back = urlQueryStringToState(url);
    expect(back.sorters).toEqual([{ field: "createdAt", direction: "desc" }]);
    expect(back.searchTerm).toBe("foo");
    expect(back.ignoreSorters).toBe(true);
  });
});

// ── urlQuerySync ──────────────────────────────────────────────

const FULL_STATE = {
  filters: {
    status: [{ type: "eq" as const, value: ["active"] }],
    name: [{ type: "contains" as const, value: ["foo"] }],
  },
  sorters: [
    { field: "createdAt", direction: "desc" as const },
    { field: "name", direction: "asc" as const },
  ],
  page: 3,
  itemsPerPage: 25,
  searchTerm: "bar",
};

describe("urlQuerySync — encoder gating", () => {
  it("filters: false → no field segments", () => {
    const out = stateToUrlQueryString(FULL_STATE, { ...DEFAULTS, sync: { filters: false } });
    expect(out).not.toContain("status=");
    expect(out).not.toContain("name=contains:");
    expect(out).toContain("$sort=");
  });

  it("filters: [] is equivalent to filters: false", () => {
    const a = stateToUrlQueryString(FULL_STATE, { ...DEFAULTS, sync: { filters: false } });
    const b = stateToUrlQueryString(FULL_STATE, { ...DEFAULTS, sync: { filters: [] } });
    expect(a).toBe(b);
  });

  it("filters: ['status'] keeps only status", () => {
    const out = stateToUrlQueryString(FULL_STATE, {
      ...DEFAULTS,
      sync: { filters: ["status"] },
    });
    expect(out).toContain("status=active");
    expect(out).not.toContain("name=");
  });

  it("sorters: false → no $sort", () => {
    const out = stateToUrlQueryString(FULL_STATE, { ...DEFAULTS, sync: { sorters: false } });
    expect(out).not.toContain("$sort=");
    expect(out).toContain("status=active");
  });

  it("sorters: ['createdAt'] keeps only createdAt", () => {
    const out = stateToUrlQueryString(FULL_STATE, {
      ...DEFAULTS,
      sync: { sorters: ["createdAt"] },
    });
    expect(out).toContain("$sort=-createdAt");
    expect(out).not.toContain(",name");
  });

  it("search: false → no $search", () => {
    const out = stateToUrlQueryString(FULL_STATE, { ...DEFAULTS, sync: { search: false } });
    expect(out).not.toContain("$search=");
  });

  it("pagination: false → no $skip / $limit", () => {
    const out = stateToUrlQueryString(FULL_STATE, { ...DEFAULTS, sync: { pagination: false } });
    expect(out).not.toContain("$skip=");
    expect(out).not.toContain("$limit=");
  });

  it("all-off produces empty string regardless of state", () => {
    expect(
      stateToUrlQueryString(FULL_STATE, {
        ...DEFAULTS,
        sync: { filters: false, sorters: false, search: false, pagination: false },
      }),
    ).toBe("");
  });

  it("sync omitted matches pre-existing baseline", () => {
    const a = stateToUrlQueryString(FULL_STATE, DEFAULTS);
    const b = stateToUrlQueryString(FULL_STATE, { ...DEFAULTS, sync: undefined });
    const c = stateToUrlQueryString(FULL_STATE, { ...DEFAULTS, sync: {} });
    expect(a).toBe(b);
    expect(a).toBe(c);
  });
});

describe("urlQuerySync — decoder gating", () => {
  // Build a well-formed full URL from FULL_STATE so we don't have to hand-write
  // the wire format (which differs per condition type).
  const FULL_URL = stateToUrlQueryString(FULL_STATE, DEFAULTS);

  it("filters: false → empty filters; other aspects unaffected", () => {
    const out = urlQueryStringToState(FULL_URL, { sync: { filters: false } });
    expect(out.filters).toEqual({});
    expect(out.sorters.length).toBeGreaterThan(0);
  });

  it("filters: ['status'] drops other field conditions", () => {
    const out = urlQueryStringToState("status=active&name=foo", {
      sync: { filters: ["status"] },
    });
    expect(out.filters).toEqual({ status: [{ type: "eq", value: ["active"] }] });
  });

  it("filters allowlist intersects with knownFields (allowlist wins where stricter)", () => {
    const out = urlQueryStringToState("status=active&other=b", {
      knownFields: ["status", "other"],
      sync: { filters: ["status"] },
    });
    expect(out.filters).toEqual({ status: [{ type: "eq", value: ["active"] }] });
    expect(out.filters.other).toBeUndefined();
  });

  it("sorters: false → empty sorters", () => {
    const out = urlQueryStringToState(FULL_URL, { sync: { sorters: false } });
    expect(out.sorters).toEqual([]);
  });

  it("sorters: ['createdAt'] drops other sorter fields", () => {
    const out = urlQueryStringToState("$sort=-createdAt,name", {
      sync: { sorters: ["createdAt"] },
    });
    expect(out.sorters).toEqual([{ field: "createdAt", direction: "desc" }]);
  });

  it("search: false → empty searchTerm", () => {
    const out = urlQueryStringToState("$search=foo", { sync: { search: false } });
    expect(out.searchTerm).toBe("");
  });

  it("pagination: false → no skip", () => {
    const out = urlQueryStringToState("$skip=100&$limit=25", { sync: { pagination: false } });
    expect(out.skip).toBeUndefined();
  });
});

describe("urlQuerySync — round-trip symmetry (echo guard precondition)", () => {
  // Two encode passes through the same sync config must produce the same wire string.
  // This is what makes the consumer's `lastEmittedUrl` echo guard work. Pagination
  // is reconstructed using the linker's own itemsPerPage so the offset round-trips.
  const reEncode = (state: typeof FULL_STATE, sync: import("./url-query").UrlQuerySync) => {
    const url = stateToUrlQueryString(state, { ...DEFAULTS, sync });
    const parsed = urlQueryStringToState(url, { sync });
    const skip = parsed.skip ?? 0;
    const itemsPerPage = state.itemsPerPage;
    const page = skip > 0 && itemsPerPage > 0 ? Math.floor(skip / itemsPerPage) + 1 : 1;
    return stateToUrlQueryString(
      {
        filters: parsed.filters,
        sorters: parsed.sorters,
        page,
        itemsPerPage,
        searchTerm: parsed.searchTerm,
      },
      { ...DEFAULTS, sync },
    );
  };

  it("pagination: false round-trips stably", () => {
    const sync: import("./url-query").UrlQuerySync = { pagination: false };
    const first = stateToUrlQueryString(FULL_STATE, { ...DEFAULTS, sync });
    expect(reEncode(FULL_STATE, sync)).toBe(first);
  });

  it("filters: ['status'] round-trips stably", () => {
    const sync: import("./url-query").UrlQuerySync = { filters: ["status"] };
    const first = stateToUrlQueryString(FULL_STATE, { ...DEFAULTS, sync });
    expect(reEncode(FULL_STATE, sync)).toBe(first);
  });

  it("sorters: false round-trips stably", () => {
    const sync: import("./url-query").UrlQuerySync = { sorters: false };
    const first = stateToUrlQueryString(FULL_STATE, { ...DEFAULTS, sync });
    expect(reEncode(FULL_STATE, sync)).toBe(first);
  });

  it("all-off round-trips stably as empty string", () => {
    const sync: import("./url-query").UrlQuerySync = {
      filters: false,
      sorters: false,
      search: false,
      pagination: false,
    };
    expect(stateToUrlQueryString(FULL_STATE, { ...DEFAULTS, sync })).toBe("");
    expect(reEncode(FULL_STATE, sync)).toBe("");
  });
});

// The ownership rule the `useTableUrlQuery` router bridge reads and writes
// by: it must match what this parser actually consumes, or the bridge either
// eats a host key or leaves its own behind.
describe("urlQueryConsumesKey", () => {
  it("claims only the $controls the parser reads", () => {
    for (const key of ["$sort", "$search", "$relevance", "$skip", "$snapshot"]) {
      expect(urlQueryConsumesKey(key)).toBe(true);
    }
    // `$limit` is deliberately not read back (page size is the recipient's),
    // and an unknown control belongs to the page.
    expect(urlQueryConsumesKey("$limit")).toBe(false);
    expect(urlQueryConsumesKey("$weird")).toBe(false);
  });

  it("claims operator-bearing filter keys", () => {
    for (const key of ["total>100", "total<=5", "name~foo", "status!=x"]) {
      expect(urlQueryConsumesKey(key)).toBe(true);
    }
  });

  it("leaves a bare key to the page until the bridge writes it", () => {
    // `status=active` could equally be a host flag — indistinguishable
    // without the table definition.
    expect(urlQueryConsumesKey("status")).toBe(false);
    expect(urlQueryConsumesKey("tab")).toBe(false);
  });
});

describe("gateOwns", () => {
  it("an 'all' gate owns every path", () => {
    expect(gateOwns(resolveAspectGate(true), "status")).toBe(true);
    expect(gateOwns(resolveAspectGate(undefined), "anything")).toBe(true);
  });

  it("a 'none' gate owns nothing", () => {
    expect(gateOwns(resolveAspectGate(false), "status")).toBe(false);
    expect(gateOwns(resolveAspectGate([]), "status")).toBe(false);
  });

  it("an allowlist owns exactly its members", () => {
    const gate = resolveAspectGate(["status", "total"]);
    expect(gateOwns(gate, "status")).toBe(true);
    expect(gateOwns(gate, "total")).toBe(true);
    // Not listed: private, never round-trips, so a URL cannot clear it either.
    expect(gateOwns(gate, "customer")).toBe(false);
  });

  it("agrees with what the encoder actually writes", () => {
    // The predicate is only useful if it matches the serializer's behaviour —
    // read and write have to agree on ownership or the URL self-echoes.
    const url = stateToUrlQueryString(
      {
        filters: {
          status: [{ type: "eq", value: ["active"] }],
          customer: [{ type: "eq", value: ["5"] }],
        } as FieldFilters,
        sorters: [
          { field: "name", direction: "asc" },
          { field: "createdAt", direction: "desc" },
        ],
        searchTerm: "",
      },
      { ...DEFAULTS, sync: { filters: ["status"], sorters: ["createdAt"] } },
    );
    expect(url).toContain("status=");
    expect(url).not.toContain("customer=");
    expect(url).toContain("$sort=-createdAt");
    expect(url).not.toContain("name");
  });
});

describe("$snapshot marker", () => {
  const state = {
    filters: { status: [{ type: "eq" as const, value: ["open"] }] },
    sorters: [{ field: "name", direction: "asc" as const }],
  };

  it("trails every encoded URL as a bare key", () => {
    expect(URL_SNAPSHOT_KEY).toBe("$snapshot");
    expect(stateToUrlQueryString(state, DEFAULTS)).toBe("status=open&$sort=name&$snapshot");
  });

  it("round-trips: a marked URL decodes as a snapshot", () => {
    const back = urlQueryStringToState(stateToUrlQueryString(state, DEFAULTS));
    expect(back).toEqual({ ...state, searchTerm: "", snapshot: true });
  });

  it("an unmarked URL decodes without the flag (overlay)", () => {
    expect(urlQueryStringToState("status=open").snapshot).toBeUndefined();
  });

  it("goes by the marker's presence, whatever its value", () => {
    expect(urlQueryStringToState("$snapshot=1").snapshot).toBe(true);
    expect(urlQueryStringToState("$snapshot=").snapshot).toBe(true);
    expect(urlQueryStringToState("$snapshot=0").snapshot).toBe(true);
    expect(urlQueryStringToState("$snapshot=false").snapshot).toBe(true);
  });

  it("sync.snapshot: false neither writes nor honours the marker", () => {
    const sync = { snapshot: false };
    expect(stateToUrlQueryString(state, { ...DEFAULTS, sync })).toBe("status=open&$sort=name");
    expect(stateToUrlQueryString({ filters: {}, sorters: [] }, { ...DEFAULTS, sync })).toBe("");
    expect(urlQueryStringToState("status=open&$snapshot", { sync }).snapshot).toBeUndefined();
  });

  it("is not written when neither filters nor sorters sync", () => {
    const sync = { filters: false, sorters: false };
    expect(stateToUrlQueryString({ ...state, searchTerm: "x" }, { ...DEFAULTS, sync })).toBe(
      "$search=x",
    );
  });
});

describe("urlQueryStringToState — unsupported filters", () => {
  it("lists a cross-field OR in `unsupported`, leaves it out, and does not warn (residual off)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const out = urlQueryStringToState("team=core&(a=1^b=2)", { sync: { residual: false } });
      expect(out.filters).toEqual({ team: [{ type: "eq", value: ["core"] }] });
      expect(out.unsupported).toHaveLength(1);
      expect(out.unsupported![0]).toMatchObject({ reason: "cross-field", fields: ["a", "b"] });
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("decodes a URL in-list as the field's OR'd equalities", () => {
    const out = urlQueryStringToState("status{open,review}");
    expect(out.filters).toEqual({
      status: [
        { type: "eq", value: ["open"] },
        { type: "eq", value: ["review"] },
      ],
    });
    expect(out.unsupported).toBeUndefined();
  });
});
