import type { Uniquery } from "@uniqu/core";

/** Default page size used by the export pager when the caller gives none. */
export const DEFAULT_EXPORT_PAGE_SIZE = 500;

/** One page of an export run — the subset of `PageResult` the pager needs. */
export interface ExportPage {
  data: Record<string, unknown>[];
  /** Total row count, when the endpoint reports one. */
  count?: number;
}

/** Fetches one page of the export query. Mirrors `client.pages(query, page, size)`. */
export type ExportPageFetcher = (
  query: Uniquery,
  page: number,
  size: number,
) => Promise<ExportPage>;

/** Rejection raised when an export is cancelled through its `AbortSignal`. */
export class ExportAbortError extends Error {
  /** Matches the DOM convention so `err.name === "AbortError"` checks work. */
  override readonly name = "AbortError";
  constructor(message = "Export aborted") {
    super(message);
  }
}

export interface CollectExportRowsOptions<T = Record<string, unknown>> {
  /** The query to page through. Pass it through {@link withStableOrder} first. */
  query: Uniquery;
  /** Rows per request. Default {@link DEFAULT_EXPORT_PAGE_SIZE}. */
  pageSize?: number;
  fetchPage: ExportPageFetcher;
  /** Aborts between pages; the returned promise rejects with {@link ExportAbortError}. */
  signal?: AbortSignal;
  /** Called after every settled page. `total` comes from the first page's `count`. */
  onProgress?: (done: number, total?: number) => void;
  /** Hard ceiling on collected rows — the pager stops once it is reached. */
  maxRows?: number;
  /**
   * Project each row as it arrives — the collected array holds the projection,
   * not the raw row, so a formatted export never keeps both in memory.
   * Identity by default.
   */
  mapRow?: (row: Record<string, unknown>) => T;
}

/**
 * Append the primary key(s) to a query's `$sort` as a tiebreaker so paging is
 * stable: two rows equal on every user sorter keep a deterministic relative
 * order, and no row is skipped or duplicated across page boundaries.
 *
 * Existing sort fields are preserved in order and never replaced — a pk the
 * user already sorts by is left where it is. Returns the input query when
 * there is nothing to add.
 */
export function withStableOrder(query: Uniquery, primaryKeys: readonly string[]): Uniquery {
  if (primaryKeys.length === 0) return query;
  const current = query.controls?.$sort ?? {};
  const missing = primaryKeys.filter((pk) => !(pk in current));
  if (missing.length === 0) return query;
  const $sort: Record<string, 1 | -1> = { ...(current as Record<string, 1 | -1>) };
  for (const pk of missing) $sort[pk] = 1;
  return { ...query, controls: { ...query.controls, $sort } };
}

/**
 * Page through `query` until the endpoint runs out of rows, collecting every
 * row into one array.
 *
 * Stops when a page comes back short (fewer rows than `pageSize`), when the
 * reported `count` is reached, or when `maxRows` is hit. Checks `signal`
 * before and after every request so a cancel lands between pages rather than
 * mid-flight.
 */
export async function collectExportRows<T = Record<string, unknown>>(
  opts: CollectExportRowsOptions<T>,
): Promise<{ rows: T[]; total?: number }> {
  const pageSize = opts.pageSize && opts.pageSize > 0 ? opts.pageSize : DEFAULT_EXPORT_PAGE_SIZE;
  const mapRow = opts.mapRow ?? ((row: Record<string, unknown>) => row as unknown as T);
  const rows: T[] = [];
  let total: number | undefined;
  let page = 1;

  for (;;) {
    throwIfAborted(opts.signal);
    const result = await opts.fetchPage(opts.query, page, pageSize);
    throwIfAborted(opts.signal);
    if (page === 1 && typeof result.count === "number") total = result.count;
    const data = result.data ?? [];
    // Truncate once, before the push loop, so `maxRows` is never exceeded and
    // the rows past the ceiling are not projected at all.
    const take =
      opts.maxRows === undefined ? data.length : Math.min(data.length, opts.maxRows - rows.length);
    for (let i = 0; i < take; i++) rows.push(mapRow(data[i]!));
    opts.onProgress?.(rows.length, total);
    if (
      data.length < pageSize ||
      (opts.maxRows !== undefined && rows.length >= opts.maxRows) ||
      (total !== undefined && rows.length >= total)
    ) {
      break;
    }
    page++;
  }

  return { rows, total };
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ExportAbortError();
}
