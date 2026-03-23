import { setResolver } from "@atscript/ui";
import { DynamicFieldResolver } from "./runtime/dynamic-resolver";

// ── Types ────────────────────────────────────────────────────
export type { TFnScope, TComputed, TFieldEvaluated } from "./runtime/types";

// ── Fn compiler ──────────────────────────────────────────────
export { compileFieldFn, compileTopFn, compileValidatorFn } from "./runtime/fn-compiler";

// ── Dynamic resolver ─────────────────────────────────────────
export { DynamicFieldResolver } from "./runtime/dynamic-resolver";
export { buildFieldEntry } from "./runtime/dynamic-resolver";
export type { TBuildFieldEntryOpts } from "./runtime/dynamic-resolver";

// ── Validator plugin ─────────────────────────────────────────
export { uiFnsValidatorPlugin } from "./runtime/validator-plugin";
export type { TValidatorContext } from "./runtime/validator-plugin";

// ── Install ──────────────────────────────────────────────────

/**
 * Installs the dynamic field resolver into @atscript/ui.
 * Call this once at app startup to enable `ui.fn.*` annotation resolution.
 *
 * ```ts
 * import { installDynamicResolver } from '@atscript/ui-fns'
 * installDynamicResolver()
 * ```
 */
export function installDynamicResolver(): void {
  setResolver(new DynamicFieldResolver());
}
