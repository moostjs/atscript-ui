import { outletHttp, type WfOutletRequest } from "@moostjs/event-wf";
import { serializeFormSchema, extractPassContext } from "@atscript/moost-wf";
import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";

/**
 * Build an `outletHttp(...)` payload that `<AsWfForm>` understands.
 *
 * The default `createHttpOutlet()` spreads the outlet payload into the
 * HTTP response body and the trigger appends the state token. By wrapping
 * `{ inputRequired: { payload, transport, context } }` as the payload,
 * the final response becomes `{ inputRequired: {...}, wfs: "<token>" }`
 * — exactly what the `<AsWfForm>` / `useWfForm` composable expects.
 */
export function httpInputRequired(
  type: TAtscriptAnnotatedType,
  wfContext: object,
  errors?: Record<string, string>,
): { inputRequired: WfOutletRequest } {
  const context: Record<string, unknown> = {
    ...extractPassContext(type, wfContext as Record<string, unknown>),
  };
  if (errors) context.errors = errors;
  return outletHttp({
    inputRequired: {
      payload: serializeFormSchema(type),
      transport: "http",
      context,
    },
  }) as { inputRequired: WfOutletRequest };
}
