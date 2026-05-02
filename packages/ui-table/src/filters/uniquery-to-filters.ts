import type { FilterExpr } from "@uniqu/core";
import type { FieldFilters, FilterCondition, FilterConditionType } from "./filter-types";
import { unescapeRegex } from "./escape-regex";

const SUPPORTED_TYPES = new Set<FilterConditionType>([
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "starts",
  "ends",
  "bw",
  "null",
  "notNull",
  "regex",
]);

type Primitive = string | number | boolean;

function isPrimitive(v: unknown): v is Primitive {
  return typeof v === "string" || typeof v === "number" || typeof v === "boolean";
}

// Wire format the encoder emits — `/<body>/<flags>`. `s` flag treats `.` as
// matching newlines (load-bearing: filter values may contain literal newlines).
const REGEX_LITERAL = /^\/(.*)\/([a-z]*)$/s;
const STARTS_ANCHOR = /^\^(.+)$/s;
const ENDS_ANCHOR = /^(.+)\$$/s;

/**
 * Decode a `$regex` value into a contains/starts/ends/regex `FilterCondition`.
 * The encoder emits case-insensitive `/…/i` wrappers for contains/starts/ends
 * shortcuts; round-trip those back. Anything else falls through as a literal
 * `regex` condition.
 */
function regexToCondition(raw: unknown): FilterCondition | null {
  if (typeof raw !== "string") return null;
  const m = REGEX_LITERAL.exec(raw);
  if (!m) return { type: "regex", value: [raw] };
  const body = m[1];
  const flags = m[2];
  if (flags === "i") {
    const startsM = STARTS_ANCHOR.exec(body);
    if (startsM) return { type: "starts", value: [unescapeRegex(startsM[1])] };
    const endsM = ENDS_ANCHOR.exec(body);
    if (endsM) return { type: "ends", value: [unescapeRegex(endsM[1])] };
    return { type: "contains", value: [unescapeRegex(body)] };
  }
  return { type: "regex", value: [raw] };
}

function pushIfPrimitive(out: FilterCondition[], type: FilterConditionType, v: unknown): void {
  if (!isPrimitive(v)) return;
  out.push({ type, value: [v] });
}

/**
 * Decode a per-field operator object (e.g. `{ $gt: 5, $lte: 10 }`) into one or
 * more `FilterCondition`s. Unknown operators are silently dropped.
 *
 * `$gte` + `$lte` on the same field collapse into a single `bw` condition,
 * matching the encoder's behaviour.
 */
function decodeFieldOps(ops: Record<string, unknown>): FilterCondition[] {
  const out: FilterCondition[] = [];

  const hasGte = "$gte" in ops && isPrimitive(ops.$gte);
  const hasLte = "$lte" in ops && isPrimitive(ops.$lte);
  if (hasGte && hasLte) {
    out.push({ type: "bw", value: [ops.$gte as Primitive, ops.$lte as Primitive] });
  } else {
    if (hasGte) pushIfPrimitive(out, "gte", ops.$gte);
    if (hasLte) pushIfPrimitive(out, "lte", ops.$lte);
  }

  if ("$eq" in ops) pushIfPrimitive(out, "eq", ops.$eq);
  if ("$ne" in ops) pushIfPrimitive(out, "ne", ops.$ne);
  if ("$gt" in ops) pushIfPrimitive(out, "gt", ops.$gt);
  if ("$lt" in ops) pushIfPrimitive(out, "lt", ops.$lt);

  if ("$exists" in ops) {
    if (ops.$exists === false) out.push({ type: "null", value: [] });
    else if (ops.$exists === true) out.push({ type: "notNull", value: [] });
  }

  if ("$regex" in ops) {
    const cond = regexToCondition(ops.$regex);
    if (cond) out.push(cond);
  }

  return out;
}

/**
 * Walk a leaf `ComparisonNode` (one or more field=value entries) into the
 * shared `FieldFilters` accumulator. Drops unknown fields and operators.
 */
function walkLeaf(
  node: Record<string, unknown>,
  acc: FieldFilters,
  knownFields: Set<string> | null,
): void {
  for (const field in node) {
    if (field.startsWith("$")) continue; // logical key — not a leaf
    if (knownFields && !knownFields.has(field)) continue;

    const value = node[field];
    let conditions: FilterCondition[];

    if (value === null || value === undefined) {
      conditions = [{ type: "null", value: [] }];
    } else if (isPrimitive(value)) {
      conditions = [{ type: "eq", value: [value] }];
    } else if (typeof value === "object" && !Array.isArray(value)) {
      conditions = decodeFieldOps(value as Record<string, unknown>);
    } else {
      continue;
    }

    if (conditions.length === 0) continue;
    const filtered = conditions.filter((c) => SUPPORTED_TYPES.has(c.type));
    if (filtered.length === 0) continue;

    if (acc[field]) acc[field] = [...acc[field], ...filtered];
    else acc[field] = filtered;
  }
}

// Logical structure is intentionally flattened — `FieldFilters` is a per-field
// accumulator (AND across fields, OR/AND within a field by condition type).
// Round-tripped URLs always land in this shape; cross-field $or in pasted URLs
// degrades to best-effort AND'd conjunctions (lossy-coerce by design). $not is
// dropped — no UI representation, and the encoder never emits it.
function walkExpr(expr: FilterExpr, acc: FieldFilters, knownFields: Set<string> | null): void {
  if ("$and" in expr && expr.$and) {
    for (const child of expr.$and as FilterExpr[]) walkExpr(child, acc, knownFields);
    return;
  }
  if ("$or" in expr && expr.$or) {
    for (const child of expr.$or as FilterExpr[]) walkExpr(child, acc, knownFields);
    return;
  }
  if ("$not" in expr && expr.$not) return;
  walkLeaf(expr as Record<string, unknown>, acc, knownFields);
}

/**
 * Convert a Uniquery `FilterExpr` back into the UI's `FieldFilters` shape.
 *
 * Inverse of `filtersToUniqueryFilter`. Drops:
 * - conditions on fields not in `knownFields` (when provided)
 * - operators not in the supported `FilterConditionType` union
 * - `$not` branches (no native UI representation; lossy on hand-crafted URLs)
 *
 * Returns `{}` for an empty/missing expression. Never throws.
 */
export function uniqueryFilterToFieldFilters(
  expr: FilterExpr | undefined,
  knownFields?: Iterable<string> | Set<string>,
): FieldFilters {
  const acc: FieldFilters = {};
  if (!expr) return acc;
  const known =
    knownFields == null ? null : knownFields instanceof Set ? knownFields : new Set(knownFields);
  try {
    walkExpr(expr, acc, known);
  } catch {
    // Silent on malformed input — schema drift tolerance per the URL contract.
  }
  return acc;
}
