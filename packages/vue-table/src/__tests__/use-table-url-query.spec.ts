import { describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import type { Router, RouteLocationNormalizedLoaded } from "vue-router";
import { useTableUrlQuery } from "../composables/use-table-url-query";

function createMockRoute(initial: Record<string, string | string[]> = {}) {
  return reactive({ query: { ...initial } }) as unknown as RouteLocationNormalizedLoaded;
}

function createMockRouter(route: RouteLocationNormalizedLoaded): Router & {
  push: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
} {
  const apply = (target: { query: unknown }) => {
    (route as { query: unknown }).query = target.query as Record<string, string>;
  };
  const router = {
    push: vi.fn((to: { query: Record<string, string> }) => {
      apply(to);
      return Promise.resolve();
    }),
    replace: vi.fn((to: { query: Record<string, string> }) => {
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
    // `$` is decoded back to its literal form so the wire string matches the
    // canonical `stateToUrlQueryString` output (no `%24` percent-encoding).
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
