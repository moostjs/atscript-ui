import { isLogicalKey, type FilterExpr } from "@uniqu/core";
import type { FieldFilters, FilterCondition, FilterConditionType } from "./filter-types";
import { unescapeRegex } from "./escape-regex";
import { isExclusionType } from "./filters-to-uniquery";
import { DEV } from "../utils/dev";
import { buildUrl } from "@uniqu/url/builder";

/**
 * Why part of a Uniquery filter has no `FieldFilters` equivalent.
 *
 * - `"cross-field"` — an `$or` / `$not` that spans several fields
 *   (`a=1 OR b=2`). The model ANDs fields, so it cannot hold a correlation.
 * - `"operator"` — an operator or operand no condition type expresses
 *   (`$nor`, an unknown `$op`, an object value, an empty `$in`, …).
 * - `"negation"` — a negative inside an `$or`, or a `$not` that is not a
 *   plain inversion of equality / emptiness.
 * - `"conjunction"` — a second positive group AND'd onto a field that already
 *   has one (`a>1 AND a<5`). A field's positive conditions are OR'd.
 *
 * @since 0.1.139
 */
export type UnsupportedFilterReason = "cross-field" | "operator" | "negation" | "conjunction";

/**
 * One AND-ed piece of a Uniquery filter that {@link uniqueryFilterToFieldFilters}
 * left out of its result.
 *
 * @since 0.1.139
 */
export interface UnsupportedFilter {
  reason: UnsupportedFilterReason;
  /** The left-out sub-expression, as it appeared in the input. */
  expr: FilterExpr;
  /** Field paths the sub-expression references, in order of appearance. */
  fields: string[];
}

type Primitive = string | number | boolean;

/**
 * One AND-ed piece of the input, on a single field: either a positive group
 * (its conditions OR'd — one condition, an `$in` list, a same-field `$or`) or
 * exactly one negative condition. Negatives are AND'd per field, so any number
 * of them fits the model; positives fit once per field. Which one a term is
 * follows from its conditions — the encoder's exclusion types.
 */
interface Term {
  field: string;
  conds: FilterCondition[];
  expr: FilterExpr;
}

interface Collected {
  terms: Term[];
  issues: UnsupportedFilter[];
}

// Local guards rather than `@uniqu/core`'s `isPrimitive` / `walkFilter`: those
// accept any non-plain object as a value, and malformed operands must be reported.
function isPrimitive(v: unknown): v is Primitive {
  return typeof v === "string" || typeof v === "number" || typeof v === "boolean";
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    !(v instanceof RegExp) &&
    !(v instanceof Date)
  );
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
  if (raw instanceof RegExp) raw = raw.toString();
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

const nullCond = (): FilterCondition => ({ type: "null", value: [] });
const notNullCond = (): FilterCondition => ({ type: "notNull", value: [] });

/** Positive condition for one `$eq` / `$in` value — `null` means "is empty". */
function memberCondition(v: unknown): FilterCondition | null {
  if (v === null) return nullCond();
  return isPrimitive(v) ? { type: "eq", value: [v] } : null;
}

/** Negative condition for one `$ne` / `$nin` value — `null` means "is not empty". */
function nonMemberCondition(v: unknown): FilterCondition | null {
  if (v === null) return notNullCond();
  return isPrimitive(v) ? { type: "ne", value: [v] } : null;
}

const RANGE_OPS: Record<string, FilterConditionType> = {
  $gt: "gt",
  $gte: "gte",
  $lt: "lt",
  $lte: "lte",
};

/**
 * Field paths a Uniquery filter expression references, deduped, in order of
 * appearance (logical operators are walked, operator keys skipped).
 *
 * @internal Exported for `@atscript/vue-table`.
 */
export function filterExprFields(expr: unknown): string[] {
  return fieldsOf(expr, []);
}

function fieldsOf(expr: unknown, out: string[]): string[] {
  if (Array.isArray(expr)) {
    for (const child of expr) fieldsOf(child, out);
    return out;
  }
  if (!isPlainObject(expr)) return out;
  for (const key in expr) {
    if (key.startsWith("$")) fieldsOf(expr[key], out);
    else if (!out.includes(key)) out.push(key);
  }
  return out;
}

