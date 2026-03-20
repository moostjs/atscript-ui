/** Filter condition type identifiers. */
export type FilterConditionType =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "starts"
  | "ends"
  | "bw"
  | "in"
  | "nin"
  | "null"
  | "notNull"
  | "regex";

/**
 * A single filter condition applied to a field.
 *
 * - Most conditions use `value[0]`.
 * - `bw` (between) uses `value[0]` (low) and `value[1]` (high).
 * - `in`/`nin` use all values.
 * - `null`/`notNull` ignore value.
 */
export interface FilterCondition {
  type: FilterConditionType;
  value: (string | number | boolean)[];
}

/** Filter conditions grouped by field path. */
export type FieldFilters = Record<string, FilterCondition[]>;
