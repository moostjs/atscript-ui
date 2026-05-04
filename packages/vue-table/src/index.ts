// ── Types ───────────────────────────────────────────────────
export type {
  TAsTableControls,
  TAsCellTypeComponents,
  ReactiveTableState,
  ColumnMenuConfig,
  ConfigTab,
  NavKeyOptions,
  TableNavBridge,
  MainActionRequest,
  QueryErrorKind,
  TVueTableActionInfo,
  TableActionsState,
  ActionResult,
  InvokeOpts,
  RowDeleteOpt,
} from "./types";

// ── Composables ─────────────────────────────────────────────
export { useTable, clearTableCache, type UseTableOptions } from "./composables/use-table";
export {
  setDefaultClientFactory,
  getDefaultClientFactory,
  resetDefaultClientFactory,
  type ClientFactory,
} from "@atscript/ui";
export {
  useTableContext,
  useTableContextOptional,
  createTableState,
  createStaticTableState,
  type TableContext,
  type CreateTableStateOptions,
  type CreateStaticTableStateOptions,
  type TableStateInternals,
} from "./composables/use-table-state";
export { useTableSelection, type SelectionPersistence } from "./composables/use-table-selection";
export { useTableNavBridge } from "./composables/use-table-nav-bridge";
export { useTableFilter } from "./composables/use-table-filter";
export { useTableSearch } from "./composables/use-table-search";
export { useTableActions } from "./composables/use-table-actions";
export { useTableUrlQuery, type UseTableUrlQueryOptions } from "./composables/use-table-url-query";
export type { UrlQuerySync } from "@atscript/ui-table";

// ── Presets / app prefs (public dev API) ────────────────────
export { AS_PRESETS_APP, injectPresetsApp } from "./composables/as-presets-app";
export {
  useAppPrefs,
  type UseAppPrefsOptions,
  type UseAppPrefsReturn,
} from "./composables/use-app-prefs";
export {
  usePresets,
  type UsePresetsOptions,
  type UsePresetsReturn,
  type ActivePresetView,
} from "./composables/use-presets";
export {
  useLocalDraft,
  type UseLocalDraftOptions,
  type UseLocalDraftReturn,
  type StorageLike,
} from "./composables/use-local-draft";

// Re-export the framework-agnostic types for ergonomic single-import devs
export type {
  AppConfData,
  AsPresetEntryRow,
  PresetAspect,
  PresetCapabilities,
  PresetData,
  PresetSnapshot,
  PresetSnapshotWire,
  SystemPreset,
  SystemPresetInput,
  UserConfData,
} from "@atscript/ui-table";
export {
  PRESET_ASPECTS,
  STANDARD_PRESET_ID,
  SYSTEM_PRESET_PREFIX,
  isSystemPresetId,
  resolveSystemPresets,
} from "@atscript/ui-table";

// ── Component resolution ────────────────────────────────────
export { useTableComponent } from "./composables/use-table-component";

// ── Public components (Tier 1 — user-tagged) ────────────────
export { default as AsTableRoot } from "./components/as-table-root.vue";
export { default as AsTable } from "./components/as-table.vue";
export { default as AsWindowTable } from "./components/as-window-table.vue";
export { default as AsTableActions } from "./components/as-table-actions.vue";
export { default as AsFilters } from "./components/as-filters.vue";
export { default as AsPresetPicker } from "./components/as-preset-picker.vue";

// ── Default implementations (Tier 2 — swap targets) ─────────
export { createDefaultControls } from "./composables/create-default-controls";
export { createDefaultCellTypes } from "./composables/create-default-cell-types";
export {
  AsColumnMenu,
  AsConfigDialog,
  AsFilterDialog,
  AsFilterField,
  AsFilterInput,
  AsPresetDialog,
  AsRowActions,
  AsTableCellValue,
  AsTableHeaderCell,
} from "./components/defaults";

// ── Utilities ───────────────────────────────────────────────
export { getColumnWidth } from "./utils/column-width";
export { getCellValue } from "./utils/get-cell-value";
export { formatCellValue } from "./utils/format-cell";
export { extractIdentifier } from "./composables/state/intent-scope";
