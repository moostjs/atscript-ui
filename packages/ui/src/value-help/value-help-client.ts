import type { Client } from "@atscript/db-client";
import type { ValueHelpInfo } from "./types";
import type { TableDef } from "../table/types";
import { createTableDef } from "../table/create-table-def";
import { str } from "../shared/str";

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
 * $select scoping, label resolution).
 *
 * Reusable across form comboboxes, table filter dropdowns, and custom components.
 */
export class ValueHelpClient {
  private readonly _client: Client;
  private _searchable: boolean | undefined;

  constructor(client: Client) {
    this._client = client;
  }

  /**
   * Search the target table with value-help semantics.
   *
   * - If target is searchable → sends `$search` (server full-text)
   * - If not searchable → sends `$or` regex across select fields + exact PK match
   */
  async search(info: ValueHelpInfo, opts?: ValueHelpSearchOptions): Promise<ValueHelpResult> {
    const mode = opts?.mode ?? "form";
    const limit = opts?.limit ?? 20;
    const selectFields = opts?.select ?? computeSelectFields(info, mode);
    const text = opts?.text;

    if (!text) {
      const items = await this._client.query({
        controls: { $select: selectFields, $limit: limit },
      } as any);
      return { items: items as Record<string, unknown>[] };
    }

    // Check if target table supports full-text search
    if (this._searchable === undefined) {
      try {
        const meta = await this._client.meta();
        this._searchable = meta.searchable ?? false;
      } catch {
        this._searchable = false;
      }
    }

    if (this._searchable) {
      const items = await this._client.query({
        controls: { $select: selectFields, $limit: limit, $search: text },
      } as any);
      return { items: items as Record<string, unknown>[] };
    }

    // Non-searchable: build $or regex filter across fields + exact PK match
    const filter = buildOrFilter(text, selectFields, info.targetField);
    const items = await this._client.query({
      filter,
      controls: { $select: selectFields, $limit: limit },
    } as any);
    return { items: items as Record<string, unknown>[] };
  }

  /**
   * Resolve display labels for an array of PK values.
   * Returns a Map of PK value → display label string.
   */
  async resolveLabels(info: ValueHelpInfo, values: unknown[]): Promise<Map<unknown, string>> {
    const result = new Map<unknown, string>();
    if (values.length === 0) return result;

    const select = [info.targetField, info.labelField];
    const items = await this._client.query({
      filter: { [info.targetField]: { $in: values } },
      controls: { $select: select },
    } as any);

    for (const item of items as Record<string, unknown>[]) {
      const key = item[info.targetField];
      if (key != null) {
        result.set(key, str(item[info.labelField] ?? key));
      }
    }
    return result;
  }

  /**
   * Get target table metadata (cached via Client.meta()).
   */
  async getMeta(): Promise<{ searchable: boolean; tableDef: TableDef }> {
    const meta = await this._client.meta();
    this._searchable = meta.searchable ?? false;
    return {
      searchable: this._searchable,
      tableDef: createTableDef(meta),
    };
  }
}

/**
 * Compute the $select fields for a value-help query.
 */
function computeSelectFields(info: ValueHelpInfo, mode: "form" | "filter"): string[] {
  const fields = [info.targetField, ...info.primaryKeys, info.labelField];
  if (info.descrField) fields.push(info.descrField);
  if (mode === "filter") fields.push(...info.attrFields);
  return [...new Set(fields)];
}

/**
 * Build a Uniquery `$or` filter for value-help search across multiple fields.
 * Uses regex startsWith (case-insensitive) on text fields + exact match on PK.
 */
function buildOrFilter(
  text: string,
  fields: string[],
  targetField: string,
): Record<string, unknown> {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const conditions: Record<string, unknown>[] = [];

  for (const field of fields) {
    if (field !== targetField) {
      conditions.push({ [field]: { $regex: `/^${escaped}/i` } });
    }
  }

  // Exact match on target field (parse as number for numeric PKs)
  const asNum = Number(text);
  if (!Number.isNaN(asNum)) {
    conditions.push({ [targetField]: asNum });
  } else {
    conditions.push({ [targetField]: text });
  }

  return { $or: conditions };
}
