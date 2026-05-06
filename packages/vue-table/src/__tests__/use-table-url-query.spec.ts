import { describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import type { Router, RouteLocationNormalizedLoaded } from "vue-router";
import { useTableUrlQuery } from "../composables/use-table-url-query";

type QueryShape = Record<string, string | string[] | null>;

function createMockRoute(initial: QueryShape = {}) {
  return reactive({ query: { ...initial } }) as unknown as RouteLocationNormalizedLoaded;
}

function createMockRouter(route: RouteLocationNormalizedLoaded): Router & {
  push: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
} {
  const apply = (target: { query: unknown }) => {
    (route as { query: unknown }).query = target.query as QueryShape;
  };
  const router = {
    push: vi.fn((to: { query: QueryShape }) => {
      apply(to);
      return Promise.resolve();
    }),
    replace: vi.fn((to: { query: QueryShape }) => {
      apply(to);
      return Promise.resolve();
    }),
  };
  return router as unknown as Router & {
    push: ReturnType<typeof vi.fn>;
    replace: ReturnType<typeof vi.fn>;
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

  it("replaces the entire query — clobbers existing keys", () => {
    const route = createMockRoute({ existing: "preserved" });
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    urlQuery.value = "status=active";

    expect(router.replace).toHaveBeenCalledWith({ query: { status: "active" } });
  });

  it("setting empty string clears all query params", () => {
    const route = createMockRoute({ status: "active" });
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    urlQuery.value = "";

    expect(router.replace).toHaveBeenCalledWith({ query: {} });
  });

  it("is reactive to external route changes", () => {
    const route = createMockRoute({});
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    expect(urlQuery.value).toBe("");

    (route as { query: unknown }).query = { status: "active" };
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

  it("respects single-quoted string literals when splitting on `&`", () => {
    // `&` inside `'...'` is part of the value per uniqu's syntax, not a separator.
    const route = createMockRoute({});
    const router = createMockRouter(route);
    const urlQuery = useTableUrlQuery(route, router);

    urlQuery.value = "name='foo&bar'&status=active";

    expect(router.replace).toHaveBeenCalledWith({
      query: { name: "'foo&bar'", status: "active" },
    });
    expect(urlQuery.value).toBe("name='foo&bar'&status=active");
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
