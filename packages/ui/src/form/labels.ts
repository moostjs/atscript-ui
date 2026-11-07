import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { UI_FORM_LABEL_SINGULAR } from "../shared/annotation-keys";
import { getUiTexts, type UiT } from "../i18n/ui-texts";
import { fieldText, type UserTextT } from "../i18n/model-texts";

/**
 * Singular label for an array field (used by AsArray for "Add <singular>"):
 * `@ui.form.label.singular` (translated with `text`), else `t("UI_ITEM")` ("item").
 */
export function resolveSingularLabel(
  meta: TAtscriptAnnotatedType | undefined,
  t: UiT = getUiTexts().t,
  text?: UserTextT,
): string {
  const value = meta && (fieldText(meta, UI_FORM_LABEL_SINGULAR, text) as string | undefined);
  return value || t("UI_ITEM");
}
