// Lives in `@atscript/ui-table` (not `@atscript/ui-styles`): `@atscript/ui-styles`
// devDepends on `@atscript/vue-table`, so the inverse runtime dep would create a
// pnpm/vp task-graph cycle. 32px aligns with vunor's `h-fingertip-s`.
export const DEFAULT_ROW_HEIGHT_PX = 32;
