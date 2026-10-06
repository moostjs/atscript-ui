import type { Client, FilterExpr } from "@atscript/db-client";
import { escapeRegex } from "../shared/str";

export interface DistinctValuesOptions {
  /** Search text: a case-insensitive prefix match for strings, an exact match for numbers. */
  text?: string;
  /** Page size. Default: 50. */
  limit?: number;
  /**
   * Rows to skip (the next page of a scrolled picker). Distinct values are only
   * stable across pages when ordered, so a caller pages only with `sortable`.
   */
  skip?: number;
  /** Send `$sort` on the grouped field — only when the server lists it as sortable. */
  sortable?: boolean;
  /** The field stores numbers: search is an exact match and non-numeric text finds nothing. */
  numeric?: boolean;
  /** Extra scope AND'd into the query (e.g. the table's `forceFilters`). */
  filter?: FilterExpr;
}

/**
 * `true` for a 4xx answer — the server declined this picker (gate, ARBAC, unknown field).
 * @internal Shared with `@atscript/vue-table`.
 */
export function isPickerDeclined(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === "number" && status >= 400 && status < 500;
}

/**
 * Distinct values of one column of the table behind `client`, via
 * `/query?$groupBy=<field>`. All server gates (hidden field, ARBAC `$groupBy`
 * control, row scope, write-only, encrypted) apply as for any grouped read; a
 * 4xx rejects with a `ClientError` — see {@link isPickerDeclined}.
 * `hasMore` tells whether another page follows.
 *
 * @internal Backs the distinct-values picker of `@atscript/vue-table`.
 */
export async function fetchDistinctValues(
  client: Pick<Client, "aggregate">,
  field: string,
  opts: DistinctValuesOptions = {},
): Promise<{ items: unknown[]; hasMore: boolean }> {
  const limit = opts.limit ?? 50;
  const text = opts.text?.trim();

  const conditions: FilterExpr[] = [];
  if (opts.filter) conditions.push(opts.filter);
  if (text) {
    if (opts.numeric) {
      const n = Number(text);
      if (!Number.isFinite(n)) return { items: [], hasMore: false };
      conditions.push({ [field]: n } as FilterExpr);
    } else {
      conditions.push({ [field]: { $regex: `/^${escapeRegex(text)}/i` } } as FilterExpr);
    }
  }
  const filter = conditions.length > 1 ? ({ $and: conditions } as FilterExpr) : conditions[0];

  const rows = (await client.aggregate({
    ...(filter && { filter }),
    controls: {
      $groupBy: [field],
      $select: [field],
      ...(opts.sortable && { $sort: { [field]: 1 } }),
      // one extra row tells whether another page follows
      $limit: limit + 1,
      $skip: opts.skip ?? 0,
    },
  } as never)) as Record<string, unknown>[];

  const items = rows
    .slice(0, limit)
    .map((r) => r[field])
    .filter((v) => v !== null && v !== undefined);
  return { items, hasMore: rows.length > limit };
}