function unsupported(reason: UnsupportedFilterReason, expr: unknown): UnsupportedFilter {
  const fields = fieldsOf(expr, []);
  // Spanning fields is the root cause whatever else is wrong with the piece.
  return { reason: fields.length > 1 ? "cross-field" : reason, expr: expr as FilterExpr, fields };
}

const isNegative = (term: Term): boolean => isExclusionType(term.conds[0].type);

/**
 * Add decoded conditions as terms: negatives one term each (they AND), a
 * positive list as one group (it ORs). Conditions share their polarity.
 */
function addTerms(out: Collected, field: string, conds: FilterCondition[], expr: FilterExpr): void {
  if (conds.length === 0) return;
  if (isExclusionType(conds[0].type)) {
    for (const cond of conds) out.terms.push({ field, conds: [cond], expr });
  } else {
    out.terms.push({ field, conds, expr });
  }
}

/**
 * `a>=x` AND `a<=y` is the model's `bw`, whether both halves sit in one
 * operator object (the encoder's shape) or in two AND-ed pieces. Folds `cond`
 * into an earlier lone opposite half on `field`; `false` when there is none.
 */
function pairRange(out: Collected, field: string, cond: FilterCondition): boolean {
  const opposite = cond.type === "gte" ? "lte" : cond.type === "lte" ? "gte" : null;
  if (!opposite) return false;
  const i = out.terms.findIndex(
    (t) => t.field === field && t.conds.length === 1 && t.conds[0].type === opposite,
  );
  if (i < 0) return false;
  const other = out.terms[i].conds[0];
  const [lo, hi] =
    cond.type === "gte" ? [cond.value[0], other.value[0]] : [other.value[0], cond.value[0]];
  out.terms[i] = {
    field,
    conds: [{ type: "bw", value: [lo, hi] }],
    expr: { [field]: { $gte: lo, $lte: hi } } as FilterExpr,
  };
  return true;
}

/**
 * Decode one field entry (`field: value`) into terms. An operator object is an
 * implicit AND of its operators — each becomes its own term.
 */
function collectField(field: string, value: unknown, out: Collected): void {
  const whole = { [field]: value } as FilterExpr;
  if (value === null || value === undefined) return addTerms(out, field, [nullCond()], whole);
  if (isPrimitive(value)) return addTerms(out, field, [{ type: "eq", value: [value] }], whole);
  if (value instanceof RegExp) return addTerms(out, field, [regexToCondition(value)!], whole);
  if (!isPlainObject(value)) {
    out.issues.push(unsupported("operator", whole));
    return;
  }
  for (const op in value) {
    const v = value[op];
    if (v === undefined) continue;
    const expr = { [field]: { [op]: v } } as FilterExpr;
    const conds = decodeOperator(op, v);
    if (!conds) out.issues.push(unsupported("operator", expr));
    else if (conds.length !== 1 || !pairRange(out, field, conds[0])) {
      addTerms(out, field, conds, expr);
    }
  }
}

const one = (cond: FilterCondition | null): FilterCondition[] | null => (cond ? [cond] : null);

/**
 * One operator of a field's operator object, as conditions of one polarity
 * (see {@link addTerms}). `null` means no condition type expresses the
 * operator / operand.
 */
export function decodeOperator(op: string, v: unknown): FilterCondition[] | null {
  if (op in RANGE_OPS) return one(isPrimitive(v) ? { type: RANGE_OPS[op], value: [v] } : null);
  switch (op) {
    case "$eq":
      return one(memberCondition(v));
    case "$ne":
      return one(nonMemberCondition(v));
    case "$regex":
      return one(regexToCondition(v));
    case "$exists":
      if (v === false) return one(nullCond());
      return v === true ? one(notNullCond()) : null;
    case "$in": {
      // Membership is a same-field OR of equalities — exactly one positive
      // group. An empty list matches nothing, which no condition can say.
      const conds = Array.isArray(v) ? v.map(memberCondition) : [];
      return conds.length > 0 && conds.every(Boolean) ? (conds as FilterCondition[]) : null;
    }
    case "$nin": {
      // An AND of inequalities — one negative each. An empty list matches
      // everything, so contributing nothing is exact.
      if (!Array.isArray(v)) return null;
      const conds = v.map(nonMemberCondition);
      return conds.every(Boolean) ? (conds as FilterCondition[]) : null;
    }
    default:
      return null;
  }
}

