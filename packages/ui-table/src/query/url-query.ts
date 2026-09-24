import type { SortControl } from "@atscript/ui";
import type { FilterExpr } from "@uniqu/core";
import { buildUrl } from "@uniqu/url/builder";
import { parseUrl } from "@uniqu/url";
import type { FieldFilters } from "../filters/filter-types";
import {
  decomposeUniqueryFilter,
  filterExprFields,
  type UnsupportedFilter,
} from "../filters/uniquery-to-filters";
import { buildTableQuery } from "./build-table-query";

/** State subset that round-trips through the URL bridge. */
export interface UrlQueryStateLike {
  filters: FieldFilters;
  /**
   * Residual filter conditions, AND-ed after `filters`. Only the ones the
   * filter gate owns are written (see {@link residualGateOwns}). Since 0.1.140.
   */
  residualFilters?: FilterExpr[];
  sorters: SortControl[];
  /** 1-based page number. `1` is the default and is omitted from the URL. */
  page?: number;
  /** Per-page size. Omitted from the URL when equal to `defaultItemsPerPage`. */
  itemsPerPage?: number;
  /** Full-text search term. Omitted from the URL when empty. */
  searchTerm?: string;
  /**
   * Runtime "preserve relevance ranking" flag — while true and a search is
   * active, user sorters are suppressed at query time. Serialized as
   * `$relevance=1|0` only when a search term is present AND the value differs
   * from `defaultIgnoreSorters`, so a link shared mid-search reproduces what
   * the sharer saw.
   */
  ignoreSorters?: boolean;
}

/**
 * The URL control that marks a query string as a complete snapshot of the
 * table's filters and sorters. Restoring a URL that carries it clears every
 * filter and sorter the URL owns before applying its own, so nothing the URL
 * omits survives (empty `$sort` included). A URL without it is an overlay:
 * its filters and sorters are laid over the table's starting ones.
 *
 * The encoder writes it bare (`…&$snapshot`) on every URL; the decoder goes
 * by presence alone, whatever the value. `UrlQuerySync.snapshot: false` turns
 * both off.
 *
 * @since 0.1.139
 */
export const URL_SNAPSHOT_KEY = "$snapshot";

/** Snapshot recovered from a URL string — partial on purpose so callers can layer it onto state. */
export interface UrlQueryStateSnapshot {
  filters: FieldFilters;
  sorters: SortControl[];
  /**
   * `true` when the URL carried {@link URL_SNAPSHOT_KEY} (and `sync.snapshot`
   * is not `false`). Omitted otherwise. Since 0.1.139.
   */
  snapshot?: true;
  /**
   * Pieces of the URL's filter that are left out because field filters
   * cannot express them — see `uniqueryFilterToFieldFilters`. Since 0.1.140
   * only the pieces NOT carried in `residual`. Omitted when none. Since 0.1.139.
   */
  unsupported?: UnsupportedFilter[];
  /**
   * Filter pieces field filters cannot express, carried as residual
   * conditions (see `decomposeUniqueryFilter`). Omitted when there are none
   * or `sync.residual` is `false`. Since 0.1.140.
   */
  residual?: FilterExpr[];
  /**
   * Raw record offset from `$skip` (omitted when no `$skip` in URL). The
   * decoder does NOT compute a page index — that requires `itemsPerPage`,
   * which is the consumer's private preference. Consumers compute
   * `page = Math.floor(skip / currentItemsPerPage) + 1`.
   */
  skip?: number;
  searchTerm: string;
  /**
   * Runtime relevance flag decoded from `$relevance` (omitted when the URL
   * carries no explicit value — the recipient keeps their configured default).
   */
  ignoreSorters?: boolean;
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
  /**
   * Whether the encoder writes {@link URL_SNAPSHOT_KEY} and the decoder
   * honours it. Default `true`; `false` makes every URL an overlay.
   * Since 0.1.139.
   */
  snapshot?: boolean;
  /**
   * Whether filter pieces the field-filter model cannot hold travel as
   * residual conditions. Default `true`: the encoder writes
   * `UrlQueryStateLike.residualFilters` and the decoder returns them as
   * `residual`. `false`: neither — the 0.1.139 behaviour, where such
   * pieces are left out and reported. Inert when `filters` is off.
   * Since 0.1.140.
   */
  residual?: boolean;
}

