// Phase-1 helper barrel + Phase-3 RFC consolidation. Phase-2/3 batches MUST
// import from this file only — see tests/e2e/PLAN.md "Coordination rules"
// + tests/e2e/helpers/README.md for the rules around extending it.
//
// Phase-3 (current): the inlined helpers from batches D/E/F/G/H that survived
// 3+ uses across spec files were promoted here. Future batches keep doing
// the same dance: copy-paste-once, copy-paste-twice, RFC + promote on the
// third call site.

// Auth + role fixtures
export { DEMO_PASSWORD, DEMO_ROLES, authFileFor, performLogin } from "./auth";
export type { DemoRole, RoleSpec } from "./auth";

// Seed reset (mutating-batch beforeAll)
export { resetSeed } from "./seed";

// Network observers — the Conventions baseline assertion + the no-refetch path.
export { expectNoPages, expectSinglePages } from "./network";

// URL bridge — decoded-equivalence comparison per Scenario 6.4.
export { expectUrlQuery } from "./url";

// Viewport (Section 18 mobile fullscreen branch).
export {
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
  setDesktopViewport,
  setMobileViewport,
} from "./viewport";

// Clipboard sink — Scenario 8.3.
export { getClipboardWrites, getLastClipboardWrite, installClipboardSink } from "./clipboard";

// Outlet sink — Scenario 19.x (workflows). Phase-1 uses it for MFA login only.
export { serverLogOffset, waitForOtp, waitForOutletEntry } from "./outlet";
export type { OutletEntry } from "./outlet";

// Raw-HTTP request client — Section 20.
export { newAnonRequestContext, newRequestContext } from "./request";

// Table navigation — `gotoTable` is the only DOM helper Phase 1 needs.
export { gotoTable } from "./table";

// Filter pills (toolbar Filters dialog) + per-pill input helpers — Section 4.
export { addFilterPill, commitPillInput, pickPillEnumValue, pillByLabel } from "./filter";

// Toolbar `<AsConfigDialog>` (Columns / Filters / Sorters tabs) — Sections 5 + 7.
export {
  applyConfig,
  cancelConfig,
  configActivePanel,
  configDialog,
  configListRow,
  configTabTrigger,
  moveConfigListRowDown,
  openConfigDialog,
  toggleConfigListRow,
} from "./dialog";
export type { ConfigTab } from "./dialog";

// Phase-3 promoted helpers ----------------------------------------------------

// Selection (Section 9 + Sections 8/10/11 supporting paths).
export {
  clearSelection,
  selectRowByIndex,
  selectedRowCellTexts,
  toggleSelectMode,
} from "./selection";

// Pagination (Section 10).
export { clickPaginationNext, clickPaginationPage, setItemsPerPage } from "./pagination";

// Row identity / cell access (Sections 2, 8, 10 — hot paths in batches A/E/F/G).
export { columnCellIndex, rowByCellText, texts, userRowByName } from "./rows";

// Action menus + dialogs + toasts (Section 8 — promoted from batches E + F).
export {
  awaitActionFormReady,
  clickRowMenuItem,
  clickToolbarAction,
  dismissActionForm,
  dismissConfirm,
  findToast,
  openRowActionsMenu,
} from "./actions";

// Column-header sort menu + sort indicator (Sections 6 + 7 + 11).
export { clickColumnHeader, pickSort, sortIndicator } from "./columns";

// Preset picker / manager dialog (Section 11).
export {
  applyPickerItem,
  dialogRow,
  openManageDialog,
  openPresetPicker,
  openSaveAsPopover,
} from "./preset";

// Wire-request capture with leak-free `dispose()` (replaces batch F's
// inline `captureWirePost` + batch H's `capturePresetWire`).
export { captureLastPost, capturePresetWire, captureWire } from "./wire";
export type { CaptureOpts, WireCapture, WireRecord } from "./wire";
