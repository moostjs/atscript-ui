import type { FilterCondition, FilterConditionType } from "./filter-types";
import type { ColumnFilterType } from "./filter-conditions-map";
import { conditionsForType } from "./filter-conditions-map";

/**
 * Coerce a raw string value to the appropriate JS type for the column.
 * Number columns get numeric values; everything else stays as string.
 */
function coerceValue(raw: string, columnType: ColumnFilterType): string | number {
  if (columnType === "number") {
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  return raw;
}

/** Default condition type when no symbol matches the input. */
export function defaultCondition(columnType: ColumnFilterType): FilterConditionType {
  switch (columnType) {
    case "text":
    case "enum":
    case "ref":
      return "contains";
    default:
      return "eq";
  }
}

/** Prefix operators in match order (longest first). */
const PREFIX_OPS: ReadonlyArray<readonly [string, FilterConditionType]> = [
  ["!=", "ne"],
  [">=", "gte"],
  ["<=", "lte"],
  [">", "gt"],
  ["<", "lt"],
  ["=", "eq"],
];

/**
 * Parse a user-typed filter input string into a FilterCondition.
 *
 * Supports operator symbols:
 *   *text*    → contains
 *   text*     → starts with
 *   *text     → ends with
 *   =value    → eq (explicit)
 *   !=value   → ne
 *   >=value   → gte
 *   >value    → gt
 *   <=value   → lte
 *   <value    → lt
 *   lo...hi   → bw (between)
 *   <empty>   → null
 *   !<empty>  → notNull
 *   /pattern/ → regex
 *
 * When no symbol matches, the default depends on columnType:
 *   text/enum/ref → contains
 *   number/date/boolean → eq
 *
 * Returns undefined for empty/invalid input or if the parsed operator
 * is not available for the column type.
 */
export function parseFilterInput(
  text: string,
  columnType: ColumnFilterType,
  nullable = true,
): FilterCondition | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;

  const available = conditionsForType(columnType, nullable);
  const isNumber = columnType === "number";
  const build = (
    type: FilterConditionType,
    value: (string | number | boolean)[],
  ): FilterCondition | undefined => {
    if (!available.includes(type)) return undefined;
    if (isNumber) {
      for (const v of value) {
        if (typeof v === "string" && v !== "") return undefined;
        if (typeof v === "number" && Number.isNaN(v)) return undefined;
      }
    }
    return { type, value };
  };
  const coerce = (raw: string) => coerceValue(raw, columnType);

  const lower = trimmed.toLowerCase();

  // 1. Null literals (case-insensitive, exact match)
  if (lower === "!<empty>") return build("notNull", []);
  if (lower === "<empty>") return build("null", []);

  // 2. Regex: /pattern/
  if (trimmed.length >= 3 && trimmed[0] === "/" && trimmed[trimmed.length - 1] === "/") {
    const pattern = trimmed.slice(1, -1);
    if (pattern === "") return undefined;
    return build("regex", [pattern]);
  }

  // 3. Between: lo...hi (split on first "...")
  const bwIdx = trimmed.indexOf("...");
  if (bwIdx > 0 && bwIdx + 3 < trimmed.length) {
    const lo = trimmed.slice(0, bwIdx).trim();
    const hi = trimmed.slice(bwIdx + 3).trim();
    if (lo !== "" && hi !== "") return build("bw", [coerce(lo), coerce(hi)]);
  }

  // 4. Prefix operators (longest first)
  for (const [sym, op] of PREFIX_OPS) {
    if (trimmed.startsWith(sym) && trimmed.length > sym.length) {
      const val = trimmed.slice(sym.length).trim();
      if (val !== "") return build(op, [coerce(val)]);
    }
  }

  // 5. Wildcards: *text*, text*, *text
  if (trimmed.length >= 3 && trimmed[0] === "*" && trimmed[trimmed.length - 1] === "*") {
    const inner = trimmed.slice(1, -1);
    if (inner !== "") return build("contains", [inner]);
  }
  if (trimmed.length >= 2 && trimmed[trimmed.length - 1] === "*" && trimmed[0] !== "*") {
    const inner = trimmed.slice(0, -1);
    if (inner !== "") return build("starts", [inner]);
  }
  if (trimmed.length >= 2 && trimmed[0] === "*" && trimmed[trimmed.length - 1] !== "*") {
    const inner = trimmed.slice(1);
    if (inner !== "") return build("ends", [inner]);
  }

  // 6. Default: no symbol matched
  return build(defaultCondition(columnType), [coerce(trimmed)]);
}

/**
 * Format a FilterCondition for chip/token display using operator symbols.
 *
 * Round-trips with parseFilterInput:
 *   formatFilterCondition(parseFilterInput(text, type)) ≈ text
 */
export function formatFilterCondition(condition: FilterCondition): string {
  const { type, value } = condition;
  const v0 = value[0] != null ? String(value[0]) : "";

  switch (type) {
    case "eq":
      return v0;
    case "ne":
      return `!=${v0}`;
    case "gt":
      return `>${v0}`;
    case "gte":
      return `>=${v0}`;
    case "lt":
      return `<${v0}`;
    case "lte":
      return `<=${v0}`;
    case "contains":
      return `*${v0}*`;
    case "starts":
      return `${v0}*`;
    case "ends":
      return `*${v0}`;
    case "bw": {
      const v1 = value[1] != null ? String(value[1]) : "";
      return `${v0}...${v1}`;
    }
    case "null":
      return "<empty>";
    case "notNull":
      return "!<empty>";
    case "regex":
      return `/${v0}/`;
    default:
      return v0;
  }
}
