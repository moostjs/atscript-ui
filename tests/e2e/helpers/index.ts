// Phase-1 helper barrel. Phase-2 batches MUST import from this file only —
// see tests/e2e/PLAN.md "Coordination rules" + tests/e2e/helpers/README.md
// for the rules around extending it.
//
// New helpers require a chat RFC. The `// TODO(phase-2):` markers below sketch
// the shape Phase-2 batches will need; treat them as design notes, not stubs.

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

// Filter pills (toolbar Filters dialog) — Section 4.
export { addFilterPill, pillByLabel } from "./filter";

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

// ---------------------------------------------------------------------------
// Phase-2 helpers — placeholders. Add via chat RFC, not by ad-hoc import.
//
// table.ts:
//   - getRow(page, identifier): Locator                           // unique row by `data-row-id` or row content
//   - getCell(page, row, column): Locator                         // cell by header label
//   - openColumnMenu(page, column): Promise<void>                 // open header dropdown
// filter.ts:
//   - setPillValue(page, column, value): Promise<void>            // type into pill input + commit
//   - removeFilterPill(page, column): Promise<void>               // x button on pill
//   - openFilterDialog(page, column): Promise<void>               // per-column dialog (Section 4)
// action.ts:
//   - triggerRowAction(page, rowId, name): Promise<void>          // row-level action menu
//   - triggerTableAction(page, name): Promise<void>               // toolbar actions
//   - multiSelect(page, rowIds: string[]): Promise<void>          // tick selection checkboxes
//
// Each helper above must own ONE concern and document a single mutation /
// query path. If a Phase-2 batch needs a composite ("apply filter and assert
// single query"), compose `expectSinglePages(page, () => addFilterPill(...))`
// in the spec — DO NOT bake composite calls into the barrel.
