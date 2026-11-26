import type { ResolvedValueHelp } from "./resolve";
import type { TFormEntryOptions, ValueHelpInfo } from "./types";

/**
 * Values a dropdown lists from a dictionary (`@ui.form.type 'select'` /
 * `@ui.type 'select'` on a bound field, since 0.1.190). A read asks for one
 * more: when it comes back the list is too long for a dropdown, and the field
 * keeps its search picker.
 */
export const VALUE_HELP_OPTIONS_CAP = 200;

/**
 * Dictionary rows as dropdown options (since 0.1.190): the committed
 * `targetField` value as the option's value, the label field's text (the key
 * when it has none) and the description after a dash.
 */
export function valueHelpOptions(
  rows: Record<string, unknown>[],
  resolved: ResolvedValueHelp,
  info: Pick<ValueHelpInfo, "targetField">,
): Exclude<TFormEntryOptions, string>[] {
  return rows.map((row) => {
    const value = row[info.targetField] as string | number | boolean;
    const key = String(value);
    const label = row[resolved.labelField];
    const descr = resolved.descrField ? row[resolved.descrField] : undefined;
    const text =
      label === undefined || label === null || label === "" ? key : String(label as string);
    return { key, label: descr ? `${text} — ${String(descr as string)}` : text, value };
  });
}
