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

/**
 * Value-help query client. Wraps a `Client` from `@atscript/db-client`
 * with FK-specific search logic (regex fallback for non-searchable tables,
 * $select scoping).
 *
 * Consumers resolve the target's metadata once via `resolveValueHelp(url)`
 * and pass the resulting `ResolvedValueHelp` to `search()`. Label resolution
 * for cells is deliberately unsupported — cells always display raw ids.
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

    const items = await this._client.query({ ...(filter && { filter }), controls } as any);
    return { items: items as Record<string, unknown>[] };
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
