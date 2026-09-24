import { walkFilter, type FilterExpr, type FilterVisitor } from "@uniqu/core";
import { buildUrl } from "@uniqu/url/builder";
import { filterTokenLabel } from "./filter-conditions";
import { decodeOperator } from "./uniquery-to-filters";

interface Part {
  s: string;
  kind: "leaf" | "and" | "or";
}

function show(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && v !== null) return JSON.stringify(v) ?? "";
  return String(v as string | number | boolean | bigint | null | undefined);
}

/** One comparison, worded like the filter chips (the decoder's operator table). */
function leaf(label: string, op: string, value: unknown): string {
  // A bare RegExp value is a regex match, as the URL builder spells it.
  if (op === "$eq" && value instanceof RegExp) op = "$regex";
  if ((op === "$in" || op === "$nin") && Array.isArray(value)) {
    return `${label} ${op === "$in" ? "is one of" : "is none of"} ${value.map(show).join(", ")}`;
  }
  const conds = decodeOperator(op, value);
  if (conds?.length === 1) return filterTokenLabel(label, conds, label);
  // No wording for it — fall back to the URL spelling, with the label.
  return buildUrl({ filter: { [label]: { [op]: value } } as FilterExpr }) || `${label}${op}`;
}

function join(children: Part[], kind: "and" | "or"): Part {
  const parts = children.filter((c) => c.s);
  if (parts.length === 0) return { s: "", kind: "leaf" };
  if (parts.length === 1) return parts[0];
  const wrap = kind === "and" ? "or" : "and";
  return {
    s: parts.map((c) => (c.kind === wrap ? `(${c.s})` : c.s)).join(` ${kind} `),
    kind,
  };
}

/**
 * Human-readable rendering of a Uniquery filter expression, worded like the
 * filter-field chips: `(Status equals shipped and Total greater than 500) or
 * (Status equals pending and Total less or equal 50)`. `and` binds tighter
 * than `or`; groups are parenthesized only where needed. Operators without a
 * wording fall back to their `@uniqu/url` spelling.
 *
 * @param labelOf — display label for a field path (e.g. the column label);
 *   the path itself when omitted or when it returns `undefined`.
 * @since 0.1.140
 */
export function formatFilterExpr(
  expr: FilterExpr,
  labelOf?: (path: string) => string | undefined,
): string {
  const visitor: FilterVisitor<Part> = {
    comparison: (field, op, value) => ({
      s: leaf(labelOf?.(field) ?? field, op, value),
      kind: "leaf",
    }),
    and: (children) => join(children, "and"),
    or: (children) => join(children, "or"),
    not: (child) => ({ s: child.s ? `not (${child.s})` : "", kind: "leaf" }),
  };
  try {
    return walkFilter(expr, visitor)?.s ?? "";
  } catch {
    return JSON.stringify(expr) ?? "";
  }
}
