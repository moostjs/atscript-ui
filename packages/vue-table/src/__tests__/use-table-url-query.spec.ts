import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, reactive } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import type { Client } from "@atscript/db-client";
import AsTableRoot from "../components/as-table-root.vue";
import { clearTableCache } from "../composables/use-table";
import type { ReactiveTableState } from "../types";
import { createMockClient, createMockMeta } from "./helpers";
import type { UrlQueryRecord } from "@atscript/ui-table";
import { useTableUrlQuery, type TableUrlQueryRoute } from "../composables/use-table-url-query";

type QueryShape = Record<string, string | string[] | null>;

interface FakeRoute extends TableUrlQueryRoute {
  query: QueryShape;
}

function createMockRoute(initial: QueryShape = {}): FakeRoute {
  return reactive({ query: { ...initial } }) as FakeRoute;
}

function createMockRouter(route: FakeRoute) {
  const apply = (target: { query: UrlQueryRecord }) => {
    route.query = target.query as QueryShape;
  };
  return {
    push: vi.fn((to: { query: UrlQueryRecord }) => {
      apply(to);
      return Promise.resolve();
    }),
    replace: vi.fn((to: { query: UrlQueryRecord }) => {
      apply(to);
      return Promise.resolve();
    }),
  };
}

describe("useTableUrlQuery", () => {
  it("returns the route query serialized as a URL query string", () => {
    const route = createMockRoute({ status: "active", $sort: "-createdAt" });
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);
    // Keys are read from `route.query` verbatim — vue-router has already
    // decoded the URL form, so `$sort` lands as-is rather than `%24sort`.
    expect(urlQuery.value).toContain("status=active");
    expect(urlQuery.value).toContain("$sort=-createdAt");
    expect(urlQuery.value).not.toContain("%24");
  });

  it("returns empty string when route.query is empty", () => {
    const route = createMockRoute({});
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);
    expect(urlQuery.value).toBe("");
  });

  it("calls router.replace by default on set", () => {
    const route = createMockRoute({});
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    urlQuery.value = "status=active";

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith({ query: { status: "active" } });
  });

  it("calls router.push when mode is 'push'", () => {
    const route = createMockRoute({});
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router, { mode: "push" });

    urlQuery.value = "status=active";

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith({ query: { status: "active" } });
  });

  it("preserves host-owned query keys it never wrote", () => {
    const route = createMockRoute({ existing: "preserved" });
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    urlQuery.value = "status=active";

    expect(router.replace).toHaveBeenCalledWith({
      query: { existing: "preserved", status: "active" },
    });
  });

  it("removes its own keys that are no longer set, keeping foreign keys", () => {
    const route = createMockRoute({ demo: "1" });
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    urlQuery.value = "status=active&$skip=50";
    expect(route.query).toEqual({ demo: "1", status: "active", $skip: "50" });

    urlQuery.value = "";

    expect(router.replace).toHaveBeenLastCalledWith({ query: { demo: "1" } });
  });

  it("removes keys the parser consumed, without a prior write", () => {
    // `$skip` is read by `urlQueryStringToState` and `total>100` can only
    // come from a table, so both are owned even though this bridge instance
    // never wrote them.
    const route = createMockRoute({ $skip: "50", "total>100": null, demo: "1" });
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    urlQuery.value = "status=active";

    expect(router.replace).toHaveBeenCalledWith({ query: { demo: "1", status: "active" } });
  });

  it("keeps a $control the parser does not consume", () => {
    // Read and write agree: `urlQueryStringToState` ignores `$weird`, so the
    // bridge must not delete it either — it belongs to the page.
    const route = createMockRoute({ $weird: "42", $search: "abc", demo: "1" });
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    urlQuery.value = "status=active";

    expect(router.replace).toHaveBeenCalledWith({
      query: { $weird: "42", demo: "1", status: "active" },
    });
  });

  it("keeps the position of keys that survive a write", () => {
    const route = createMockRoute({ demo: "1" });
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    urlQuery.value = "status=active";
    urlQuery.value = "status=archived";

    expect(Object.keys(route.query as object)).toEqual(["demo", "status"]);
  });

  it("writes its own keys in the table's order, so the table reads back what it wrote", () => {
    // Regression: merging in place kept `$snapshot` where the previous write
    // put it and appended `$sort` after it, so the table's own URL came back
    // spelled differently and slipped past its echo guard.
    const route = createMockRoute({});
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    urlQuery.value = "status=active&$snapshot";
    urlQuery.value = "status=active&$sort=-createdAt&$snapshot";

    expect(urlQuery.value).toBe("status=active&$sort=-createdAt&$snapshot");
  });

  it("keeps foreign keys in their slots around its own block", () => {
    const route = createMockRoute({ tab: "a", status: "active", $snapshot: null, demo: "1" });
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    urlQuery.value = "status=active&$sort=name&$snapshot";

    expect(Object.keys(route.query as object)).toEqual([
      "tab",
      "status",
      "$sort",
      "$snapshot",
      "demo",
    ]);
  });

  it("is reactive to external route changes", () => {
    const route = createMockRoute({});
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    expect(urlQuery.value).toBe("");

    route.query = { status: "active" };
    expect(urlQuery.value).toBe("status=active");
  });

  it("get + set round-trips a complex URL string", () => {
    const route = createMockRoute({});
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    urlQuery.value = "status=active&$sort=-createdAt";

    expect(urlQuery.value).toContain("status=active");
    expect(urlQuery.value).toContain("$sort=-createdAt");
    expect(urlQuery.value).not.toContain("%24");
  });
});

