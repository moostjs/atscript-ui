import type { TAtscriptAnnotatedType, TAtscriptTypeObject } from "@atscript/typescript/utils";

export const WF_CONTEXT_PASS = "wf.context.pass";
const UI_FORM_ACTION = "ui.form.action";
const WF_ACTION_WITH_DATA = "wf.action.withData";
const UI_ALT_ACTION = "ui.altAction";

export interface TFormActions {
  actions: string[];
  actionsWithData: string[];
}

const formActionsCache = new WeakMap<TAtscriptAnnotatedType, TFormActions>();

/**
 * Extract whitelisted context keys from workflow state.
 * Reads `@wf.context.pass` annotations from the form type metadata.
 */
export function extractPassContext(
  type: TAtscriptAnnotatedType,
  wfContext: Record<string, unknown>,
): Record<string, unknown> {
  const passKeys = type.metadata.get(WF_CONTEXT_PASS as never) as string[] | undefined;
  if (!passKeys?.length) return {};
  const context: Record<string, unknown> = {};
  for (const key of passKeys) {
    if (key in wfContext) {
      context[key] = wfContext[key];
    }
  }
  return context;
}

/**
 * Read declared action names from `@ui.form.action` and `@wf.action.withData` annotations.
 * Also reads legacy `@ui.altAction` as a stateless action fallback.
 * Results are cached per type identity.
 */
export function getFormActions(type: TAtscriptAnnotatedType): TFormActions {
  const cached = formActionsCache.get(type);
  if (cached) return cached;

  const actions: string[] = [];
  const actionsWithData: string[] = [];

  if (type.type.kind !== "object") {
    const result = { actions, actionsWithData };
    formActionsCache.set(type, result);
    return result;
  }

  const objectType = type as TAtscriptAnnotatedType<TAtscriptTypeObject>;
  for (const [, fieldType] of objectType.type.props) {
    const formAction = fieldType.metadata.get(UI_FORM_ACTION as never) as
      | { id: string; label?: string }
      | string
      | undefined;
    if (formAction) {
      actions.push(typeof formAction === "string" ? formAction : formAction.id);
      continue;
    }

    const wfAction = fieldType.metadata.get(WF_ACTION_WITH_DATA as never) as string | undefined;
    if (wfAction) {
      actionsWithData.push(wfAction);
      continue;
    }

    const altAction = fieldType.metadata.get(UI_ALT_ACTION as never) as
      | { id: string; label?: string }
      | string
      | undefined;
    if (altAction) {
      actions.push(typeof altAction === "string" ? altAction : altAction.id);
    }
  }

  const result = { actions, actionsWithData };
  formActionsCache.set(type, result);
  return result;
}
