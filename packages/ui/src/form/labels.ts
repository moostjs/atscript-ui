import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { UI_FORM_LABEL_SINGULAR } from "../shared/annotation-keys";
import { getFieldMeta } from "../shared/field-resolver";

/** Singular label for an array field (used by AsArray for "Add <singular>"). */
export function resolveSingularLabel(meta: TAtscriptAnnotatedType | undefined): string {
  if (!meta) return "item";
  const value = getFieldMeta(meta, UI_FORM_LABEL_SINGULAR) as string | undefined;
  return value || "item";
}