describe("useTableUrlQuery — operator-bearing keys", () => {
  // Regression: `URLSearchParams`-based setter mangled operator-bearing keys.
  it("stores `total>100` as a single null-valued bare key", () => {
    const route = createMockRoute({});
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    urlQuery.value = "total>100";

    expect(router.replace).toHaveBeenCalledWith({
      query: { "total>100": null },
    });
  });

  it("get + set round-trips operator-bearing keys verbatim", () => {
    const cases = [
      "total>100",
      "total<100",
      "total>=10",
      "total<=200",
      "total!=5",
      "profile.firstName~='/bob/i'",
    ];
    for (const wire of cases) {
      const route = createMockRoute({});
      const router = createMockRouter(route);
      const urlQuery = useTableUrlQuery(route, router);
      urlQuery.value = wire;
      expect(urlQuery.value).toBe(wire);
    }
  });

  it("between filter (two operator-bearing segments) survives round-trip", () => {
    const route = createMockRoute({});
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    urlQuery.value = "total>=10&total<=50";

    expect(router.replace).toHaveBeenCalledWith({
      query: { "total>=10": null, "total<=50": null },
    });
    expect(urlQuery.value).toBe("total>=10&total<=50");
  });

  it("mixes clean eq segments with operator-bearing segments", () => {
    const route = createMockRoute({});
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    urlQuery.value = "status=active&total>100&$skip=50";

    expect(router.replace).toHaveBeenCalledWith({
      query: { status: "active", "total>100": null, $skip: "50" },
    });
    expect(urlQuery.value).toBe("status=active&total>100&$skip=50");
  });

  it("keeps a value's `&` inside its segment — `buildUrl` percent-encodes it", () => {
    // The bridge splits exactly like @uniqu/url's parser (paren-aware, not
    // quote-aware); a raw `&` inside a quoted value never comes out of the
    // builder, which writes `name='foo%26bar'`.
    const route = createMockRoute({});
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    urlQuery.value = "name='foo%26bar'&status=active";

    expect(router.replace).toHaveBeenCalledWith({
      query: { name: "'foo%26bar'", status: "active" },
    });
    expect(urlQuery.value).toBe("name='foo%26bar'&status=active");
  });

  it("respects backslash-escaped quotes inside string literals", () => {
    // `\'` inside `'...'` is an escaped apostrophe per @uniqu/url's encoder.
    const route = createMockRoute({});
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    urlQuery.value = "name~='/it\\'s/i'&status=active";

    expect(router.replace).toHaveBeenCalledWith({
      query: { "name~='/it\\'s/i'": null, status: "active" },
    });
  });

  it("reads bare-key route.query entries (null value) as operator-bearing segments", () => {
    // vue-router parses `?total%3E100` (no `=`) as a null-valued entry.
    const route = createMockRoute({ "total>100": null, status: "active" });
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    expect(urlQuery.value).toBe("total>100&status=active");
  });
});

