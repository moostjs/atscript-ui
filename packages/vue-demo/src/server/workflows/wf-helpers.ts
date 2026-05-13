import { outletHttp, type WfOutletRequest } from "@moostjs/event-wf";
import { serializeFormSchema, extractPassContext } from "@atscript/moost-wf";
import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";

/**
 * Build the outlet payload for a "pause, render form" step.
 *
 * `createAsHttpOutlet()` (mounted in the wf controller) supplies the
 * `{ inputRequired: { payload, transport, context } }` envelope, so this
 * helper only needs to hand the outlet the serialized schema plus the
 * passed-through context (and optional field-level errors merged into it).
 */
export function httpInputRequired(
  type: TAtscriptAnnotatedType,
  wfContext: object,
  errors?: Record<string, string>,
): WfOutletRequest {
  const context: Record<string, unknown> = {
    ...extractPassContext(type, wfContext as Record<string, unknown>),
  };
  if (errors) context.errors = errors;
  return outletHttp(serializeFormSchema(type), context) as WfOutletRequest;
}
