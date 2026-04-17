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

/**
 * Build a condition and validate it against available conditions for the column type.
 * Returns undefined if the condition type is not available or the value is invalid.
 */
function buildCondition(
  type: FilterConditionType,
  value: (string | number | boolean)[],
  columnType: ColumnFilterType,
): FilterCondition | undefined {
  const available = conditionsForType(columnType);
  if (!available.includes(type)) return undefined;

  // Validate numeric values
  if (columnType === "number") {
    for (const v of value) {
      if (typeof v === "string" && v !== "") return undefined;
      if (typeof v === "number" && Number.isNaN(v)) return undefined;
    }
  }

  return { type, value };
}

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
): FilterCondition | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;

  const lower = trimmed.toLowerCase();

  // 1. Null literals (case-insensitive, exact match)
  if (lower === "!<empty>") return buildCondition("notNull", [], columnType);
  if (lower === "<empty>") return buildCondition("null", [], columnType);

  // 2. Regex: /pattern/
  if (trimmed.length >= 3 && trimmed[0] === "/" && trimmed[trimmed.length - 1] === "/") {
    const pattern = trimmed.slice(1, -1);
    if (pattern === "") return undefined;
    return buildCondition("regex", [pattern], columnType);
  }

  // 3. Between: lo...hi (split on first "...")
  const bwIdx = trimmed.indexOf("...");
  if (bwIdx > 0 && bwIdx + 3 < trimmed.length) {
    const lo = trimmed.slice(0, bwIdx).trim();
    const hi = trimmed.slice(bwIdx + 3).trim();
    if (lo !== "" && hi !== "") {
      return buildCondition(
        "bw",
        [coerceValue(lo, columnType), coerceValue(hi, columnType)],
        columnType,
      );
    }
  }

  // 4. Prefix operators (longest first)
  if (trimmed.startsWith("!=") && trimmed.length > 2) {
    const val = trimmed.slice(2).trim();
    if (val !== "") return buildCondition("ne", [coerceValue(val, columnType)], columnType);
  }
  if (trimmed.startsWith(">=") && trimmed.length > 2) {
    const val = trimmed.slice(2).trim();
    if (val !== "") return buildCondition("gte", [coerceValue(val, columnType)], columnType);
  }
  if (trimmed.startsWith("<=") && trimmed.length > 2) {
    const val = trimmed.slice(2).trim();
    if (val !== "") return buildCondition("lte", [coerceValue(val, columnType)], columnType);
  }
  if (trimmed.startsWith(">") && trimmed.length > 1) {
    const val = trimmed.slice(1).trim();
    if (val !== "") return buildCondition("gt", [coerceValue(val, columnType)], columnType);
  }
  if (trimmed.startsWith("<") && trimmed.length > 1) {
    const val = trimmed.slice(1).trim();
    if (val !== "") return buildCondition("lt", [coerceValue(val, columnType)], columnType);
  }
  if (trimmed.startsWith("=") && trimmed.length > 1) {
    const val = trimmed.slice(1).trim();
    if (val !== "") return buildCondition("eq", [coerceValue(val, columnType)], columnType);
  }

  // 5. Wildcards: *text*, text*, *text
  if (trimmed.length >= 3 && trimmed[0] === "*" && trimmed[trimmed.length - 1] === "*") {
    const inner = trimmed.slice(1, -1);
    if (inner !== "") return buildCondition("contains", [inner], columnType);
  }
  if (trimmed.length >= 2 && trimmed[trimmed.length - 1] === "*" && trimmed[0] !== "*") {
    const inner = trimmed.slice(0, -1);
    if (inner !== "") return buildCondition("starts", [inner], columnType);
  }
  if (trimmed.length >= 2 && trimmed[0] === "*" && trimmed[trimmed.length - 1] !== "*") {
    const inner = trimmed.slice(1);
    if (inner !== "") return buildCondition("ends", [inner], columnType);
  }

  // 6. Default: no symbol matched
  const defType = defaultCondition(columnType);
  return buildCondition(defType, [coerceValue(trimmed, columnType)], columnType);
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
