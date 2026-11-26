import {
  VALUE_HELP_OPTIONS_CAP,
  valueHelpOptions,
  type TFormEntryOptions,
  type ValueHelpInfo,
} from "@atscript/ui";
import { computed, ref, watch, type ComputedRef, type Ref } from "vue";
import { useAsValueHelp } from "./use-as-value-help";
import { soleRow } from "./_shape";

export interface UseAsValueHelpOptionsOptions {
  info: ValueHelpInfo;
  model: { value: unknown };
  onBlur: () => void;
}

export interface UseAsValueHelpOptionsReturn {
  /** The dictionary's rows as options (the current value first when no row holds it). */
  options: ComputedRef<TFormEntryOptions[]>;
  /** The dictionary has more rows than `VALUE_HELP_OPTIONS_CAP`: show the search picker. */
  overflow: Ref<boolean>;
  /**
   * Commit a value of the list through the one pick path (`selectItem`, so
   * the binding's fills apply); an empty value clears, as the picker's "×" does.
   * A value several loaded rows hold is committed without fills.
   */
  pick: (value: unknown) => void;
}

/** One dev-mode warning per binding (url + field). */
const warned = new Set<string>();

function isDev(): boolean {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return true;
  }
}

const isEmpty = (v: unknown) => v === undefined || v === null || v === "";

/**
 * Options of a `select` / `radio` field bound to a dictionary (`@ui.valueHelp`
 * or `@db.rel.FK`) that declares no options of its own (since 0.1.190): one
 * read of the dictionary in the binding's scope — the form's host values
 * included, read again when they change — with the select of every
 * value-help read, capped at `VALUE_HELP_OPTIONS_CAP`. A longer list
 * sets `overflow` and warns once in development.
 */
export function useAsValueHelpOptions(
  opts: UseAsValueHelpOptionsOptions,
): UseAsValueHelpOptionsReturn {
  const { info, model, onBlur } = opts;
  const vh = useAsValueHelp({ info, model, onBlur, limit: VALUE_HELP_OPTIONS_CAP + 1 });
  const overflow = ref(false);

  watch(vh.results, (rows) => {
    if (rows.length <= VALUE_HELP_OPTIONS_CAP || overflow.value) return;
    overflow.value = true;
    const key = `${info.url}\0${info.targetField}`;
    if (isDev() && !warned.has(key)) {
      warned.add(key);
      console.warn(
        `[vue-form] The dictionary at ${info.url} has more than ${VALUE_HELP_OPTIONS_CAP} values for a dropdown: the field shows the search picker instead.`,
      );
    }
  });

  const options = computed<TFormEntryOptions[]>(() => {
    const resolved = vh.resolved.value;
    if (!resolved) return [];
    const rows = vh.results.value.slice(0, VALUE_HELP_OPTIONS_CAP);
    const list = valueHelpOptions(rows, resolved, info);
    // A value the scope no longer lists stays (and shows) until it is changed.
    const current = model.value;
    if (!isEmpty(current) && !rows.some((row) => row[info.targetField] === current)) {
      const key = String(current as string | number | boolean);
      list.unshift({ key, label: key, value: current as string | number | boolean });
    }
    return list;
  });

  function pick(value: unknown) {
    if (isEmpty(value)) {
      vh.clear(value);
      return;
    }
    // An option is a value, not a row: when several rows hold it (a dictionary keyed by
    // more fields), the value is committed without fills rather than from a guessed row.
    const row = soleRow(vh.results.value, info.targetField, value);
    if (row) vh.selectItem(row);
    else model.value = value;
  }

  return { options, overflow, pick };
}