describe("useTableUrlQuery — grouped filters", () => {
  it("keeps a parenthesized group with an inner `&` as one key", () => {
    const route = createMockRoute({});
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    urlQuery.value =
      "customerId=2&((status=shipped&total>500)^(status=pending&total<=50))&$snapshot";

    expect(router.replace).toHaveBeenCalledWith({
      query: {
        customerId: "2",
        "((status=shipped&total>500)^(status=pending&total<=50))": null,
        $snapshot: null,
      },
    });
    expect(urlQuery.value).toBe(
      "customerId=2&((status=shipped&total>500)^(status=pending&total<=50))&$snapshot",
    );
  });

  it("does not lose a fragment that repeats inside two groups", () => {
    const route = createMockRoute({});
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    urlQuery.value = "(a=1&m=1&b=1)^(c=1&m=1&d=1)&$snapshot";
    expect(urlQuery.value).toBe("(a=1&m=1&b=1)^(c=1&m=1&d=1)&$snapshot");
  });

  it("does not count a value's paren — `buildUrl` percent-encodes it", () => {
    const route = createMockRoute({});
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    urlQuery.value = "name='a%28b'&status=active";
    expect(router.replace).toHaveBeenCalledWith({
      query: { name: "'a%28b'", status: "active" },
    });
  });

  it("replaces a deep link's differently-spelled group instead of keeping it as foreign", () => {
    // A hand-written link, spelled differently from what the table writes back.
    const route = createMockRoute({ "(path=FAST&raisedAt=1)^(path=SLOW)": null, tab: "x" });
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    urlQuery.value = "(path=SLOW^(path=FAST&raisedAt=1))&$snapshot";
    expect(router.replace).toHaveBeenCalledWith({
      query: { "(path=SLOW^(path=FAST&raisedAt=1))": null, $snapshot: null, tab: "x" },
    });
  });
});

describe("useTableUrlQuery — prefix (two tables on one route)", () => {
  it("writes and reads only its own prefixed keys", () => {
    const route = createMockRoute({});
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router, { prefix: "t1" });

    urlQuery.value = "status=active&$skip=50";

    expect(route.query).toEqual({ "t1.status": "active", "t1.$skip": "50" });
    expect(urlQuery.value).toBe("status=active&$skip=50");
  });

  it("two bridges on one query object never clobber each other or the page", () => {
    const route = createMockRoute({ demo: "1" });
    const router = createMockRouter(route);
    const a = useTableUrlQuery(route, router, { prefix: "a" });
    const b = useTableUrlQuery(route, router, { prefix: "b" });

    a.value = "status=active";
    b.value = "kind=open&total>100";

    expect(route.query).toEqual({
      demo: "1",
      "a.status": "active",
      "b.kind": "open",
      "b.total>100": null,
    });
    expect(a.value).toBe("status=active");
    expect(b.value).toBe("kind=open&total>100");

    // Clearing one table leaves the other and the page key alone.
    a.value = "";

    expect(route.query).toEqual({ demo: "1", "b.kind": "open", "b.total>100": null });
    expect(b.value).toBe("kind=open&total>100");
  });

  it("does not treat unprefixed $controls as its own", () => {
    const route = createMockRoute({ $skip: "50" });
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router, { prefix: "t1" });

    expect(urlQuery.value).toBe("");
    urlQuery.value = "status=active";

    expect(route.query).toEqual({ $skip: "50", "t1.status": "active" });
  });
});

describe("useTableUrlQuery — $snapshot marker", () => {
  it("round-trips the bare marker through route.query", () => {
    const route = createMockRoute({});
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    urlQuery.value = "status=active&$snapshot";

    expect(router.replace).toHaveBeenCalledWith({ query: { status: "active", $snapshot: null } });
    expect(urlQuery.value).toBe("status=active&$snapshot");
  });

  it("owns a marker already in the URL at mount and drops it when a write omits it", () => {
    const route = createMockRoute({ status: "active", $snapshot: null, tab: "orders" });
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    urlQuery.value = "status=done";

    expect(route.query).toEqual({ status: "done", tab: "orders" });
  });

  it("keeps the marker under a prefix", () => {
    const route = createMockRoute({});
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router, { prefix: "t1" });

    urlQuery.value = "$snapshot";

    expect(route.query).toEqual({ "t1.$snapshot": null });
    expect(urlQuery.value).toBe("$snapshot");
  });
});

