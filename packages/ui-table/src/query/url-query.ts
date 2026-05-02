import type { SortControl } from "@atscript/ui";
import { buildUrl } from "@uniqu/url/builder";
import { parseUrl } from "@uniqu/url";
import type { FieldFilters } from "../filters/filter-types";
import { uniqueryFilterToFieldFilters } from "../filters/uniquery-to-filters";
import { buildTableQuery } from "./build-table-query";

/** State subset that round-trips through the URL bridge. */
export interface UrlQueryStateLike {
  filters: FieldFilters;
  sorters: SortControl[];
  /** 1-based page number. `1` is the default and is omitted from the URL. */
  page?: number;
  /** Per-page size. Omitted from the URL when equal to `defaultItemsPerPage`. */
  itemsPerPage?: number;
  /** Full-text search term. Omitted from the URL when empty. */
  searchTerm?: string;
}

/** Snapshot recovered from a URL string — partial on purpose so callers can layer it onto state. */
export interface UrlQueryStateSnapshot {
  filters: FieldFilters;
  sorters: SortControl[];
  /**
   * Raw record offset from `$skip` (omitted when no `$skip` in URL). The
   * decoder does NOT compute a page index — that requires `itemsPerPage`,
   * which is the consumer's private preference. Consumers compute
   * `page = Math.floor(skip / currentItemsPerPage) + 1`.
   */
  skip?: number;
  searchTerm: string;
}

/**
 * Per-aspect opt-in/out for the URL bridge. Honoured symmetrically by both
 * `stateToUrlQueryString` (encoder) and `urlQueryStringToState` (decoder) —
 * the same gate must apply to both directions or the `lastEmittedUrl`
 * echo guard mismatches and produces self-echoing URLs.
 *
 * Default (omitted, or any field `undefined` / `true`): full sync — backward
 * compatible with pre-`UrlQuerySync` behaviour.
 */
export interface UrlQuerySync {
  /**
   * Filters round-trip.
   * - `true` / `undefined` (default): all filters.
   * - `false` / `[]`: no filters in URL; `applyUrlQuery` skips filter writes.
   * - `string[]`: only listed field paths; non-allowlist filters stay private.
   */
  filters?: boolean | string[];
  /** Sorters — same `boolean | string[]` semantics, allowlist matches `SortControl.field`. */
  sorters?: boolean | string[];
  /** Whether `searchTerm` syncs as `$search`. Default true. */
  search?: boolean;
  /** Whether pagination (`$skip` + `$limit`) syncs. Page and limit are coupled — one knob. */
  pagination?: boolean;
}

export interface UrlQueryDefaults {
  /** Consumer's `:limit` prop. Used to omit `$limit` from the URL when state matches it. */
  defaultItemsPerPage: number;
  /** Per-aspect sync gates. Omitted = full sync (existing behaviour). */
  sync?: UrlQuerySync;
}

/**
 * Resolve a `boolean | string[]` aspect gate into a tri-state:
 * - `"all"` → pass through unchanged
 * - `"none"` → empty / off
 * - `Set<string>` → allowlist
 */
export type AspectGate = "all" | "none" | Set<string>;

export function resolveAspectGate(value: boolean | string[] | undefined): AspectGate {
  if (value === undefined || value === true) return "all";
  if (value === false) return "none";
  if (value.length === 0) return "none";
  return new Set(value);
}

function pickFilterPaths(filters: FieldFilters, allow: Set<string>): FieldFilters {
  const out: FieldFilters = {};
  for (const path in filters) {
    if (allow.has(path)) out[path] = filters[path];
  }
  return out;
}

/**
 * Serialize the table state subset into a URL query string.
 *
 * Reuses `buildTableQuery` for the filter/sort/search shape (no `$select`,
 * `$actions`, `forceFilters`, `forceSorters` — those are not user state) and
 * appends `$skip` / `$limit` for pagination.
 *
 * Returns `""` (no leading `?`) for the default view.
 */
