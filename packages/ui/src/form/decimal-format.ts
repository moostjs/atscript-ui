/**
 * Framework-agnostic decimal formatting + parsing helpers shared by
 * `@atscript/vue-table` (read-only cell display) and `@atscript/vue-form`
 * (editable amount/measure inputs). Symmetric output is the contract —
 * a value rendered in a cell must read identically when displayed in
 * the form composables, modulo currency / unit adornment.
 *
 * The functions here are intentionally pure (no `Number()` round-trips
 * in the storage value path) — decimal-as-string correctness depends on
 * not bouncing through floats.
 */

export interface CurrencyDisplay {
  /** Narrow symbol: "$" / "€" / "US$" depending on locale. Falls back to code on Intl failure. */
  symbol: string;
  /** Whether the symbol typically sits left or right of the amount. */
  position: "prefix" | "suffix";
}

export interface DecimalParts {
  sign: "" | "-";
  /** Integer part, no thousands separator, no leading zeros beyond "0". */
  integer: string;
  /** Decimal part as captured, no separator. Empty string if absent. */
  decimal: string;
}

export interface FormatDecimalOptions {
  value: string | number | null | undefined;
  /** Scale used for display (typically the effective scale, not DB scale). Trailing zeros pad. */
  scale?: number;
  locale?: string;
  /** When set → Intl.NumberFormat with style:currency. Symbol/grouping handled by Intl. */
  currency?: string;
  /** When set (and no currency) → "<formatted> <unit>". */
  unit?: string;
  /** Whether to group thousands. Defaults to true. */
  useGrouping?: boolean;
}

// Whitespace characters Intl might emit as a grouping separator across
// locales. NBSP (U+00A0), narrow NBSP (U+202F), regular space (U+0020).
const WHITESPACE_GROUP_RE = /[   ]/g;

// ── Intl.NumberFormat construction cache ──────────────────────
//
// Intl formatter constructors cost 0.5–2ms cold / ~50μs cached; called once
// per cell per render on virtual-scroll tables AND once per reactive read on
// every form composable, the construction quickly dominates render time.
// Keys collapse to a stable string so identical option sets share one
// formatter. Bounded by the number of distinct (locale, options) pairs in
// the app — in practice O(currencies × locales), well under any sane cap.
const numberFormatCache = new Map<string, Intl.NumberFormat>();

