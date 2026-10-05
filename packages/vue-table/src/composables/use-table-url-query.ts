import { computed, type WritableComputedRef } from "vue";
import {
  DEV,
  leadingKey,
  mergeUrlQueryRecord,
  urlQueryConsumesKey,
  urlQueryRecordToString,
  type UrlQueryRecord,
  type UrlQueryRecordInput,
  type UrlQueryRecordOptions,
} from "@atscript/ui-table";

/**
 * The slice of a router's current route the bridge reads — vue-router's
 * `useRoute()` fits (with or without typed routes).
 * @since 0.1.148
 */
export interface TableUrlQueryRoute {
  readonly query: UrlQueryRecordInput;
}

/**
 * The slice of a router the bridge writes through — vue-router's
 * `useRouter()` fits. Structural on purpose: `@atscript/vue-table` has no
 * `vue-router` dependency, and a router with typed-route augmentation is
 * accepted as is.
 * @since 0.1.148
 */
export interface TableUrlQueryRouter {
  replace(to: { query: UrlQueryRecord }): unknown;
  /** Required only for `mode: "push"` (checked at setup). */
  push?(to: { query: UrlQueryRecord }): unknown;
}

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
  /**
   * Host keys (wire form) the table never reads, writes or removes — even
   * when a column has the same name. Without it, a host key that is also a
   * column path (`?team=…` on a table with a `team` column) is read as a
   * user filter. A filter the user sets on such a column stays private to the
   * table: it is kept across navigation but never written to the URL, and
   * the host's value is left alone. Pass a list of keys or a predicate. Only
   * matters without a `prefix`. Since 0.1.148.
   */
  preserveKeys?: UrlQueryRecordOptions["preserveKeys"];
}

/**
 * Bridge `<AsTableRoot v-model:url-query>` to a router. Takes the structural
 * {@link TableUrlQueryRoute} / {@link TableUrlQueryRouter} slices, so
 * `@atscript/vue-table` imports nothing from `vue-router`: consumers pass
 * their already-resolved `useRoute()` and `useRouter()` instances.
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
 * a page-owned flag of the same shape: the table reads every unprefixed key,
 * so a host key that is also a column path becomes a user filter. Pass
 * `preserveKeys` to fence such host keys off (or `prefix` to namespace the
 * table, which changes its URLs), and `prefix` when a route carries two
 * tables.
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
  route: TableUrlQueryRoute,
  router: TableUrlQueryRouter,
  opts: UseTableUrlQueryOptions = {},
): WritableComputedRef<string> {
  const usePush = (opts.mode ?? "replace") === "push";
  if (usePush && typeof router.push !== "function") {
    throw new TypeError('[vue-table] useTableUrlQuery: mode "push" needs router.push.');
  }
  const navigate = (query: UrlQueryRecord) =>
    usePush ? router.push?.({ query }) : router.replace({ query });
  const prefix = opts.prefix ? `${opts.prefix}.` : "";
  const recordOpts: UrlQueryRecordOptions = {
    prefix: opts.prefix,
    preserveKeys: opts.preserveKeys,
  };

  // Keys this bridge has written, in their on-the-wire (prefixed) form. A key
  // that drops out of a later write is removed from the query; keys never
  // written by the bridge belong to the page and survive every write.
  const written = new Set<string>();

  function isOwn(key: string): boolean {
    if (prefix) return key.startsWith(prefix);
    return written.has(key) || urlQueryConsumesKey(key);
  }

  // Segments the table emitted on a preserved key are not in the URL, so the
  // getter hands them back (`held`): the table's private filter must survive a
  // navigation that did not write it. `lastSet` / `expectedOwn` keep the echo
  // exact — while the route still reads as what we wrote, the table gets its
  // own string back verbatim (withheld segments and all). `undefined` while
  // nothing is withheld.
  let withheld: { held: string[]; lastSet: string; expectedOwn: string } | undefined;
  const warned = new Set<string>();

  return computed<string>({
    get: () => {
      const own = urlQueryRecordToString(route.query, recordOpts);
      if (!withheld) return own;
      if (own === withheld.expectedOwn) return withheld.lastSet;
      return [own, ...withheld.held].filter(Boolean).join("&");
    },
    set: (urlString) => {
      // Foreign keys keep their slots. Own keys belong wholly to the table, so
      // they are rewritten as one block in the table's order — where the first
      // own key sat, else at the end — and read back in that order: a key the
      // table adds must not trail the ones it kept, or its own URL would come
      // back spelled differently and miss its echo guard. An own key absent
      // from this write is dropped.
      const merged = mergeUrlQueryRecord(route.query, urlString, { ...recordOpts, isOwn });
      const { query } = merged;
      for (const key of merged.own) written.add(key);
      withheld = merged.withheld.length
        ? {
            held: merged.withheld,
            lastSet: urlString,
            expectedOwn: urlQueryRecordToString(query, recordOpts),
          }
        : undefined;
      if (DEV) {
        for (const segment of merged.withheld) {
          const name = leadingKey(segment) || segment;
          if (warned.has(name)) continue;
          warned.add(name);
          console.warn(
            `[vue-table] useTableUrlQuery: "${name}" is in preserveKeys, so the table's own ` +
              `"${name}" filter is kept private and is not written to the URL.`,
          );
        }
      }
      void navigate(query);
    },
  });
}