export function stateToUrlQueryString(
  state: UrlQueryStateLike,
  defaults: UrlQueryDefaults,
): string {
  const filtersGate = resolveAspectGate(defaults.sync?.filters);
  const sortersGate = resolveAspectGate(defaults.sync?.sorters);
  const searchOff = defaults.sync?.search === false;
  const paginationOff = defaults.sync?.pagination === false;

  const filters: FieldFilters =
    filtersGate === "none"
      ? {}
      : filtersGate === "all"
        ? state.filters
        : pickFilterPaths(state.filters, filtersGate);

  const sorters: SortControl[] =
    sortersGate === "none"
      ? []
      : sortersGate === "all"
        ? state.sorters
        : state.sorters.filter((s) => sortersGate.has(s.field));

  const query = buildTableQuery({
    visibleColumnPaths: [],
    sorters,
    filters,
    search: searchOff ? undefined : state.searchTerm || undefined,
  });

  if (!paginationOff) {
    // Emit `$skip` only — `$limit` (page size) is a private user preference,
    // not view-defining state. Recipients keep their own page size and the
    // raw offset lands them on records that include the linker's window.
    const itemsPerPage = state.itemsPerPage ?? defaults.defaultItemsPerPage;
    const page = state.page ?? 1;
    if (page > 1) query.controls!.$skip = (page - 1) * itemsPerPage;
  }

  return buildUrl(query);
}

export interface UrlQueryParseOptions {
  /**
   * Field paths the table knows about. Conditions on fields outside this set
   * are silently dropped. Omit to accept any field (useful when the table
   * definition isn't loaded yet).
   */
  knownFields?: Iterable<string>;
  /** Per-aspect sync gates — must match the encoder's config to keep the round-trip symmetric. */
  sync?: UrlQuerySync;
}

/**
 * Parse a URL query string back into the table state subset.
 *
 * Robust by design — schema drift and copy-paste errors must not break the
 * recipient's view:
 * - unknown fields (not in `knownFields`) → silently dropped
 * - unsupported operators → silently dropped
 * - unknown controls (e.g. `$weird=42`) → silently ignored
 * - malformed query → `{ filters: {}, sorters: [], searchTerm: "" }`
 *
 * `page` and `itemsPerPage` are returned only when the URL specified them
 * (`$skip` / `$limit`); callers compose them onto state without overwriting
 * defaults when the URL was silent.
 */
export function urlQueryStringToState(
  urlString: string,
  opts: UrlQueryParseOptions = {},
): UrlQueryStateSnapshot {
  if (!urlString) {
    return { filters: {}, sorters: [], searchTerm: "" };
  }

  let parsed: ReturnType<typeof parseUrl>;
  try {
    parsed = parseUrl(urlString);
  } catch {
    return { filters: {}, sorters: [], searchTerm: "" };
  }

  const filtersGate = resolveAspectGate(opts.sync?.filters);
  const sortersGate = resolveAspectGate(opts.sync?.sorters);
  const searchOff = opts.sync?.search === false;
  const paginationOff = opts.sync?.pagination === false;

  const knownSet = opts.knownFields ? new Set(opts.knownFields) : null;

  // For filters, intersect knownFields (schema gate) with allowlist (sync gate).
  let filterKnown: Set<string> | undefined;
  if (filtersGate === "all") {
    filterKnown = knownSet ?? undefined;
  } else if (filtersGate !== "none") {
    if (knownSet) {
      filterKnown = new Set();
      for (const path of filtersGate) if (knownSet.has(path)) filterKnown.add(path);
    } else {
      filterKnown = filtersGate;
    }
  }
  const filters: FieldFilters =
    filtersGate === "none" ? {} : uniqueryFilterToFieldFilters(parsed.filter, filterKnown);

  const sorters: SortControl[] = [];
  if (sortersGate !== "none") {
    const $sort = parsed.controls?.$sort;
    if ($sort && typeof $sort === "object") {
      for (const field in $sort) {
        if (knownSet && !knownSet.has(field)) continue;
        if (sortersGate !== "all" && !sortersGate.has(field)) continue;
        const dir = ($sort as Record<string, unknown>)[field];
        if (dir === 1) sorters.push({ field, direction: "asc" });
        else if (dir === -1) sorters.push({ field, direction: "desc" });
      }
    }
  }

  const $search = parsed.controls?.$search;
  const searchTerm = !searchOff && typeof $search === "string" ? $search : "";

  const out: UrlQueryStateSnapshot = { filters, sorters, searchTerm };

  if (!paginationOff) {
    // Decoder returns raw `$skip` only; consumer divides by their own current
    // `itemsPerPage` to compute a page index. `$limit` is intentionally NOT
    // read — page size is the recipient's preference, not the linker's.
    const $skip = parsed.controls?.$skip;
    if (typeof $skip === "number" && $skip > 0 && Number.isFinite($skip)) {
      out.skip = $skip;
    }
  }

  return out;
}
