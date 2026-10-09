import type { Client, FilterExpr } from "@atscript/db-client";
import { escapeRegex } from "../shared/str";
import type { ResolvedValueHelp } from "./resolve";

export interface ValueHelpSearchOptions {
  /** Search term. Empty or undefined returns all records. */
  text?: string;
  /** "form" = PK + label + descr; "filter" = all dict fields including attrs. Default: "form". */
  mode?: "form" | "filter";
  /** Max results. Default: 20. */
  limit?: number;
  /** Override the computed select fields. */
  select?: string[];
  /**
   * Static dictionary scope (`ValueHelpInfo.filter`) — AND'd with the search
   * filter and with `$search`. Since 0.1.148.
   */
  filter?: FilterExpr;
  /**
   * The target field the picker commits (`ValueHelpInfo.targetField`). It is
   * selected, and it is the exact-match key of a non-searchable search — a
   * composite-key dictionary's `primaryKeys[0]` is not the value. Default:
   * `primaryKeys[0]`. Since 0.1.148.
   */
  valueField?: string;
}

export interface ValueHelpResult {
  items: Record<string, unknown>[];
}

// ── Search result sharing ─────────────────────────────────────
//
// A form with N pickers on one dictionary mounts N `ValueHelpClient`s that
// all fire the same initial search. Searches are shared per `Client`
// instance: an identical request (same filter + controls) joins the one in
// flight, and a settled result is reused for a short TTL. Keyed by the
// `Client`, so the cache is dropped with it; `resetMetaCache()` (login /
// logout) clears every client's cache, and so does a backend action or
// delete run through vue-table's actions.

interface SharedSearch {
  promise: Promise<Record<string, unknown>[]>;
  /** `performance.now()`-style timestamp the response settled at; `undefined` while in flight. */
  settledAt?: number;
}

const DEFAULT_VALUE_HELP_CACHE_TTL = 5000;
let cacheTtl = DEFAULT_VALUE_HELP_CACHE_TTL;
let searches = new WeakMap<Client, Map<string, SharedSearch>>();

/**
 * How long (ms) a settled value-help search is reused for an identical
 * search on the same client. Default 5000. `0` shares only searches still in
 * flight; a negative value turns sharing off. Server-side rendering never
 * shares (one process serves many viewers).
 */
export function setValueHelpCacheTtl(ms: number): void {
  cacheTtl = ms;
}

/**
 * Drop shared value-help search results — for one `client`, or for every
 * client when omitted. Call after writing to a dictionary outside the
 * built-in table actions to make pickers refetch at once.
 */
export function invalidateValueHelpCache(client?: Client): void {
  if (client) searches.get(client)?.clear();
  else searches = new WeakMap();
}

function now(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

/** Cache key of a plain-JSON request; `undefined` when it holds anything else (never shared). */
function requestKey(request: Record<string, unknown>): string | undefined {
  let plain = true;
  try {
    const key = JSON.stringify(request, (_k, v: unknown) => {
      if (typeof v === "function" || typeof v === "symbol") plain = false;
      else if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        const proto = Object.getPrototypeOf(v) as unknown;
        if (proto !== Object.prototype && proto !== null) plain = false;
      }
      return v;
    });
    return plain ? key : undefined;
  } catch {
    return undefined;
  }
}

function sharedQuery(
  client: Client,
  request: Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  const run = () => client.query(request as any) as Promise<Record<string, unknown>[]>;
  if (cacheTtl < 0 || typeof window === "undefined") return run();
  const key = requestKey(request);
  if (key === undefined) return run();
  let byKey = searches.get(client);
  if (!byKey) searches.set(client, (byKey = new Map()));
  const hit = byKey.get(key);
  if (hit && (hit.settledAt === undefined || now() - hit.settledAt < cacheTtl)) return hit.promise;
  const entry: SharedSearch = {
    promise: run().then(
      (items) => {
        entry.settledAt = now();
        return items;
      },
      (err: unknown) => {
        if (byKey.get(key) === entry) byKey.delete(key);
        throw err;
      },
    ),
  };
  byKey.set(key, entry);
  return entry.promise;
}

/**
 * Value-help query client. Wraps a `Client` from `@atscript/db-client`
 * with FK-specific search logic (regex fallback for non-searchable tables,
 * $select scoping).
 *
 * Consumers resolve the target's metadata once via `resolveValueHelp(url)`
 * and pass the resulting `ResolvedValueHelp` to `search()`. Label resolution
 * for cells is deliberately unsupported — cells always display raw ids.
 *
 * Identical searches on the same `Client` are shared (see
 * {@link setValueHelpCacheTtl}).
 */
export class ValueHelpClient {
  private readonly _client: Client;

  constructor(client: Client) {
    this._client = client;
  }

  /**
   * Search the target with value-help semantics.
   *
   * - If target is searchable → sends `$search` (server full-text)
   * - If not searchable → sends `$or` regex across select fields + exact PK match
   */
  async search(
    resolved: ResolvedValueHelp,
    opts?: ValueHelpSearchOptions,
  ): Promise<ValueHelpResult> {
    const mode = opts?.mode ?? "form";
    const limit = opts?.limit ?? 20;
    const valueField = opts?.valueField;
    const selectFields = opts?.select ?? computeSelectFields(resolved, mode, valueField);
    const text = opts?.text;
    const scope = opts?.filter;
    const controls: Record<string, unknown> = { $select: selectFields, $limit: limit };

    let filter: FilterExpr | undefined = scope;
    if (text) {
      if (resolved.searchable) {
        controls.$search = text;
      } else {
        // Non-searchable: `$or` regex across the fields + exact match on the value key
        const keyField = valueField ?? resolved.primaryKeys[0] ?? resolved.labelField;
        const search = buildOrFilter(text, selectFields, keyField) as FilterExpr;
        filter = scope ? ({ $and: [scope, search] } as FilterExpr) : search;
      }
    }

    const items = await sharedQuery(this._client, { ...(filter && { filter }), controls });
    // Each caller gets its own array (the rows themselves are shared).
    return { items: Array.isArray(items) ? items.slice() : items };
  }
}

/**
 * Compute the $select fields for a value-help query — always including the
 * `valueField` the picker commits (a unique non-PK field is otherwise never fetched).
 */
function computeSelectFields(
  resolved: ResolvedValueHelp,
  mode: "form" | "filter",
  valueField?: string,
): string[] {
  const fields = [...resolved.primaryKeys, resolved.labelField];
  if (valueField) fields.push(valueField);
  if (resolved.descrField) fields.push(resolved.descrField);
  if (mode === "filter") fields.push(...resolved.attrFields);
  return [...new Set(fields)];
}

/**
 * Build a Uniquery `$or` filter for value-help search across multiple fields.
 * Uses regex startsWith (case-insensitive) on text fields + exact match on PK.
 */
function buildOrFilter(text: string, fields: string[], pkField: string): Record<string, unknown> {
  const escaped = escapeRegex(text);
  const conditions: Record<string, unknown>[] = [];

  for (const field of fields) {
    if (field !== pkField) {
      conditions.push({ [field]: { $regex: `/^${escaped}/i` } });
    }
  }

  // Exact match on PK (parse as number for numeric PKs)
  const asNum = Number(text);
  if (!Number.isNaN(asNum)) {
    conditions.push({ [pkField]: asNum });
  } else {
    conditions.push({ [pkField]: text });
  }

  return { $or: conditions };
}
