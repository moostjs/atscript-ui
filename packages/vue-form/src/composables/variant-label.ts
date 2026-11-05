import type { FormUnionVariant, UiT } from "@atscript/ui";
import { AS_UI_MESSAGES } from "@atscript/ui/messages";

/**
 * A union variant's label in the UI locale: a generated type name
 * (`labelCode`, e.g. "1. String") is worded with `t` at render time —
 * a definition is built once for every locale (and on a server).
 */
export function variantLabel(variant: FormUnionVariant, t: UiT): string {
  const code = variant.labelCode;
  return code ? variant.label.slice(0, -AS_UI_MESSAGES[code].length) + t(code) : variant.label;
}
