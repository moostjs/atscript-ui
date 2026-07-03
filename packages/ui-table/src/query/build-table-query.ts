import type { SortControl } from "@atscript/ui";
import type { FilterExpr, Uniquery } from "@uniqu/core";
import type { FieldFilters } from "../filters/filter-types";
import { filtersToUniqueryFilter } from "../filters/filters-to-uniquery";
import { mergeSorters } from "./merge-sorters";
import { mergeFilters } from "./merge-filters";

/** Options for building a Uniquery from table state. */
export interface BuildTableQueryOptions {
  /** Paths of visible columns — used for `$select` projection. */
  visibleColumnPaths: string[];
  /** Extra leaf paths unioned (deduped) into `$select` beyond the visible columns. Never rendered as columns. */
  extraSelect?: string[];
  /** User-configured sorters. */
  sorters: SortControl[];
  /** Always-applied sorters (prepended before user sorters). */
  forceSorters?: SortControl[];
  /**
   * When true, user `sorters` are omitted from `$sort`; `forceSorters` still
   * apply. Used to preserve search relevance ranking — the caller computes
   * the search-active condition; this function just honours the flag.
   */
  ignoreSorters?: boolean;
  /** User-configured field filters. */
  filters: FieldFilters;
  /** Always-applied Uniquery filter (AND'd with user filters). */
  forceFilters?: FilterExpr;
  /** Full-text search term. */
  search?: string;
  /** Search index name for `$search`. */
  searchIndex?: string;
  /**
   * Set `controls.$actions = true` so each returned row carries
   * `$actions: string[]` — server-evaluated names of row/rows-level actions
   * NOT disabled for that row. Off by default; renderers flip it on when a
   * row-actions column will render gateable actions.
   */
  includeActions?: boolean;
}

/**
 * Build a Uniquery object from table UI state.
 *
 * Pure function — no framework dependencies.
 * Combines user filters with force filters, merges sorters,
 * projects visible columns, and applies pagination.
 */
export function buildTableQuery(opts: BuildTableQueryOptions): Uniquery {
  const userFilter = filtersToUniqueryFilter(opts.filters);
  const filter = mergeFilters(opts.forceFilters, userFilter);

  const userSorters = opts.ignoreSorters ? [] : opts.sorters;
  const sorters = opts.forceSorters?.length
    ? mergeSorters(opts.forceSorters, userSorters)
    : userSorters;

  const $sort: Record<string, 1 | -1> = {};
  for (const s of sorters) {
    $sort[s.field] = s.direction === "asc" ? 1 : -1;
  }

  const controls: Uniquery["controls"] = {};

  const sel = opts.extraSelect?.length
    ? [...new Set([...opts.visibleColumnPaths, ...opts.extraSelect])]
    : opts.visibleColumnPaths;
  if (sel.length > 0) controls.$select = sel;

  if (sorters.length > 0) {
    controls.$sort = $sort;
  }

  if (opts.search) {
    const searchKey: `$${string}` = opts.searchIndex ? `$search:${opts.searchIndex}` : "$search";
    controls[searchKey] = opts.search;
  }

  if (opts.includeActions) {
    controls.$actions = true;
  }

  const query: Uniquery = { controls };
  if (filter) query.filter = filter;

  return query;
}
