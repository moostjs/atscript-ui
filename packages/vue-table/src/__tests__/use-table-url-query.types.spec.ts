// Type-level checks, enforced by `vue-tsc` (`vp check`): the bridge takes
// vue-router's real `useRoute()` / `useRouter()` — plain and with typed-route
// augmentation — and plain structural fakes, with no cast.
import { describe, expect, expectTypeOf, it } from "vitest";
import { useRoute, useRouter, type RouteRecordInfo } from "vue-router";
import type { WritableComputedRef } from "vue";
import {
  useTableUrlQuery,
  type TableUrlQueryRoute,
  type TableUrlQueryRouter,
} from "../composables/use-table-url-query";

declare module "vue-router" {
  interface TypesConfig {
    RouteNamedMap: {
      home: RouteRecordInfo<"home", "/", Record<never, never>, Record<never, never>>;
      order: RouteRecordInfo<"order", "/orders/:id", { id: string | number }, { id: string }>;
    };
  }
}

describe("useTableUrlQuery types", () => {
  it("accepts the real vue-router route and router (typed-route augmented)", () => {
    // Never executed — a composable call outside a component would warn.
    const compileOnly = () => {
      const bridge = useTableUrlQuery(useRoute(), useRouter());
      expectTypeOf(bridge).toEqualTypeOf<WritableComputedRef<string>>();
      useTableUrlQuery(useRoute("order"), useRouter(), { mode: "push", prefix: "t1" });
      useTableUrlQuery(useRoute(), useRouter(), { preserveKeys: ["status"] });
      useTableUrlQuery(useRoute(), useRouter(), { preserveKeys: (key) => key.startsWith("h.") });
    };
    expect(typeof compileOnly).toBe("function");
  });

  it("accepts plain structural fakes", () => {
    const route: TableUrlQueryRoute = { query: {} };
    const router: TableUrlQueryRouter = { replace() {} };
    const bridge = useTableUrlQuery({ query: {} }, { replace() {} });
    expectTypeOf(bridge.value).toBeString();
    expectTypeOf(route.query).toMatchTypeOf<Record<string, unknown>>();
    expectTypeOf(router).toHaveProperty("replace");
  });
});
