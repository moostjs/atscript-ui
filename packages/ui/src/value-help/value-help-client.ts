import type {
  TargetTableMeta,
  ValueHelpClient,
  ValueHelpClientOptions,
  ValueHelpQuery,
  ValueHelpResult,
} from "./types";
import { createTableDef } from "../table/create-table-def";

/**
 * Creates a ValueHelpClient for querying target tables.
 *
 * The client caches `/meta` responses and handles search strategy
 * (server `$search` vs client-side regex filter) automatically.
 */
export function createValueHelpClient(options?: ValueHelpClientOptions): ValueHelpClient {
  const baseUrl = options?.baseUrl ?? "";
  const fetchFn = options?.fetch ?? globalThis.fetch;
  const metaCache = new Map<string, TargetTableMeta | undefined>();
  const metaInFlight = new Map<string, Promise<TargetTableMeta | undefined>>();

  async function getMeta(path: string): Promise<TargetTableMeta | undefined> {
    if (metaCache.has(path)) return metaCache.get(path);
    if (metaInFlight.has(path)) return metaInFlight.get(path);

    const promise = fetchMeta(path);
    metaInFlight.set(path, promise);
    try {
      const result = await promise;
      metaCache.set(path, result);
      return result;
    } finally {
      metaInFlight.delete(path);
    }
  }

  async function fetchMeta(path: string): Promise<TargetTableMeta | undefined> {
    const res = await fetchFn(`${baseUrl}${path}/meta`);
    if (res.status === 401 || res.status === 403) return undefined;
    if (!res.ok) throw new Error(`Value-help meta fetch failed: ${res.status} ${res.statusText}`);

    const body = await res.json();
    const tableDef = createTableDef(body);

    return {
      searchable: body.searchable ?? false,
      vectorSearchable: body.vectorSearchable ?? false,
      columns: tableDef.columns,
      primaryKeys: body.primaryKeys ?? [],
      tableDef,
    };
  }

  async function query(path: string, q: ValueHelpQuery): Promise<ValueHelpResult> {
    const params = new URLSearchParams();

    if (q.select?.length) {
      params.set("$select", q.select.join(","));
    }
    if (q.skip !== undefined) {
      params.set("$skip", String(q.skip));
    }
    if (q.limit !== undefined) {
      params.set("$limit", String(q.limit));
    }

    if (q.search) {
      const meta = await getMeta(path);
      if (meta?.searchable) {
        params.set("$search", q.search);
      } else if (q.select?.length) {
        // Fallback: regex startsWith across select fields
        const orConditions = q.select.map((f) => ({
          [f]: { $regex: `^${escapeRegex(q.search!)}`, $options: "i" },
        }));
        params.set("$filter", JSON.stringify({ $or: orConditions }));
      }
    }

    if (q.filters && !q.search) {
      params.set("$filter", JSON.stringify(q.filters));
    }

    const qs = params.toString();
    const url = `${baseUrl}${path}${qs ? `?${qs}` : ""}`;
    const res = await fetchFn(url);
    if (!res.ok) throw new Error(`Value-help query failed: ${res.status} ${res.statusText}`);

    const body = await res.json();

    // The server may return { items, total } or a plain array
    if (Array.isArray(body)) {
      return { items: body };
    }
    return { items: body.items ?? body.data ?? [], total: body.total ?? body.count };
  }

  return { getMeta, query };
}

/** Escapes special regex characters in a string. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