function getNumberFormat(
  locale: string | undefined,
  opts: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${locale ?? ""}|${opts.style ?? ""}|${opts.currency ?? ""}|${opts.currencyDisplay ?? ""}|${opts.useGrouping ?? ""}|${opts.minimumFractionDigits ?? ""}|${opts.maximumFractionDigits ?? ""}`;
  let f = numberFormatCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, opts);
    numberFormatCache.set(key, f);
  }
  return f;
}

// ── Locale-derived separators ─────────────────────────────────

const decimalSeparatorCache = new Map<string, string>();
const thousandsSeparatorCache = new Map<string, string>();
const currencyDisplayCache = new Map<string, CurrencyDisplay>();
const currencyDecimalsCache = new Map<string, number | undefined>();

/** "." in en-US, "," in fr-FR. Returns "." when locale is undefined. */
export function getDecimalSeparator(locale?: string): string {
  const key = locale ?? "";
  const cached = decimalSeparatorCache.get(key);
  if (cached !== undefined) return cached;
  let out = ".";
  try {
    const parts = getNumberFormat(locale, { useGrouping: false }).formatToParts(1.1);
    const dec = parts.find((p) => p.type === "decimal");
    out = dec?.value ?? ".";
  } catch {
    /* fall through with "." default */
  }
  decimalSeparatorCache.set(key, out);
  return out;
}

/**
 * "," in en-US, NNBSP (U+202F) in fr-FR. Returns "" when no grouping is
 * applied (or when Intl rejects the locale).
 */
export function getThousandsSeparator(locale?: string): string {
  const key = locale ?? "";
  const cached = thousandsSeparatorCache.get(key);
  if (cached !== undefined) return cached;
  let out = "";
  try {
    const parts = getNumberFormat(locale, { useGrouping: true }).formatToParts(1000000);
    const grp = parts.find((p) => p.type === "group");
    out = grp?.value ?? "";
  } catch {
    /* fall through with "" default */
  }
  thousandsSeparatorCache.set(key, out);
  return out;
}

// ── Currency metadata ─────────────────────────────────────────

export function getCurrencyDisplayParts(code: string, locale?: string): CurrencyDisplay {
  const key = `${locale ?? ""}|${code}`;
  const cached = currencyDisplayCache.get(key);
  if (cached) return cached;
  let out: CurrencyDisplay = { symbol: code, position: "prefix" };
  try {
    const parts = getNumberFormat(locale, {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);
    const idxCur = parts.findIndex((p) => p.type === "currency");
    const idxInt = parts.findIndex((p) => p.type === "integer");
    out = {
      symbol: parts[idxCur]?.value ?? code,
      position: idxInt === -1 || idxCur < idxInt ? "prefix" : "suffix",
    };
  } catch {
    /* fall through with code-as-symbol default */
  }
  currencyDisplayCache.set(key, out);
  return out;
}

/**
 * Currency's natural decimal count via Intl. JPY=0, USD/EUR=2, BHD/KWD=3.
 * Returns `undefined` for codes Intl doesn't know — caller falls back to
 * `dbPrecisionScale`.
 */
export function getCurrencyDecimals(code: string, locale?: string): number | undefined {
  if (!code) return undefined;
  const key = `${locale ?? ""}|${code}`;
  if (currencyDecimalsCache.has(key)) return currencyDecimalsCache.get(key);
  let out: number | undefined;
  try {
    const opts = getNumberFormat(locale, { style: "currency", currency: code }).resolvedOptions();
    const max = opts.maximumFractionDigits;
    out = typeof max === "number" ? max : undefined;
  } catch {
    out = undefined;
  }
  currencyDecimalsCache.set(key, out);
  return out;
}

// ── Decimal string operations (string-only, no Number()) ──────

/**
 * Parse a user-typed decimal string. Returns the canonical decimal
 * (no thousands separator, "." as decimal separator) or `null` if invalid.
 * Accepts both "." and "," as the decimal separator (locale-aware).
 * Strips the locale thousands separator. Preserves sign. Does NOT
 * enforce scale.
 */
export function parseDecimalInput(raw: string, locale?: string): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const decSep = getDecimalSeparator(locale);
  const thouSep = getThousandsSeparator(locale);

  // Sign: only at the very start, optional. Reject any other "-".
  let sign: "" | "-" = "";
  let body = trimmed;
  if (body.startsWith("-")) {
    sign = "-";
    body = body.slice(1);
  } else if (body.startsWith("+")) {
    body = body.slice(1);
  }
  if (body.length === 0) return null;
  if (body.includes("-") || body.includes("+")) return null;

  // Strip the locale-grouping char (treat as thousands separator). Validate
  // grouping shape on the integer side — must be `\d{1,3}(sep\d{3})+`, else
  // it's a stray decimal-style separator and we should refuse, not silently
  // collapse "1,2.3,4" into "12.34".
  if (thouSep && body.includes(thouSep)) {
    const decIdx = body.indexOf(decSep);
    const headRaw = decIdx === -1 ? body : body.slice(0, decIdx);
    const tail = decIdx === -1 ? "" : body.slice(decIdx);
    // Reject stray grouping char in the decimal tail.
    if (tail.includes(thouSep)) return null;
    if (headRaw.includes(thouSep)) {
      const groups = headRaw.split(thouSep);
      const first = groups[0]!;
      if (first.length < 1 || first.length > 3 || !/^\d+$/.test(first)) return null;
      for (let i = 1; i < groups.length; i += 1) {
        if (!/^\d{3}$/.test(groups[i]!)) return null;
      }
    }
    body = `${headRaw.split(thouSep).join("")}${tail}`;
  }
  // Cross-locale convenience: also strip internal whitespace chars (some
  // locales group with plain space / NBSP / NNBSP). Already trimmed at edges.
  body = body.replace(WHITESPACE_GROUP_RE, "");

  // Replace the locale decimal separator with "." for canonicalisation.
  // ALSO accept the opposite separator as a kindness — bank apps often
  // paste from clipboards where the user can't predict the locale.
  if (decSep !== ".") {
    // Locale uses "," for decimal. Multiple "," instances → ambiguous.
    if ((body.match(/,/g)?.length ?? 0) > 1) return null;
    if (body.includes(".") && body.includes(",")) return null;
    if (body.includes(",")) {
      body = body.replace(",", ".");
    }
    // If only "." appears in a comma-decimal locale (cross-paste from en-US),
    // we accept it as-is — already canonical.
  } else {
    // Locale uses "." for decimal. If "," remained after grouping-strip, it's
    // a cross-paste decimal IFF no "." is present. Otherwise reject.
    if (body.includes(",")) {
      if (body.includes(".")) return null;
      if ((body.match(/,/g)?.length ?? 0) > 1) return null;
      body = body.replace(",", ".");
    }
  }

  // Validate shape: optional digits, optional ".", optional digits.
  // Reject "12.34.56" (multiple separators), "abc", "", "--1", "1.2.3".
  if (!/^\d*\.?\d*$/.test(body)) return null;
  if (body === "" || body === ".") return null;

  // Drop trailing decimal point — "1234." → "1234".
  if (body.endsWith(".")) body = body.slice(0, -1);
  // Drop leading "." → ".5" → "0.5"
  if (body.startsWith(".")) body = `0${body}`;

  // Drop redundant leading zeros — "007" → "7", "0.5" stays, "0" stays.
  const dot = body.indexOf(".");
  if (dot === -1) {
    body = body.replace(/^0+(\d)/, "$1");
  } else {
    const head = body.slice(0, dot);
    const tail = body.slice(dot);
    body = `${head.replace(/^0+(\d)/, "$1")}${tail}`;
  }

  // Negative zero is just zero.
  if (sign === "-" && /^0+(\.0+)?$/.test(body)) sign = "";

  return `${sign}${body}`;
}

/**
 * Enforce a fractional-digit count by truncating or padding. String-only —
 * no float arithmetic. Default behaviour truncates (no rounding) so digits
 * the user typed can't silently shift. Pass `roundHalfUp: true` to round.
 *
 *   enforceScale("12.345", 2) → "12.34"  (truncate)
 *   enforceScale("12.3", 4)   → "12.3000" (pad)
 *   enforceScale("12", 0)     → "12"
 *   enforceScale("12.99", 0)  → "12" (no rounding)
 */
export function enforceScale(
  s: string,
  scale: number | undefined,
  opts?: { roundHalfUp?: boolean },
): string {
  if (typeof s !== "string" || s === "") return s;
  if (scale === undefined || scale < 0) return s;

  const parts = splitDecimalString(s);
  if (scale === 0) {
    if (opts?.roundHalfUp && parts.decimal.length > 0 && parts.decimal[0]! >= "5") {
      const bumped = addOne(parts.integer);
      return joinDecimalString({ sign: parts.sign, integer: bumped, decimal: "" });
    }
    return joinDecimalString({ sign: parts.sign, integer: parts.integer, decimal: "" });
  }
  if (parts.decimal.length === scale) return joinDecimalString(parts);
  if (parts.decimal.length < scale) {
    return joinDecimalString({
      sign: parts.sign,
      integer: parts.integer,
      decimal: parts.decimal.padEnd(scale, "0"),
    });
  }
  // Truncate.
  let head = parts.decimal.slice(0, scale);
  const dropped = parts.decimal.slice(scale);
  let integer = parts.integer;
  if (opts?.roundHalfUp && dropped.length > 0 && dropped[0]! >= "5") {
    const bumpedFrac = addOne(head);
    if (bumpedFrac.length > head.length) {
      // Overflow into the integer half (e.g. "9.99" scale=1 → "10.0").
      integer = addOne(integer);
      head = "0".repeat(scale);
    } else {
      head = bumpedFrac;
    }
  }
  return joinDecimalString({ sign: parts.sign, integer, decimal: head });
}

function addOne(digits: string): string {
  if (digits === "") return "1";
  const out: string[] = digits.split("");
  let i = out.length - 1;
  let carry = 1;
  while (i >= 0 && carry > 0) {
    const d = (out[i]!.charCodeAt(0) - 48 + carry) | 0;
    if (d >= 10) {
      out[i] = "0";
      carry = 1;
    } else {
      out[i] = String.fromCharCode(d + 48);
      carry = 0;
    }
    i -= 1;
  }
  if (carry > 0) out.unshift("1");
  return out.join("");
}

export function splitDecimalString(s: string): DecimalParts {
  if (typeof s !== "string" || s === "") return { sign: "", integer: "0", decimal: "" };
  let sign: "" | "-" = "";
  let body = s;
  if (body.startsWith("-")) {
    sign = "-";
    body = body.slice(1);
  } else if (body.startsWith("+")) {
    body = body.slice(1);
  }
  if (body === "") return { sign: "", integer: "0", decimal: "" };
  const dot = body.indexOf(".");
  let integer: string;
  let decimal: string;
  if (dot === -1) {
    integer = body;
    decimal = "";
  } else {
    integer = body.slice(0, dot);
    decimal = body.slice(dot + 1);
  }
  if (integer === "") integer = "0";
  // Strip leading zeros while keeping at least one digit.
  integer = integer.replace(/^0+(\d)/, "$1");
  if (sign === "-" && integer === "0" && !decimal.replace(/0/g, "")) sign = "";
  return { sign, integer, decimal };
}

export function joinDecimalString(parts: DecimalParts): string {
  const integer = parts.integer === "" ? "0" : parts.integer;
  const decimal = parts.decimal;
  const body = decimal === "" ? integer : `${integer}.${decimal}`;
  return `${parts.sign}${body}`;
}

// ── Display formatter (canonical, used by cell + form) ────────

export function formatDecimalForDisplay(opts: FormatDecimalOptions): string {
  const { value, scale, locale, currency, unit, useGrouping = true } = opts;
  if (value === null || value === undefined || value === "") return "";

  // Always canonicalise to a string. Numbers go through `String()` rather
  // than `toFixed()` because we want the raw representation; scale padding
  // happens via `enforceScale` below.
  let canonical: string;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    canonical = String(value);
  } else {
    canonical = value;
  }

  // Non-decimal input (e.g. legacy DB row carrying "n/a") — pass through
  // verbatim so malformed values stay visible instead of silently blanking.
  if (!/^[+-]?\d*(\.\d*)?$/.test(canonical) || canonical === "." || canonical === "-") {
    return canonical;
  }

  // Pad/truncate to `scale` first so display is deterministic.
  if (scale !== undefined && scale >= 0) {
    canonical = enforceScale(canonical, scale);
  }

  const parts = splitDecimalString(canonical);
  // Re-split into a numeric type Intl can group. We pass the string through
  // `Number()` ONLY for grouping/currency formatting — the canonical string
  // we returned above is the source of truth for scale; Intl just paints.
  const asNumber = Number(canonical);
  const intlSafe = Number.isFinite(asNumber);

  if (currency) {
    try {
      const fmt = getNumberFormat(locale, {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: scale,
        maximumFractionDigits: scale,
        useGrouping,
      });
      if (intlSafe) return fmt.format(asNumber);
    } catch {
      // fall through
    }
    // Fallback when Intl rejects the currency code.
    return `${currency} ${formatPlain(parts, scale, locale, useGrouping)}`;
  }

  const base = formatPlain(parts, scale, locale, useGrouping);
  return unit ? `${base} ${unit}` : base;
}

function formatPlain(
  parts: DecimalParts,
  scale: number | undefined,
  locale: string | undefined,
  useGrouping: boolean,
): string {
  const intStr = useGrouping ? groupInteger(parts.integer, locale) : parts.integer;
  const decStr =
    scale !== undefined && scale >= 0
      ? parts.decimal.padEnd(scale, "0").slice(0, scale)
      : parts.decimal;
  const decSep = getDecimalSeparator(locale);
  const body = decStr.length > 0 ? `${intStr}${decSep}${decStr}` : intStr;
  return `${parts.sign}${body}`;
}

/**
 * Insert the locale's thousands separator into a plain integer string.
 * Pure string-based — no float math, handles arbitrary length.
 */
export function groupInteger(integer: string, locale?: string): string {
  const sep = getThousandsSeparator(locale);
  if (!sep) return integer;
  if (integer.length <= 3) return integer;
  const out: string[] = [];
  let i = integer.length;
  while (i > 3) {
    out.unshift(integer.slice(i - 3, i));
    i -= 3;
  }
  out.unshift(integer.slice(0, i));
  return out.join(sep);
}
