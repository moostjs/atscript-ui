import type { FilterExpr } from "@atscript/db-client";
import type { ValueHelpInfo } from "./types";

/** The scope a picker of a form queries with: the binding's filter with its host values. */
export interface ValueHelpScope {
  /** `info.filter` AND'd with a `target = value` condition per host value; `undefined`: none. */
  filter?: FilterExpr;
  /** `info.pinned` plus the targets a host value pins — constant in the picker. */
  pinned: string[];
}

/** One value a pick writes into a sibling field (`@ui.valueHelp.fill`). */
export interface ValueHelpFillWrite {
  local: string;
  value: unknown;
}

/**
 * A host value the picker can filter by: one scalar. Empty (`undefined`,
 * `null`, `""`) or anything else (an array, an object) leaves the condition out.
 */
function isHostValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  return typeof value !== "object";
}

/**
 * The scope of a form picker (since 0.1.190): the binding's literal `filter`
 * with a `target = value` condition per host reference whose sibling field
 * holds one value — read through `read(local)`, the form's sibling value —
 * and the fields those values pin. A host field that is empty leaves its
 * condition out (a wider picker); the value is sent as the form holds it.
 * Without host references this is `{ filter: info.filter, pinned: info.pinned }`.
 */
export function valueHelpScope(
  info: ValueHelpInfo,
  read: (local: string) => unknown,
): ValueHelpScope {
  const pinned = [...(info.pinned ?? [])];
  const conditions: FilterExpr[] = [];
  for (const { target, local } of info.hostFilter ?? []) {
    const value = read(local);
    if (!isHostValue(value)) continue;
    conditions.push({ [target]: value } as FilterExpr);
    if (!pinned.includes(target)) pinned.push(target);
  }
  if (conditions.length === 0) return { ...(info.filter && { filter: info.filter }), pinned };
  const base = info.filter as { $and?: FilterExpr[] } | undefined;
  const all = base
    ? [...(Array.isArray(base.$and) ? base.$and : [info.filter!]), ...conditions]
    : conditions;
  return { filter: all.length === 1 ? all[0] : ({ $and: all } as FilterExpr), pinned };
}

/**
 * What a pick of `row` writes into sibling fields (`@ui.valueHelp.fill`,
 * since 0.1.190): `row[target]` per fill, in declaration order.
 */
export function valueHelpFills(
  info: ValueHelpInfo,
  row: Record<string, unknown>,
): ValueHelpFillWrite[] {
  return (info.fill ?? []).map(({ local, target }) => ({ local, value: row[target] }));
}
