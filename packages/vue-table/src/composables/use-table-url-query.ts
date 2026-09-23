import { computed, type WritableComputedRef } from "vue";
import { urlQueryConsumesKey } from "@atscript/ui-table";
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
  /**
   * Namespace for this table's query keys. With `prefix: "t1"` every key the
   * bridge writes becomes `t1.<key>` (`t1.$skip`, `t1.status`, `t1.total>100`)
   * and only keys under that prefix are read back or removed. Keys with no
   * prefix — or another table's prefix — are foreign and preserved untouched,
   * so two tables can share one route. Since 0.1.133.
   */
  prefix?: string;
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
 * Scope: the bridge owns **only what the table reads back** (since 0.1.133).
 * A key is the table's iff `urlQueryStringToState` would consume it — see
 * `urlQueryConsumesKey` — or the bridge has written it before. Read and
 * write therefore agree in both directions: a key the parser ignores (a host
 * flag, an unrecognised `$control`) is never removed, and a key the parser
 * reads is the bridge's to remove. Every write merges into the current
 * `route.query`: foreign keys stay where they are, the table's own keys are
 * written as one block in the table's order.
 *
 * Without a `prefix` the bridge cannot tell a plain `field=value` filter from
 * a page-owned flag of the same shape, so a plain key that was already in the
 * URL when the bridge mounted counts as foreign until the bridge writes it
 * itself. Pass `prefix` when a route carries a host key that could collide
 * with a column path, or when it carries two tables.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useRoute, useRouter } from 'vue-router';
 * import { useTableUrlQuery } from '@atscript/vue-table';
 * const urlQuery = useTableUrlQuery(useRoute(), useRouter());
 * // Two tables on one route:
 * // const left = useTableUrlQuery(useRoute(), useRouter(), { prefix: 'a' });
 * // const right = useTableUrlQuery(useRoute(), useRouter(), { prefix: 'b' });
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
  const prefix = opts.prefix ? `${opts.prefix}.` : "";

  // Keys this bridge has written, in their on-the-wire (prefixed) form. A key
  // that drops out of a later write is removed from the query; keys never
  // written by the bridge belong to the page and survive every write.
  const written = new Set<string>();

  function isOwn(key: string): boolean {
    if (prefix) return key.startsWith(prefix);
    return written.has(key) || urlQueryConsumesKey(key);
  }

  return computed<string>({
    get: () => {
      const q = route.query;
      const parts: string[] = [];
      for (const key in q) {
        if (prefix && !key.startsWith(prefix)) continue;
        const own = prefix ? key.slice(prefix.length) : key;
        const v = q[key];
        if (Array.isArray(v)) {
          for (const item of v) {
            parts.push(item == null ? own : `${own}=${item}`);
          }
        } else if (v == null) {
          parts.push(own);
        } else {
          parts.push(`${own}=${v}`);
        }
      }
      return parts.join("&");
    },
    set: (urlString) => {
      const serialized = new Map<string, string | null>();
      for (const segment of splitSegments(urlString)) {
        const eqIdx = findCleanEq(segment);
        const key = eqIdx > 0 ? `${prefix}${segment.slice(0, eqIdx)}` : `${prefix}${segment}`;
        serialized.set(key, eqIdx > 0 ? segment.slice(eqIdx + 1) : null);
        written.add(key);
      }

      // Foreign keys keep their slots. Own keys belong wholly to the table, so
      // they are rewritten as one block in the table's order — where the first
      // own key sat, else at the end — and read back in that order: a key the
      // table adds must not trail the ones it kept, or its own URL would come
      // back spelled differently and miss its echo guard. An own key absent
      // from this write is dropped.
      const query: Record<string, string | string[] | null> = {};
      let placed = false;
      const place = () => {
        if (placed) return;
        placed = true;
        for (const [key, value] of serialized) query[key] = value;
      };
      for (const key in route.query) {
        if (isOwn(key)) place();
        else query[key] = route.query[key] as string | string[] | null;
      }
      place();
      void navigate({ query });
    },
  });
}