export interface UrlQueryDefaults {
  /** Consumer's `:limit` prop. Used to omit `$limit` from the URL when state matches it. */
  defaultItemsPerPage: number;
  /** Per-aspect sync gates. Omitted = full sync (existing behaviour). */
  sync?: UrlQuerySync;
  /**
   * Consumer's configured `ignoreSortersWhenSearched` default. `$relevance`
   * is emitted only when the runtime flag differs from this. Default `false`.
   */
  defaultIgnoreSorters?: boolean;
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

/**
 * Does a URL under `gate` own `path`? The single place the tri-state is decided,
 * and the companion to {@link resolveAspectGate}.
 *
 * "Owns" means the URL is authoritative for that field: it serializes the field
 * on write, and on read its silence about the field is meaningful. An `"all"`
 * gate owns every path, an allowlist owns exactly its members (the rest are
 * private and never round-trip), `"none"` owns nothing.
 *
 * Both directions need it. The encoder writes only owned fields; a history
 * restore must clear the owned ones before overlaying the URL, or a filter the
 * user removed survives the Back that should have removed it.
 *
 * @since 0.1.137
 */
export function gateOwns(gate: AspectGate, path: string): boolean {
  if (gate === "all") return true;
  if (gate === "none") return false;
  return gate.has(path);
}

/**
 * Does a URL under `gate` own the residual condition `expr`? Only when it
 * owns every field the condition references — a condition that touches a
 * private field stays private as a whole.
 *
 * @internal Exported for `@atscript/vue-table`.
 */
export function residualGateOwns(gate: AspectGate, expr: FilterExpr): boolean {
  const fields = filterExprFields(expr);
  return fields.length > 0 && fields.every((path) => gateOwns(gate, path));
}

function pickFilterPaths(filters: FieldFilters, gate: AspectGate): FieldFilters {
  const out: FieldFilters = {};
  for (const path in filters) {
    if (gateOwns(gate, path)) out[path] = filters[path];
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
 * Stamps {@link URL_SNAPSHOT_KEY} unless `defaults.sync.snapshot` is `false`
 * (or neither filters nor sorters sync), so the default view serializes to
 * `"$snapshot"`; with the marker off it serializes to `""` (no leading `?`).
 */
export function stateToUrlQueryString(
  state: UrlQueryStateLike,
  defaults: UrlQueryDefaults,
): string {
  const filtersGate = resolveAspectGate(defaults.sync?.filters);
  const sortersGate = resolveAspectGate(defaults.sync?.sorters);
  const searchOff = defaults.sync?.search === false;
  const paginationOff = defaults.sync?.pagination === false;

  // "all" passes the state through untouched; every other gate filters by
  // ownership, which covers "none" (owns nothing) without its own arm.
  const filters: FieldFilters =
    filtersGate === "all" ? state.filters : pickFilterPaths(state.filters, filtersGate);

  const sorters: SortControl[] =
    sortersGate === "all"
      ? state.sorters
      : state.sorters.filter((s) => gateOwns(sortersGate, s.field));

  const residualFilters =
    defaults.sync?.residual === false || !state.residualFilters?.length
      ? undefined
      : state.residualFilters.filter((expr) => residualGateOwns(filtersGate, expr));

  const query = buildTableQuery({
    visibleColumnPaths: [],
    sorters,
    filters,
    residualFilters,
    search: searchOff ? undefined : state.searchTerm || undefined,
  });

  // `$relevance` rides with `$search` — meaningless without one, and only
  // when the runtime flag differs from the recipient-side default.
  if (
    !searchOff &&
    state.searchTerm &&
    state.ignoreSorters !== undefined &&
    state.ignoreSorters !== (defaults.defaultIgnoreSorters ?? false)
  ) {
    query.controls!.$relevance = state.ignoreSorters ? 1 : 0;
  }

  if (!paginationOff) {
    // Emit `$skip` only — `$limit` (page size) is a private user preference,
    // not view-defining state. Recipients keep their own page size and the
    // raw offset lands them on records that include the linker's window.
    const itemsPerPage = state.itemsPerPage ?? defaults.defaultItemsPerPage;
    const page = state.page ?? 1;
    if (page > 1) query.controls!.$skip = (page - 1) * itemsPerPage;
  }

  // Meaningless when the URL carries neither filters nor sorters. Empty value
  // → the builder writes the bare key; set last, so it trails the URL.
  if (defaults.sync?.snapshot !== false && (filtersGate !== "none" || sortersGate !== "none")) {
    query.controls![URL_SNAPSHOT_KEY] = "";
  }

  return buildUrl(query);
}

/**
 * The `$`-controls {@link urlQueryStringToState} actually reads. Any other
 * `$key` is ignored by the parser, so it is NOT the table's to remove.
 */
const CONSUMED_CONTROLS = new Set(["$sort", "$search", "$relevance", "$skip", URL_SNAPSHOT_KEY]);

/**
 * Characters that can only appear in a uniqu filter key, never in a page flag:
 * comparison operators, `^` (OR), `( )` (groups) and `{ }` (`$in` lists).
 */
const FILTER_OPERATOR_CHAR = /[<>!~()^{}]/;

/**
 * Whether {@link urlQueryStringToState} would consume the query key `key` —
 * i.e. whether the key belongs to the table rather than to the page hosting
 * it. This is the ownership rule the `useTableUrlQuery` router bridge reads
 * and writes by, so both directions agree: a key the parser ignores is never
 * removed, and a key it reads is the table's to remove.
 *
 * Shape-only, and deliberately conservative for bare `field=value` keys: a
 * filter on a column and a host flag are indistinguishable without the table
 * definition, so those are owned only once the bridge has written them
 * itself (or once a `prefix` namespaces them).
 *
 * @since 0.1.133
 */
export function urlQueryConsumesKey(key: string): boolean {
  if (key.startsWith("$")) return CONSUMED_CONTROLS.has(key);
  return FILTER_OPERATOR_CHAR.test(key);
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
 * - filter pieces field filters cannot express (cross-field OR, unknown
 *   operator, …) → left out of `filters` and listed in `unsupported`, never
 *   approximated (the parser does not warn — the caller decides). Unless
 *   `sync.residual` is `false`, those whose fields are all known come back
 *   in `residual` instead
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
  const decomposed =
    filtersGate === "none"
      ? null
      : decomposeUniqueryFilter(parsed.filter, {
          knownFields: filterKnown,
          carry: opts.sync?.residual !== false,
        });
  const filters: FieldFilters = decomposed?.filters ?? {};

  const sorters: SortControl[] = [];
  if (sortersGate !== "none") {
    const $sort = parsed.controls?.$sort;
    if ($sort && typeof $sort === "object") {
      for (const field in $sort) {
        if (knownSet && !knownSet.has(field)) continue;
        if (!gateOwns(sortersGate, field)) continue;
        const dir = ($sort as Record<string, unknown>)[field];
        if (dir === 1) sorters.push({ field, direction: "asc" });
        else if (dir === -1) sorters.push({ field, direction: "desc" });
      }
    }
  }

  const $search = parsed.controls?.$search;
  const searchTerm = !searchOff && typeof $search === "string" ? $search : "";

  const out: UrlQueryStateSnapshot = { filters, sorters, searchTerm };
  if (decomposed?.unsupported.length) out.unsupported = decomposed.unsupported;
  if (decomposed?.residual.length) out.residual = decomposed.residual;

  if (opts.sync?.snapshot !== false && parsed.controls && URL_SNAPSHOT_KEY in parsed.controls) {
    out.snapshot = true;
  }

  if (!searchOff) {
    // `$relevance` round-trips as a string on the wire ("1" / "0").
    const $relevance = parsed.controls?.$relevance;
    if ($relevance === "1" || $relevance === 1) out.ignoreSorters = true;
    else if ($relevance === "0" || $relevance === 0) out.ignoreSorters = false;
  }

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
