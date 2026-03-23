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
  /** User-configured sorters. */
  sorters: SortControl[];
  /** Always-applied sorters (prepended before user sorters). */
  forceSorters?: SortControl[];
  /** User-configured field filters. */
  filters: FieldFilters;
  /** Always-applied Uniquery filter (AND'd with user filters). */
  forceFilters?: FilterExpr;
  /** Full-text search term. */
  search?: string;
  /** Search index name for `$search`. */
  searchIndex?: string;
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

  const sorters = opts.forceSorters?.length
    ? mergeSorters(opts.forceSorters, opts.sorters)
    : opts.sorters;

  const $sort: Record<string, 1 | -1> = {};
  for (const s of sorters) {
    $sort[s.field] = s.direction === "asc" ? 1 : -1;
  }

  const controls: Uniquery["controls"] = {};

  if (opts.visibleColumnPaths.length > 0) {
    controls.$select = opts.visibleColumnPaths;
  }

  if (sorters.length > 0) {
    controls.$sort = $sort;
  }

  if (opts.search) {
    const searchKey: `$${string}` = opts.searchIndex ? `$search:${opts.searchIndex}` : "$search";
    controls[searchKey] = opts.search;
  }

  const query: Uniquery = { controls };
  if (filter) query.filter = filter;

  return query;
}