/**
 * Decode an `$or` branch / `$not` operand on its own. Usable only when it
 * converts fully and stays on one field; `null` when it constrains nothing.
 * A branch that spans fields comes back with a placeholder reason —
 * {@link unsupported} names it `"cross-field"` from the fields it sees.
 */
function classifyBranch(
  expr: unknown,
): { field: string; terms: Term[] } | { reason: UnsupportedFilterReason } | null {
  const sub: Collected = { terms: [], issues: [] };
  collect(expr, sub);
  if (sub.issues.length > 0) return { reason: sub.issues[0].reason };
  if (sub.terms.length === 0) return null;
  const field = sub.terms[0].field;
  if (sub.terms.some((t) => t.field !== field)) return { reason: "operator" };
  return { field, terms: sub.terms };
}

/**
 * `$or` fits the model only as a same-field OR of positive branches. Each
 * branch must decode to exactly one positive group; the groups merge.
 */
function collectOr(branches: unknown, out: Collected): void {
  const expr = { $or: branches } as FilterExpr;
  if (!Array.isArray(branches) || branches.length === 0) {
    out.issues.push(unsupported("operator", expr));
    return;
  }
  if (branches.length === 1) return collect(branches[0], out);

  const groups: Term[] = [];
  let reason: UnsupportedFilterReason | undefined;
  for (const branch of branches) {
    const b = classifyBranch(branch);
    // An empty branch is `true`, and so is the whole OR: it constrains nothing.
    if (b === null) return;
    if ("reason" in b) reason ??= b.reason;
    else if (b.terms.length > 1) reason ??= "conjunction";
    else if (isNegative(b.terms[0])) reason ??= "negation";
    else groups.push(b.terms[0]);
  }
  const field = groups[0]?.field;
  if (reason !== undefined || groups.some((t) => t.field !== field)) {
    out.issues.push(unsupported(reason ?? "operator", expr));
    return;
  }
  out.terms.push({ field: field!, conds: groups.flatMap((t) => t.conds), expr });
}

const INVERSE: Partial<Record<FilterConditionType, FilterConditionType>> = {
  eq: "ne",
  ne: "eq",
  null: "notNull",
  notNull: "null",
};

function invert(cond: FilterCondition): FilterCondition | null {
  const type = INVERSE[cond.type];
  return type ? { type, value: [...cond.value] } : null;
}

/**
 * `$not` fits when it inverts equality / emptiness on one field — De Morgan
 * turns NOT(a=1 OR a=2) into a≠1 AND a≠2 (negatives), and NOT(a≠1 AND a≠2)
 * back into a=1 OR a=2 (one positive group). A positive group AND'd with
 * anything else would invert into an OR of ANDs, which the model cannot hold.
 */
function collectNot(child: unknown, out: Collected): void {
  // `!!p ≡ p` — the shape `mergeFilters` wraps a colliding clause in.
  if (isPlainObject(child) && Object.keys(child).length === 1 && "$not" in child) {
    return collect(child.$not, out);
  }
  const expr = { $not: child } as FilterExpr;
  const b = classifyBranch(child);
  if (b && !("reason" in b) && (b.terms.length === 1 || b.terms.every(isNegative))) {
    const inverted = b.terms.flatMap((t) => t.conds).map(invert);
    if (inverted.every(Boolean)) {
      return addTerms(out, b.field, inverted as FilterCondition[], expr);
    }
  }
  out.issues.push(unsupported("negation", expr));
}

function collectAnd(children: unknown, out: Collected): void {
  if (Array.isArray(children)) for (const child of children) collect(child, out);
  else out.issues.push(unsupported("operator", { $and: children }));
}

const LOGICAL = { $and: collectAnd, $or: collectOr, $not: collectNot } as const;

/**
 * Split an expression into AND-ed terms. Every member of a node is an implicit
 * AND, in key order — comparison fields may sit next to `$and` / `$or` /
 * `$not` (Mongo semantics), and none of them is skipped.
 */
