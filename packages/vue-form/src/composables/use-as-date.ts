import { computed, type ComputedRef } from "vue";

/**
 * Storage convention — atscript marks date-bearing fields with the
 * `number.timestamp` primitive (epoch-ms numbers). The default form
 * components mirror the cell-side rule: accept `Date | number | string`
 * for read, commit back as `number` (epoch-ms) when storage is numeric,
 * else commit the raw ISO string.
 *
 * `<input type="date">` uses `YYYY-MM-DD`,
 * `<input type="datetime-local">` uses `YYYY-MM-DDTHH:mm`,
 * `<input type="time">` uses `HH:mm`. The HTML5 spec treats these as
 * locale-agnostic strings — we must produce them deterministically.
 */

type ModelValue = number | string | Date | null | undefined;

export interface UseAsDateOptions {
  modelValue: () => ModelValue;
  /** Variant: `'date'` (default), `'datetime'`, `'time'`. Drives both parse and serialize. */
  kind: "date" | "datetime" | "time";
  /** Commit the parsed value. Numeric epoch-ms when the previous value was numeric, ISO string otherwise. `null` clears. */
  onCommit: (value: number | string | null) => void;
}

export interface UseAsDateReturn {
  /** HTML5 input type — `'date' | 'datetime-local' | 'time'`. */
  inputType: "date" | "datetime-local" | "time";
  /** Bind to `<input :value>`. Empty string when no model. */
  displayValue: ComputedRef<string>;
  /** Bind to `@change` / `@input`. Parses the HTML5 string into the storage type. */
  setFromInput: (raw: string) => void;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toDate(v: ModelValue): Date | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v : undefined;
  // For "time" we accept "HH:mm" or "HH:mm:ss" — Date can't parse those
  // alone, so "time" formatting is handled by the kind branch in displayValue.
  if (typeof v === "number" || typeof v === "string") {
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d : undefined;
  }
  return undefined;
}

/**
 * Format a Date for `<input type="date|datetime-local">`. Renders in the
 * user's local timezone — matching browser-native behaviour for the
 * underlying input element. Storage epoch-ms remains UTC.
 */
function formatLocal(d: Date, kind: "date" | "datetime"): string {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  if (kind === "date") return `${y}-${m}-${day}`;
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

/** Extract HH:mm from an epoch-ms number / Date / ISO string. */
function formatTime(v: ModelValue): string {
  if (v === null || v === undefined || v === "") return "";
  // Bare "HH:mm" or "HH:mm:ss" — pass through (truncated to HH:mm).
  if (typeof v === "string" && /^\d{1,2}:\d{2}(:\d{2})?$/.test(v)) {
    const [hh, mm] = v.split(":");
    return `${pad2(Number(hh))}:${mm}`;
  }
  const d = toDate(v);
  if (!d) return "";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Composable backing `AsDate` / `AsDatetime` / `AsTime`. Pick the variant
 * via `kind`. Conversion direction:
 *
 * - `'date'`: epoch-ms ↔ `YYYY-MM-DD` (local TZ).
 *   Empty input commits `null`. If previous value was a `string`,
 *   commits a string (`YYYY-MM-DD`); otherwise commits epoch-ms (UTC
 *   midnight on the picked date in local TZ — same as `new Date(str)`).
 * - `'datetime'`: epoch-ms ↔ `YYYY-MM-DDTHH:mm` (local TZ).
 * - `'time'`: prev-string ↔ `HH:mm`. Numeric storage isn't meaningful
 *   for naked time-of-day, so we commit a string.
 */
export function useAsDate(opts: UseAsDateOptions): UseAsDateReturn {
  const inputType: UseAsDateReturn["inputType"] =
    opts.kind === "datetime" ? "datetime-local" : opts.kind === "time" ? "time" : "date";

  const displayValue = computed<string>(() => {
    const v = opts.modelValue();
    if (opts.kind === "time") return formatTime(v);
    const d = toDate(v);
    if (!d) return "";
    return formatLocal(d, opts.kind === "datetime" ? "datetime" : "date");
  });

  function setFromInput(raw: string): void {
    if (raw === "") {
      opts.onCommit(null);
      return;
    }
    if (opts.kind === "time") {
      // HH:mm → string. Numeric storage isn't meaningful here.
      opts.onCommit(raw);
      return;
    }
    // `<input type="date">` / `datetime-local` give a deterministic
    // string we can hand straight to `Date()` — local-TZ semantics
    // match what the user picked. Preserve the storage shape: if the
    // previous value was a string, commit a string; else commit epoch.
    const prev = opts.modelValue();
    if (typeof prev === "string") {
      opts.onCommit(raw);
      return;
    }
    const d = new Date(raw);
    if (!Number.isFinite(d.getTime())) return;
    opts.onCommit(d.getTime());
  }

  return { inputType, displayValue, setFromInput };
}
