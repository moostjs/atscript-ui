import type { FormDef, TFormAction } from "./types";
import { getFieldMeta } from "../shared/field-resolver";
import { UI_FORM_ACTION, WF_ACTION_WITH_DATA } from "../shared/annotation-keys";

/** One declared form action: its id and whether it carries form data. */
export interface FormActionInfo {
  id: string;
  withData: boolean;
}

/**
 * Declared actions of a form — the union of `@ui.form.action` ids and
 * `@wf.action.withData` ids across all fields. `withData` distinguishes a
 * data-carrying workflow action (sends the current form payload) from a plain
 * stateless action. Single source of truth for "what actions can a host fire".
 */
export function getDeclaredFormActions(def: FormDef): FormActionInfo[] {
  const out: FormActionInfo[] = [];
  for (const field of def.fields) {
    const withData = getFieldMeta(field.prop, WF_ACTION_WITH_DATA) as string | undefined;
    if (withData) {
      out.push({ id: withData, withData: true });
      // One action per field; withData wins here. The server's getFormActions (@atscript/moost-wf) resolves UI_FORM_ACTION first — never co-declare both @ui.form.action and @wf.action.withData on a single field.
      continue;
    }
    const plain = getFieldMeta(field.prop, UI_FORM_ACTION) as TFormAction | undefined;
    if (plain?.id) out.push({ id: plain.id, withData: false });
  }
  return out;
}
