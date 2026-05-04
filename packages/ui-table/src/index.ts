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
export { escapeRegex, unescapeRegex } from "./filters/escape-regex";

// ── Filter input format ─────────────────────────────────────
export {
  parseFilterInput,
  formatFilterCondition,
  defaultCondition,
} from "./filters/filter-input-format";

// ── Filters to Uniquery ─────────────────────────────────────
export { filtersToUniqueryFilter } from "./filters/filters-to-uniquery";
export { uniqueryFilterToFieldFilters } from "./filters/uniquery-to-filters";

// ── Date shortcuts ──────────────────────────────────────────
export type { DateShortcut } from "./filters/date-shortcuts";
export { dateShortcuts } from "./filters/date-shortcuts";

// ── Preset types ────────────────────────────────────────────
export type { PresetSnapshot } from "./presets/preset-types";
export type {
  PresetSnapshotWire,
  PresetColumnWidthEntry,
  PresetFilterOpEntry,
  PresetSorterEntry,
} from "./presets/preset-wire-types";
export type { PresetAspect, AspectMask } from "./presets/preset-aspects";
export { PRESET_ASPECTS, derivePresetAspects } from "./presets/preset-aspects";

// ── Preset wire converter ───────────────────────────────────
export { toWireSnapshot, fromWireSnapshot } from "./presets/preset-wire";

// ── Preset application-layer types ──────────────────────────
export type {
  AppConfData,
  AsPresetEntryData,
  AsPresetEntryRow,
  AsPresetsErrorCode,
  PresetCapabilities,
  PresetData,
  PresetLimitReachedBody,
  UserConfData,
} from "./presets/preset-data-types";

// ── Preset id helpers + reserved namespaces ─────────────────
export {
  SYSTEM_PRESET_PREFIX,
  USER_CONF_PREFIX,
  APP_CONF_PREFIX,
  RESERVED_ID_PREFIXES,
  STANDARD_PRESET_ID,
  userConfId,
  appConfId,
  isSystemPresetId,
  normaliseSystemPresetId,
} from "./presets/preset-id";

// ── System presets ──────────────────────────────────────────
export type { SystemPreset, SystemPresetInput } from "./presets/system-presets";
export { resolveSystemPresets } from "./presets/system-presets";

// ── Dirty detection ─────────────────────────────────────────
export { stableStringify, isDirtyAgainst } from "./presets/preset-dirty";

// ── Local draft (localStorage overlay) ──────────────────────
export type { PresetDraft, DraftPersistedAspect } from "./presets/preset-draft";
export {
  DRAFT_PERSISTED_ASPECTS,
  serializeDraft,
  deserializeDraft,
  isEmptyDraft,
  draftMatchesPreset,
} from "./presets/preset-draft";

// ── PresetsClient (preset + userConf rows) ──────────────────
export type {
  PresetsClientConfig,
  PresetsListResult,
  PresetsSaveAsOptions,
  PresetsSaveResult,
} from "./presets/presets-client";
export { PresetsClient, PresetsHttpError, isAuthError } from "./presets/presets-client";

// ── AppPrefsClient (app-wide user prefs) ────────────────────
export type { AppPrefsClientConfig, AppPrefsLoadResult } from "./presets/app-prefs-client";
export { AppPrefsClient } from "./presets/app-prefs-client";

// ── Query builder ──────────────────────────────────────────
export type { BuildTableQueryOptions } from "./query/build-table-query";
export { buildTableQuery } from "./query/build-table-query";
export { mergeSorters } from "./query/merge-sorters";
export { mergeFilters } from "./query/merge-filters";

// ── URL query bridge ───────────────────────────────────────
export type {
  AspectGate,
  UrlQueryStateLike,
  UrlQueryStateSnapshot,
  UrlQueryDefaults,
  UrlQueryParseOptions,
  UrlQuerySync,
} from "./query/url-query";
export { resolveAspectGate, stateToUrlQueryString, urlQueryStringToState } from "./query/url-query";

// ── Selection ──────────────────────────────────────────────
export type { SelectionMode } from "./selection/selection-fns";
export { togglePk, trimSelection, rowsToPks } from "./selection/selection-fns";

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
export { arraysEqual, sameColumnSet, setsEqual, sortersEqual } from "./utils/equality";
export type { ColumnReorderPosition } from "./utils/reorder-column-names";
export { reorderColumnNames } from "./utils/reorder-column-names";
