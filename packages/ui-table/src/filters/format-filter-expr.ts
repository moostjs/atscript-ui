import { getUiTexts, type UiT } from "@atscript/ui";
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
function leaf(
  label: string,
  op: string,
  value: unknown,
  render: (v: unknown) => string,
  t: UiT,
): string {
  // A bare RegExp value is a regex match, as the URL builder spells it.
  if (op === "$eq" && value instanceof RegExp) op = "$regex";
  if ((op === "$in" || op === "$nin") && Array.isArray(value)) {
    const values = value.map(render).join(", ");
    return t(op === "$in" ? "UI_FILTER_CHIP_IN" : "UI_FILTER_CHIP_NOT_IN", {
      field: label,
      values,
    });
  }
  const conds = decodeOperator(op, value);
  if (conds?.length === 1) {
    const [cond] = conds;
    const rendered = [{ ...cond, value: cond.value.map((v) => render(v)) }];
    return filterTokenLabel(label, rendered, label, t);
  }
  // No wording for it — fall back to the URL spelling, with the label.
  return buildUrl({ filter: { [label]: { [op]: value } } as FilterExpr }) || `${label}${op}`;
}

function join(children: Part[], kind: "and" | "or", t: UiT): Part {
  const parts = children.filter((c) => c.s);
  if (parts.length === 0) return { s: "", kind: "leaf" };
  if (parts.length === 1) return parts[0];
  const wrap = kind === "and" ? "or" : "and";
  const word = t(kind === "and" ? "UI_FILTER_AND" : "UI_FILTER_OR");
  return {
    s: parts.map((c) => (c.kind === wrap ? `(${c.s})` : c.s)).join(` ${word} `),
    kind,
  };
}

/**
 * Human-readable rendering of a Uniquery filter expression, worded like the
 * filter-field chips: `(Status equals shipped and Total greater than 500) or
 * (Status equals pending and Total less or equal 50)`. `and` binds tighter
 * than `or`; groups are parenthesized only where needed. Operators without a
 * wording fall back to their `@uniqu/url` spelling. A relational predicate
 * (`ticket: { $some: { status: "open" } }`) reads `Ticket has some (status
 * equals open)` — `has none` for `$none`, `(any)` for an empty operand (since
 * 0.1.147).
 *
 * @param labelOf — display label for a field path (e.g. the column label);
 *   the path itself when omitted or when it returns `undefined`.
 * @param formatValue — optional wording for a value on a field (e.g. an epoch
 *   number on a timestamp column as a date); `undefined` keeps the plain
 *   rendering. Since 0.1.148.
 * @param t — reads the wording's UI texts; the active UI locale's by default.
 * @since 0.1.140
 */
export function formatFilterExpr(
  expr: FilterExpr,
  labelOf?: (path: string) => string | undefined,
  formatValue?: (path: string, value: unknown) => string | undefined,
  t: UiT = getUiTexts().t,
): string {
  const visitor: FilterVisitor<Part> = {
    comparison: (field, op, value) => ({
      s: leaf(
        labelOf?.(field) ?? field,
        op,
        value,
        formatValue ? (v) => formatValue(field, v) ?? show(v) : show,
        t,
      ),
      kind: "leaf",
    }),
    and: (children) => join(children, "and", t),
    or: (children) => join(children, "or", t),
    not: (child) => ({
      s: child.s ? t("UI_FILTER_CHIP_NOT", { filter: child.s }) : "",
      kind: "leaf",
    }),
    // A relational predicate's operand filters the related rows — fields of
    // the relation's target, so worded without this table's labels.
    relation: (field, op, operand) => ({
      s: t(op === "$some" ? "UI_FILTER_CHIP_SOME" : "UI_FILTER_CHIP_NONE", {
        field: labelOf?.(field) ?? field,
        filter: formatFilterExpr(operand, undefined, undefined, t) || t("UI_FILTER_CHIP_ANY"),
      }),
      kind: "leaf",
    }),
  };
  try {
    return walkFilter(expr, visitor)?.s ?? "";
  } catch {
    return JSON.stringify(expr) ?? "";
  }
}
