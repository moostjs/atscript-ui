import type { TFormEntryOptions } from "@atscript/ui";

/**
 * Scope object passed to compiled functions.
 * Properties become variables inside compiled function strings:
 *   v, data, context, entry
 */
export interface TFnScope<V = unknown, D = Record<string, unknown>, C = Record<string, unknown>> {
  v?: V;
  data: D;
  context: C;
  entry?: TFieldEvaluated;
  action?: string;
}

/**
 * A value that is either static or a function of the fn scope.
 */
export type TComputed<T> = T | ((scope: TFnScope) => T);

/**
 * Minimal evaluated snapshot of a field — passed to validators and
 * computed functions as `entry`.
 */
export interface TFieldEvaluated {
  field: string;
  type: string;
  component?: string;
  name: string;
  disabled?: boolean;
  optional?: boolean;
  hidden?: boolean;
  readonly?: boolean;
  options?: TFormEntryOptions[];
}
