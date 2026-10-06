import type { FilterExpr } from "@uniqu/core";
import type { FilterCondition, FilterConditionType } from "./filter-types";
import type { ConditionEncoder } from "./value-encoder";

const COMPARISON: Record<string, FilterConditionType> = {
  $eq: "eq",
  $ne: "ne",
  $gt: "gt",
  $gte: "gte",
  $lt: "lt",
  $lte: "lte",
};

const isScalar = (v: unknown): v is string | number | boolean =>
  typeof v === "string" || typeof v === "number" || typeof v === "boolean";

/** The scalar `x` of `{ [field]: x }` (an encoded `eq`), or `undefined`. */
const plainValue = (expr: FilterExpr, field: string): unknown => {
  const keys = Object.keys(expr);
  const v = (expr as Record<string, unknown>)[field];
  return keys.length === 1 && keys[0] === field && isScalar(v) ? v : undefined;
};

/** The scalar `x` of `{ [field]: { $ne: x } }` (an encoded `ne`), or `undefined`. */
const notEqualValue = (expr: FilterExpr, field: string): unknown => {
  const keys = Object.keys(expr);
  const v = (expr as Record<string, unknown>)[field];
  if (keys.length !== 1 || keys[0] !== field || !v || typeof v !== "object") return undefined;
  const ops = Object.keys(v);
  return ops.length === 1 && ops[0] === "$ne" ? (v as { $ne?: unknown }).$ne : undefined;
};

/**
 * `$in` / `$nin` of a list: every element is typed as a single `$eq` / `$ne` would be. A list
 * whose elements stay scalars stays a list (`$in: [1, 2]`); an element that expands (a date
 * string becomes a day range) turns the list into `$or` of `$eq`s (`$and` of `$ne`s for `$nin`).
 * `undefined` when no element changes.
 */
function encodeList(
  field: string,
  op: "$in" | "$nin",
  list: unknown[],
  encode: ConditionEncoder,
  now: number,
): FilterExpr | undefined {
  const type: FilterConditionType = op === "$in" ? "eq" : "ne";
  const encoded = list.map((v) =>
    isScalar(v) ? encode(field, { type, value: [v] } satisfies FilterCondition, now) : undefined,
  );
  if (encoded.every((e) => e === undefined)) return undefined;
  const scalarOf = op === "$in" ? plainValue : notEqualValue;
  const scalars = encoded.map((e, i) => (e === undefined ? list[i] : scalarOf(e, field)));
  if (scalars.every((v) => v !== undefined)) return { [field]: { [op]: scalars } } as FilterExpr;
  const parts = encoded.map(
    (e, i) => e ?? ({ [field]: op === "$in" ? list[i] : { $ne: list[i] } } as FilterExpr),
  );
  return { [op === "$in" ? "$or" : "$and"]: parts } as FilterExpr;
}

/** One field's operators → expressions: comparisons go through `encode`, the rest are kept as they are. */
function encodeField(
  field: string,
  node: unknown,
  encode: ConditionEncoder,
  now: number,
): FilterExpr {
  if (isScalar(node)) {
    return encode(field, { type: "eq", value: [node] }, now) ?? ({ [field]: node } as FilterExpr);
  }
  if (!node || typeof node !== "object" || Array.isArray(node))
    return { [field]: node } as FilterExpr;

  const parts: FilterExpr[] = [];
  const rest: Record<string, unknown> = {};
  let changed = false;
  for (const [op, value] of Object.entries(node)) {
    const type = COMPARISON[op];
    let encoded: FilterExpr | undefined;
    if (type && isScalar(value)) {
      encoded = encode(field, { type, value: [value] } satisfies FilterCondition, now);
    } else if ((op === "$in" || op === "$nin") && Array.isArray(value)) {
      encoded = encodeList(field, op, value, encode, now);
    }
    if (encoded) {
      parts.push(encoded);
      changed = true;
    } else {
      rest[op] = value;
    }
  }
  if (!changed) return { [field]: node } as FilterExpr;
  if (Object.keys(rest).length > 0) parts.push({ [field]: rest } as FilterExpr);
  return parts.length === 1 ? parts[0] : ({ $and: parts } as FilterExpr);
}

function walk(expr: unknown, encode: ConditionEncoder, now: number): FilterExpr {
  if (!expr || typeof expr !== "object" || Array.isArray(expr)) return expr as FilterExpr;
  const entries = Object.entries(expr);
  const out = entries.map(([key, value]): FilterExpr => {
    if (key === "$and" || key === "$or") {
      return {
        [key]: Array.isArray(value) ? value.map((v) => walk(v, encode, now)) : value,
      } as FilterExpr;
    }
    if (key === "$not") return { $not: walk(value, encode, now) } as FilterExpr;
    if (key.startsWith("$")) return { [key]: value } as FilterExpr;
    return encodeField(key, value, encode, now);
  });
  return out.length === 1 ? out[0] : ({ $and: out } as FilterExpr);
}

/**
 * Run a ready-made Uniquery expression (a URL residual, a preset) through the
 * same column-aware encoder as table-built conditions: each comparison
 * (`$eq` / `$ne` / `$gt` / `$gte` / `$lt` / `$lte`, or a bare value; each element of a
 * `$in` / `$nin` list) on an
 * encoded column is typed the way the server accepts. Everything else — and
 * every expression the encoder has no opinion on — is returned unchanged.
 *
 * @since 0.1.148
 */
export function encodeFilterExpr(
  expr: FilterExpr,
  encode: ConditionEncoder,
  now: number,
): FilterExpr {
  return walk(expr, encode, now);
}
