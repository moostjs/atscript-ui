import type { Client } from "@atscript/db-client";
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
    const selectFields = opts?.select ?? computeSelectFields(resolved, mode);
    const text = opts?.text;

    if (!text) {
      const items = await this._client.query({
        controls: { $select: selectFields, $limit: limit },
      } as any);
      return { items: items as Record<string, unknown>[] };
    }

    if (resolved.searchable) {
      const items = await this._client.query({
        controls: { $select: selectFields, $limit: limit, $search: text },
      } as any);
      return { items: items as Record<string, unknown>[] };
    }

    // Non-searchable: build $or regex filter across fields + exact PK match
    const pkField = resolved.primaryKeys[0] ?? resolved.labelField;
    const filter = buildOrFilter(text, selectFields, pkField);
    const items = await this._client.query({
      filter,
      controls: { $select: selectFields, $limit: limit },
    } as any);
    return { items: items as Record<string, unknown>[] };
  }
}

/**
 * Compute the $select fields for a value-help query.
 */
function computeSelectFields(resolved: ResolvedValueHelp, mode: "form" | "filter"): string[] {
  const fields = [...resolved.primaryKeys, resolved.labelField];
  if (resolved.descrField) fields.push(resolved.descrField);
  if (mode === "filter") fields.push(...resolved.attrFields);
  return [...new Set(fields)];
}

/**
 * Build a Uniquery `$or` filter for value-help search across multiple fields.
 * Uses regex startsWith (case-insensitive) on text fields + exact match on PK.
 */
function buildOrFilter(text: string, fields: string[], pkField: string): Record<string, unknown> {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
