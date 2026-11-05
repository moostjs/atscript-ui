import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { UI_FORM_LABEL_SINGULAR } from "../shared/annotation-keys";
import { getFieldMeta } from "../shared/field-resolver";
import { getUiTexts, type UiT } from "../i18n/ui-texts";

/**
 * Singular label for an array field (used by AsArray for "Add <singular>"):
 * `@ui.form.label.singular`, else `t("UI_ITEM")` ("item").
 */
export function resolveSingularLabel(
  meta: TAtscriptAnnotatedType | undefined,
  t: UiT = getUiTexts().t,
): string {
  const value = meta && (getFieldMeta(meta, UI_FORM_LABEL_SINGULAR) as string | undefined);
  return value || t("UI_ITEM");
}
