import type { ColumnDef } from "@atscript/ui";

/**
 * Typed forms of filter text — the helpers behind both the filter input (which
 * validates what a user types) and the query encoder (which types what a URL
 * or a preset carried), so a value means the same wherever it came from.
 */

/** `true` / `false` (case-insensitive) as a boolean; `undefined` for anything else. */
export function coerceBoolean(raw: unknown): boolean | undefined {
  if (typeof raw === "boolean") return raw;
  if (typeof raw !== "string") return undefined;
  const lower = raw.trim().toLowerCase();
  if (lower === "true") return true;
  if (lower === "false") return false;
  return undefined;
}

const NUMERIC_TEXT = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

/** Whether `raw` is plain decimal-number text (`12`, `-0.5`, `1e3`) — not `Infinity`, `0x1`, or `1_000`. */
export function isNumericText(raw: string): boolean {
  return NUMERIC_TEXT.test(raw.trim());
}

/**
 * The typed value of numeric filter text for a column of the given storage
 * kind, or `undefined` when the text is not one.
 *
 * - an `integer` column takes whole numbers only;
 * - a `decimal` column keeps the text as a **string** (decimals are strings
 *   end to end — a JS number would round them; the server takes numeric
 *   strings);
 * - any other numeric column gets a number.
 */
export function coerceNumericText(
  raw: string,
  valueKind?: ColumnDef["valueKind"],
): string | number | undefined {
  if (!isNumericText(raw)) return undefined;
  const text = raw.trim();
  if (valueKind === "decimal") return text;
  const n = Number(text);
  if (!Number.isFinite(n)) return undefined;
  return valueKind === "integer" && !Number.isInteger(n) ? undefined : n;
}
