import { createTableDef, type MetaResponse, type TableDef } from "@atscript/ui-core";
import type { SelectionMode } from "@atscript/ui-table";
import type { ReactiveTableState, TAsTableComponents } from "../types";
import { createTableState, provideTableContext } from "./use-table-state";
import { useTableQuery, type TableClient, type UseTableQueryOptions } from "./use-table-query";
import { useTableSelection } from "./use-table-selection";

/** Full client interface — needs both meta() and pages(). */
export interface UseTableClient extends TableClient {
  meta(): Promise<MetaResponse>;
}

/** Factory function that creates a client from a URL path. */
export type TableClientFactory = (url: string) => UseTableClient;

/** Cached entry: the client instance + parsed TableDef promise. */
interface CacheEntry {
  client: UseTableClient;
  def: Promise<TableDef>;
}

/** Global cache keyed by URL path. */
const cache = new Map<string, CacheEntry>();

/** Clear the global table cache (useful for testing). */
export function clearTableCache() {
  cache.clear();
}

/** Default factory — must be set via `setDefaultClientFactory` before using url-only mode. */
let defaultFactory: TableClientFactory | undefined;

/** Set the default client factory for all tables. Call once at app startup. */
export function setDefaultClientFactory(factory: TableClientFactory) {
  defaultFactory = factory;
}

export interface UseTableOptions extends UseTableQueryOptions {
  /** Default page size (default: 50). */
  limit?: number;
  /** Selection mode (default: 'none'). */
  select?: SelectionMode;
  /** Extract unique value from a row for selection tracking. */
  rowValueFn?: (row: Record<string, unknown>) => unknown;
  /** Preserve selection across data refreshes. */
  keepSelectedAfterRefresh?: boolean;
  /** Auto-query when metadata loads (default: true). */
  queryOnMount?: boolean;
  /** Factory to create a client from a URL. Falls back to default factory. */
  clientFactory?: TableClientFactory;
  /** Component overrides for table rendering. */
  components?: TAsTableComponents;
}

/**
 * Main entry composable for table setup.
 *
 * @param url — Table endpoint URL (e.g. "/db/tables/products")
 */
export function useTable(url: string, opts?: UseTableOptions): ReactiveTableState {
  const factory = opts?.clientFactory ?? defaultFactory;
  if (!factory) {
    throw new Error(
      "useTable requires a clientFactory option or a default factory set via setDefaultClientFactory().",
    );
  }

  const { client, defPromise } = resolveClient(url, factory);

  const { state, internals } = createTableState({
    limit: opts?.limit,
    selection: {
      mode: opts?.select ?? "none",
      rowValueFn: opts?.rowValueFn,
      keepAfterRefresh: opts?.keepSelectedAfterRefresh,
    },
  });

  useTableQuery(client, state, internals, opts);
  useTableSelection(state);
  provideTableContext({ state, client, components: opts?.components ?? {} });

  const queryOnMount = opts?.queryOnMount ?? true;

  defPromise
    .then((def) => {
      internals.init(def);
      if (queryOnMount) {
        state.query();
      }
    })
    .catch((err) => {
      state.metadataError.value = err instanceof Error ? err : new Error(String(err));
    });

  return state;
}

function resolveClient(
  url: string,
  factory: TableClientFactory,
): { client: UseTableClient; defPromise: Promise<TableDef> } {
  const cached = cache.get(url);
  if (cached) {
    return { client: cached.client, defPromise: cached.def };
  }

  const client = factory(url);
  const def = client.meta().then((meta) => createTableDef(meta));
  def.catch(() => cache.delete(url));
  cache.set(url, { client, def });

  return { client, defPromise: def };
}
