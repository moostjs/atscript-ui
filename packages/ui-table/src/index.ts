// ── Filter types ────────────────────────────────────────────
export type { FilterConditionType, FilterCondition, FieldFilters } from "./filters/filter-types";

// ── Filter condition helpers ────────────────────────────────
export {
  isFilled,
  hasSecondValue,
  isSimpleEq,
  conditionLabel,
  filledFilterCount,
  filterTokenLabel,
} from "./filters/filter-conditions";

// ── Filter conditions map ───────────────────────────────────
export type { ColumnFilterType } from "./filters/filter-conditions-map";
export { conditionsForType, columnFilterType } from "./filters/filter-conditions-map";

// ── Escape regex ────────────────────────────────────────────
export { escapeRegex } from "./filters/escape-regex";

// ── Filter input format ─────────────────────────────────────
export {
  parseFilterInput,
  formatFilterCondition,
  defaultCondition,
} from "./filters/filter-input-format";

// ── Filters to Uniquery ─────────────────────────────────────
export { filtersToUniqueryFilter } from "./filters/filters-to-uniquery";

// ── Date shortcuts ──────────────────────────────────────────
export type { DateShortcut } from "./filters/date-shortcuts";
export { dateShortcuts } from "./filters/date-shortcuts";

// ── Preset types ────────────────────────────────────────────
export type { PresetSnapshot, Preset } from "./presets/preset-types";

// ── Preset serializer ───────────────────────────────────────
export { serializePreset, deserializePreset } from "./presets/preset-serializer";

// ── Query builder ──────────────────────────────────────────
export type { BuildTableQueryOptions } from "./query/build-table-query";
export { buildTableQuery } from "./query/build-table-query";
export { mergeSorters } from "./query/merge-sorters";
export { mergeFilters } from "./query/merge-filters";

// ── Selection ──────────────────────────────────────────────
export type { SelectionMode, SelectionOptions } from "./selection/selection-state";
export { SelectionState } from "./selection/selection-state";

// ── State types ────────────────────────────────────────────
export type { ConfigTab, TableStateData, TableStateMethods } from "./state/table-state-types";

// ── Utils ──────────────────────────────────────────────────
export { debounce } from "./utils/debounce";
export { arraysEqual, sameColumnSet, sortersEqual } from "./utils/equality";