function collect(expr: unknown, out: Collected): void {
  if (!isPlainObject(expr)) {
    out.issues.push(unsupported("operator", expr));
    return;
  }
  for (const key in expr) {
    const value = expr[key];
    if (!key.startsWith("$")) collectField(key, value, out);
    else if (value === undefined) continue;
    else if (isLogicalKey(key)) LOGICAL[key](value, out);
    else out.issues.push(unsupported("operator", { [key]: value }));
  }
}

function sameConds(a: FilterCondition[], b: FilterCondition[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (c, i) =>
        c.type === b[i].type &&
        c.value.length === b[i].value.length &&
        c.value.every((v, j) => v === b[i].value[j]),
    )
  );
}

function warnUnsupported(issue: UnsupportedFilter): void {
  if (!DEV) return;
  console.warn(
    `[ui-table] Filter left out (${issue.reason}): ${JSON.stringify(issue.expr)}. ` +
      "Field filters cannot express it, so the result is broader than the source filter.",
  );
}

/** Options for {@link decomposeUniqueryFilter}. @since 0.1.140 */
export interface DecomposeUniqueryFilterOptions {
  /**
   * Field paths the table knows. Pieces on fields outside it are ignored
   * silently; a piece mixing known and unknown fields is reported, never
   * carried. Omit to accept every field.
   */
  knownFields?: Iterable<string>;
  /**
   * Keep left-out pieces whose fields are all known as `residual` instead of
   * reporting them. Default `false` — the 0.1.139 split. See
   * [Custom filter conditions](https://ui.atscript.dev/tables/filtering#custom-filter-conditions).
   */
  carry?: boolean;
}

/** Result of {@link decomposeUniqueryFilter}. @since 0.1.140 */
export interface DecomposedUniqueryFilter {
  /** The part field filters express exactly. */
  filters: FieldFilters;
  /** Carried pieces — AND-ed conditions, deduped, canonical order. `[]` unless `carry` is on. */
  residual: FilterExpr[];
  /** Pieces left out and lost — the result is broader by exactly these. */
  unsupported: UnsupportedFilter[];
}

/**
 * Split a Uniquery `FilterExpr` into what the table's field-filter model
 * holds exactly (`filters`), what it cannot hold but carries as residual
 * conditions (`residual`, with `carry`), and what it leaves out
 * (`unsupported`). Nothing is approximated: `filters AND residual` selects
 * `expr` minus the `unsupported` pieces and pieces on fields outside
 * `knownFields`.
 *
 * Never throws, never warns — the caller decides how to report.
 *
 * @since 0.1.140
 */
export function decomposeUniqueryFilter(
  expr: FilterExpr | undefined,
  opts: DecomposeUniqueryFilterOptions = {},
): DecomposedUniqueryFilter {
  const filters: FieldFilters = {};
  const result: DecomposedUniqueryFilter = { filters, residual: [], unsupported: [] };
  if (!expr) return result;
  const knownFields = opts.knownFields;
  const known =
    knownFields == null ? null : knownFields instanceof Set ? knownFields : new Set(knownFields);
  const isKnown = (field: string) => known === null || known.has(field);

  const out: Collected = { terms: [], issues: [] };
  try {
    collect(expr, out);
  } catch {
    // The walker type-checks what it reads; only exotic input (a throwing
    // getter, a cyclic object) lands here.
    out.terms = [];
    out.issues = [{ reason: "operator", expr, fields: [] }];
  }

  // Terms land in order; a field's first positive group is kept (the model
  // ORs a field's positives, so a second one AND'd onto it cannot join it).
  const positives = new Map<string, Term[]>();
  for (const term of out.terms) {
    if (!isKnown(term.field)) continue;
    const list = (filters[term.field] ??= []);
    if (isNegative(term)) {
      list.push(...term.conds);
      continue;
    }
    const groups = positives.get(term.field);
    if (!groups) {
      positives.set(term.field, [term]);
      list.push(...term.conds);
    } else if (!groups.some((g) => sameConds(g.conds, term.conds))) {
      // `a=1 AND a=1` is one group, not a conjunction.
      groups.push(term);
    }
  }

  const carried: FilterExpr[] = [];
  for (const [field, groups] of positives) {
    if (groups.length < 2) continue;
    // Carrying: none of the groups stays a field filter. Which one would be
    // "first" is not stable — `mergeFilters` wraps a repeated same-field
    // clause in `$not: { $not }` (servers on older @uniqu/url parsers would
    // collapse it otherwise), and the parser orders that logical node ahead
    // of plain comparisons, so a round trip would swap pill and residual.
    const leftOut = opts.carry ? groups : groups.slice(1);
    if (opts.carry) {
      const kept = new Set(groups[0].conds);
      const rest = filters[field].filter((c) => !kept.has(c));
      if (rest.length > 0) filters[field] = rest;
      else delete filters[field];
    }
    for (const term of leftOut) {
      out.issues.push({ reason: "conjunction", expr: term.expr, fields: [field] });
    }
  }

  for (const issue of out.issues) {
    const fields = issue.fields;
    if (fields.length > 0 && !fields.some(isKnown)) continue;
    if (opts.carry && fields.length > 0 && fields.every(isKnown)) carried.push(issue.expr);
    else result.unsupported.push(issue);
  }
  result.residual = normalizeResidualFilters(carried);
  return result;
}

