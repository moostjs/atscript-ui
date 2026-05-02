import { computed, type WritableComputedRef } from "vue";
import type { Router, RouteLocationNormalizedLoaded } from "vue-router";

/** Options for {@link useTableUrlQuery}. */
export interface UseTableUrlQueryOptions {
  /**
   * Navigation mode for outbound writes.
   * - `"replace"` (default) — `router.replace`, no new history entry. Right
   *   for tables that emit on every keystroke (search box) so back-button
   *   doesn't step through 30 typing-induced URLs.
   * - `"push"` — `router.push`, every state change becomes a discrete
   *   history entry. Choose when each filter/sort change should be
   *   navigation-recoverable.
   */
  mode?: "replace" | "push";
}

/**
 * Bridge `<AsTableRoot v-model:url-query>` to vue-router. Uses **type-only**
 * imports of `Router` and `RouteLocationNormalizedLoaded` — no runtime
 * dependency on `vue-router` is added to `@atscript/vue-table`. Consumers
 * pass in their already-resolved `useRoute()` and `useRouter()` instances.
 *
 * Scope: **owns the whole query string**. The getter returns the entire
 * `route.query` serialized; the setter replaces `route.query` wholesale.
 * Apps that need the table to coexist with non-table query params should
 * write their own `computed` instead — that pattern is small and keeps the
 * library's contract crisp.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useRoute, useRouter } from 'vue-router';
 * import { useTableUrlQuery } from '@atscript/vue-table';
 * const urlQuery = useTableUrlQuery(useRoute(), useRouter());
 * </script>
 * <template>
 *   <AsTableRoot v-model:url-query="urlQuery" url="/db/products" .../>
 * </template>
 * ```
 */
export function useTableUrlQuery(
  route: RouteLocationNormalizedLoaded,
  router: Router,
  opts: UseTableUrlQueryOptions = {},
): WritableComputedRef<string> {
  const mode = opts.mode ?? "replace";

  return computed<string>({
    get: () => {
      const params = new URLSearchParams();
      const q = route.query;
      for (const key in q) {
        const v = q[key];
        if (v == null) continue;
        if (Array.isArray(v)) {
          for (const item of v) {
            if (item != null) params.append(key, String(item));
          }
        } else {
          params.append(key, String(v));
        }
      }
      // Decode `$` back to its literal form so the wire string matches the
      // canonical output of `stateToUrlQueryString` (which doesn't percent-
      // encode `$skip`/`$sort`/etc.). This keeps the bridge's echo guard a
      // single string compare instead of a re-encode-and-compare round trip.
      return params.toString().replace(/%24/g, "$");
    },
    set: (urlString) => {
      const query = Object.fromEntries(new URLSearchParams(urlString));
      if (mode === "push") {
        void router.push({ query });
      } else {
        void router.replace({ query });
      }
    },
  });
}
