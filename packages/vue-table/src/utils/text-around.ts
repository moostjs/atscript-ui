import type { UiT, UiTextParams } from "@atscript/ui";

const MARK = "\u0000";

/**
 * A UI text with one param rendered as markup (a count in a badge, a search
 * term in a code span): `[before, value, after]`. The text is worded with the
 * real value (a translator can pick a plural form); the param is located
 * where the text template puts it, else at the value's first occurrence.
 * `value` is `""` when the translation leaves it out.
 */
export function textAround(
  t: UiT,
  code: string,
  name: string,
  params: UiTextParams,
): [before: string, value: string, after: string] {
  const text = t(code, params);
  const shown = String(params[name] as string | number);
  const at = t(code, { ...params, [name]: MARK }).indexOf(MARK);
  const start = at >= 0 && text.startsWith(shown, at) ? at : text.indexOf(shown);
  return start < 0
    ? [text, "", ""]
    : [text.slice(0, start), shown, text.slice(start + shown.length)];
}