/**
 * Canonical identity of a filter expression — its `@uniqu/url` spelling.
 * Two expressions with the same key select the same rows.
 *
 * @since 0.1.140
 */
export function filterExprKey(expr: FilterExpr): string {
  try {
    return buildUrl({ filter: expr });
  } catch {
    return JSON.stringify(expr) ?? "";
  }
}

/**
 * A residual-condition list with empty expressions and duplicates (by
 * {@link filterExprKey}) dropped, sorted by key. Sorted, not first-appearance:
 * the URL parser moves \`$not\`-wrapped clauses (how \`mergeFilters\` spells
 * a repeated same-field clause) ahead of plain ones, so appearance order would
 * flip on every round trip.
 *
 * @internal Exported for `@atscript/vue-table`.
 */
export function normalizeResidualFilters(exprs: readonly FilterExpr[]): FilterExpr[] {
  const byKey = new Map<string, FilterExpr>();
  for (const expr of exprs) {
    if (!isPlainObject(expr)) continue;
    const key = filterExprKey(expr);
    if (key && !byKey.has(key)) byKey.set(key, expr);
  }
  return [...byKey.keys()].toSorted().map((key) => byKey.get(key)!);
}

/**
 * Convert a Uniquery `FilterExpr` back into the UI's `FieldFilters` shape.
 *
 * Inverse of `filtersToUniqueryFilter`, and exact for everything that encoder
 * produces. For any other input, each AND-ed piece is either converted exactly
 * or left out whole and reported — never approximated:
 *
 * - `$in` becomes equality conditions on the field, `$nin` inequality ones.
 * - A same-field `$or` becomes that field's OR'd conditions.
 * - A `$not` that inverts equality / emptiness becomes the inverse conditions.
 * - Fields next to `$and` / `$or` / `$not` in one object are all kept.
 * - Anything else (see {@link UnsupportedFilterReason}) is left out. Leaving
 *   an AND-ed piece out only ever widens the match, so the result selects a
 *   superset of `expr`. Each left-out piece goes to `onUnsupportedFilter`, or
 *   to a dev-mode `console.warn` when no handler is given. To keep those
 *   pieces instead, use {@link decomposeUniqueryFilter} with `carry`.
 *
 * Conditions on fields outside `knownFields` (when provided) are ignored
 * silently: they are not this table's (a host page flag, a stale column). A
 * piece that mixes known and unknown fields is reported.
 *
 * Returns `{}` for an empty/missing expression. Never throws.
 */
export function uniqueryFilterToFieldFilters(
  expr: FilterExpr | undefined,
  knownFields?: Iterable<string> | Set<string>,
  onUnsupportedFilter: (issue: UnsupportedFilter) => void = warnUnsupported,
): FieldFilters {
  const { filters, unsupported } = decomposeUniqueryFilter(expr, { knownFields });
  for (const issue of unsupported) onUnsupportedFilter(issue);
  return filters;
}
