import {
  META_LABEL,
  userText,
  type FormUnionVariant,
  type UiT,
  type UserTextT,
} from "@atscript/ui";
import { AS_UI_MESSAGES } from "@atscript/ui/messages";

/**
 * A union variant's label in the UI locale: a generated type name
 * (`labelCode`, e.g. "1. String") is worded with `t`, a declared `@meta.label`
 * (`labelText`) translated with `text` (see `useAsModelTexts`), both at render
 * time — a definition is built once for every locale (and on a server), and
 * its texts may be translated by the server already.
 */
export function variantLabel(variant: FormUnionVariant, t: UiT, text?: UserTextT): string {
  const { label, labelCode, labelText } = variant;
  if (labelCode) return label.slice(0, -AS_UI_MESSAGES[labelCode].length) + t(labelCode);
  return labelText === undefined
    ? label
    : label.slice(0, -labelText.length) + userText(META_LABEL, labelText, text);
}
