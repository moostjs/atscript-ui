import type { FilterExpr } from "@uniqu/core";
import type { FilterCondition } from "./filter-types";
import { escapeRegex } from "./escape-regex";

/**
 * Convert a single condition to a Uniquery filter expression: a comparison
 * node with the field as key. The default conversion — a value encoder (see
 * `createColumnValueEncoder`) may type the value first.
 *
 * @internal
 */
export function conditionToExpr(field: string, condition: FilterCondition): FilterExpr {
  const v = condition.value;
  switch (condition.type) {
    case "eq":
      return { [field]: v[0] };
    case "ne":
      return { [field]: { $ne: v[0] } };
    case "gt":
      return { [field]: { $gt: v[0] } };
    case "gte":
      return { [field]: { $gte: v[0] } };
    case "lt":
      return { [field]: { $lt: v[0] } };
    case "lte":
      return { [field]: { $lte: v[0] } };
    case "contains":
      return { [field]: { $regex: `/${escapeRegex(String(v[0]))}/i` } };
    case "starts":
      return { [field]: { $regex: `/^${escapeRegex(String(v[0]))}/i` } };
    case "ends":
      return { [field]: { $regex: `/${escapeRegex(String(v[0]))}$/i` } };
    case "bw":
      return { [field]: { $gte: v[0], $lte: v[1] } };
    case "null":
      return { [field]: { $exists: false } };
    case "notNull":
      return { [field]: { $exists: true } };
    case "regex":
      return { [field]: { $regex: String(v[0]) } };
  }
}
