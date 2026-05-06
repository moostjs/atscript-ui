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
 * Split a uniqu URL string on top-level `&` separators, respecting
 * single-quoted string literals (`name='foo&bar'` is one segment, not two).
 * Within a quote, `\'` escapes a literal apostrophe per @uniqu/url's encoder.
 * Empty segments (from leading/trailing/double `&`) are dropped.
 */
function splitSegments(urlString: string): string[] {
  if (!urlString) return [];
  const out: string[] = [];
  let start = 0;
  let inQuote = false;
  const push = (end: number) => {
    if (end > start) out.push(urlString.slice(start, end));
  };
  for (let i = 0; i < urlString.length; i++) {
    const c = urlString[i];
    if (c === "\\" && inQuote) {
      i++;
      continue;
    }
    if (c === "'") {
      inQuote = !inQuote;
    } else if (c === "&" && !inQuote) {
      push(i);
      start = i + 1;
    }
  }
  push(urlString.length);
  return out;
}

const KEY_CHAR = /[A-Za-z0-9_.$-]/;

/**
 * Index of `=` if every char before it is URL-key-safe. Returns -1 when any
 * non-key char (uniqu operator, whitespace, etc.) appears first — those
 * segments must round-trip as a single bare key because vue-router's `query`
 * record has no encoding for non-`=` separators.
 */
function findCleanEq(segment: string): number {
  for (let i = 0; i < segment.length; i++) {
    const c = segment[i];
    if (c === "=") return i > 0 ? i : -1;
    if (!KEY_CHAR.test(c)) return -1;
  }
  return -1;
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
  const navigate =
    (opts.mode ?? "replace") === "push" ? router.push.bind(router) : router.replace.bind(router);

  return computed<string>({
    get: () => {
      const q = route.query;
      const parts: string[] = [];
      for (const key in q) {
        const v = q[key];
        if (Array.isArray(v)) {
          for (const item of v) {
            parts.push(item == null ? key : `${key}=${item}`);
          }
        } else if (v == null) {
          parts.push(key);
        } else {
          parts.push(`${key}=${v}`);
        }
      }
      return parts.join("&");
    },
    set: (urlString) => {
      const query: Record<string, string | null> = {};
      for (const segment of splitSegments(urlString)) {
        const eqIdx = findCleanEq(segment);
        if (eqIdx > 0) {
          query[segment.slice(0, eqIdx)] = segment.slice(eqIdx + 1);
        } else {
          query[segment] = null;
        }
      }
      void navigate({ query });
    },
  });
}