describe("useTableUrlQuery — preserveKeys", () => {
  it("skips a preserved host key on read, keeps it verbatim on write", () => {
    const route = createMockRoute({ status: "pending", demo: "1" });
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router, { preserveKeys: ["status"] });

    expect(urlQuery.value).toBe("demo=1");
    urlQuery.value = "total>100&$snapshot";
    expect(route.query).toEqual({
      status: "pending",
      demo: "1",
      "total>100": null,
      $snapshot: null,
    });
  });

  it("withholds a table segment on a preserved key and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const route = createMockRoute({ status: "pending" });
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router, { preserveKeys: ["status"] });

    urlQuery.value = "status=shipped&total>100";
    urlQuery.value = "status=shipped&total>200";

    expect(route.query).toEqual({ status: "pending", "total>200": null });
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('"status"'))).toHaveLength(1);
    warn.mockRestore();
  });

  it("returns the table's own string verbatim while the route reads as written (echo)", () => {
    const route = createMockRoute({ status: "pending" });
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router, { preserveKeys: ["status"] });

    urlQuery.value = "status=shipped&total>100&$snapshot";
    expect(urlQuery.value).toBe("status=shipped&total>100&$snapshot");
  });

  it("hands the withheld segment back after an external navigation", () => {
    const route = createMockRoute({ status: "pending" });
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router, { preserveKeys: ["status"] });
    urlQuery.value = "status=shipped&total>100";

    route.query = { status: "pending", "total>5": null };
    expect(urlQuery.value).toBe("total>5&status=shipped");
  });

  it("re-appends the held segments when the host changes the route between a set and the next get", () => {
    const route = createMockRoute({ status: "pending" });
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router, { preserveKeys: ["status"] });
    urlQuery.value = "status=shipped&total>100";
    expect(urlQuery.value).toBe("status=shipped&total>100");

    // the host adds its own key right after the table wrote
    route.query = { ...route.query, demo: "2" };
    expect(urlQuery.value).toBe("total>100&demo=2&status=shipped");

    // a later write that withholds nothing drops the held segments
    urlQuery.value = "total>100";
    route.query = { ...route.query, demo: "3" };
    expect(urlQuery.value).toBe("total>100&demo=3");
  });

  it("accepts a predicate and covers the operator forms of a preserved field", () => {
    const route = createMockRoute({ team: "a", "status!='x'": null });
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router, {
      preserveKeys: (key) => key === "team" || key === "status",
    });
    expect(urlQuery.value).toBe("");
    urlQuery.value = "status!='y'&total>1";
    expect(route.query).toEqual({ team: "a", "status!='x'": null, "total>1": null });
  });

  it("requires router.push for mode push", () => {
    const route = createMockRoute({});
    expect(() => useTableUrlQuery(route, { replace: () => {} }, { mode: "push" })).toThrow(/push/);
  });
});

describe("useTableUrlQuery — preserveKeys through <AsTableRoot>", () => {
  afterEach(() => {
    clearTableCache();
    document.body.innerHTML = "";
  });

  it("a host key that is also a column is no chip; a user filter on it stays private; one query per change", async () => {
    const route = createMockRoute({ status: "pending" });
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router, { preserveKeys: ["status"] });
    const { client, pagesFn } = createMockClient({
      meta: createMockMeta(["id", "status", "total"]),
      data: [],
    });
    const wrapper = mount(
      defineComponent({
        setup() {
          return () =>
            h(
              AsTableRoot as unknown as Parameters<typeof h>[0],
              {
                url: "/orders",
                clientFactory: () => client as Client,
                urlQuery: urlQuery.value,
                "onUpdate:urlQuery": (v: string) => {
                  urlQuery.value = v;
                },
              },
              { default: () => [] },
            );
        },
      }),
    );
    const state = (
      wrapper.findComponent(AsTableRoot).vm as unknown as { state: ReactiveTableState }
    ).state;
    await flushPromises();
    await flushPromises();
    expect(state.filters.value).toEqual({});
    expect(pagesFn).toHaveBeenCalledTimes(1);

    // A user filter on the colliding column: private, host key untouched.
    pagesFn.mockClear();
    state.setFieldFilter("status", [{ type: "eq", value: ["shipped"] }]);
    await new Promise((r) => setTimeout(r, 600));
    await flushPromises();
    expect(route.query.status).toBe("pending");
    expect(pagesFn).toHaveBeenCalledTimes(1);

    // A table-owned filter round-trips and Back keeps the private one.
    pagesFn.mockClear();
    state.setFieldFilter("total", [{ type: "gt", value: [100] }]);
    await new Promise((r) => setTimeout(r, 600));
    await flushPromises();
    expect(Object.keys(route.query)).toContain("total>100");
    expect(pagesFn).toHaveBeenCalledTimes(1);
    route.query = { status: "pending", "total>100": null };
    await flushPromises();
    expect(state.filters.value.status).toEqual([{ type: "eq", value: ["shipped"] }]);
    expect(state.filters.value.total).toBeTruthy();

    // Clearing every filter keeps the host key.
    state.filters.value = {};
    await new Promise((r) => setTimeout(r, 600));
    await flushPromises();
    expect(route.query.status).toBe("pending");
    expect(Object.keys(route.query)).not.toContain("total>100");
  });
});
