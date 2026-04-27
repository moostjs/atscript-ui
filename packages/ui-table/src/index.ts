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

// ── Window-mode helpers ────────────────────────────────────
export { DEFAULT_ROW_HEIGHT_PX } from "./state/tokens";
export type { PageAlignedBlock } from "./state/window/page-aligned-blocks";
export {
  blockStartFor,
  clampTopIndex,
  pageAlignedBlocksFor,
} from "./state/window/page-aligned-blocks";
export type { MergeResult } from "./state/window/results-merge";
export { walkForwardAbsorb, walkBackwardAbsorb } from "./state/window/results-merge";
export type { FetchPlan, FetchPlanMode, PlanFetchArgs } from "./state/window/plan-fetch";
export { planFetch } from "./state/window/plan-fetch";

// ── Column widths ──────────────────────────────────────────
export type { ColumnWidthEntry, ColumnWidthsMap } from "./columns/column-widths";
export {
  MAX_DEFAULT_COLUMN_WIDTH_PX,
  computeDefaultColumnWidth,
  reconcileColumnWidthDefaults,
} from "./columns/column-widths";

// ── Utils ──────────────────────────────────────────────────
export { debounce } from "./utils/debounce";
export { arraysEqual, sameColumnSet, sortersEqual } from "./utils/equality";
export type { ColumnReorderPosition } from "./utils/reorder-column-names";
export { reorderColumnNames } from "./utils/reorder-column-names";
