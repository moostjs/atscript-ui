import { type ComputedRef, computed, watch } from "vue";
import {
  enforceScale,
  formatDecimalForDisplay,
  getCurrencyDecimals,
  getCurrencyDisplayParts,
  getDecimalSeparator,
  getThousandsSeparator,
  groupInteger,
  joinDecimalString,
  parseDecimalInput,
  splitDecimalString,
} from "@atscript/ui";
import { useAsData } from "./use-as-data";
import { useAsLocale } from "./use-as-locale";

/**
 * Match the input shape on commit: `null`/`undefined` model → write the
 * canonical string (first-ever commit); pre-existing string → string;
 * pre-existing number → number (caller opted into float; the precision loss
 * is on them).
 */
function preserveShape(
  original: string | number | null | undefined,
  normalized: string,
): string | number {
  if (original === null || original === undefined) return normalized;
  if (typeof original === "string") return normalized;
  return Number(normalized);
}

export interface UseAsAmountOptions {
  /** Read the current value. Storage shape is preserved on commit (string in → string out, number in → number out). */
  modelValue: () => string | number | null | undefined;
  /** Static currency code from `@db.amount.currency 'USD'` (props.currencyCode). */
  currencyCode?: () => string | undefined;
  /** Sibling-field path from `@db.amount.currency.ref 'currency'` (props.currencyRefField). */
  currencyRefField?: () => string | undefined;
  /** DB-side precision scale. Effective display scale = min(currencyDecimals, this). */
  precisionScale?: () => number | undefined;
  /** Locale override; defaults to `useAsLocale()` then runtime locale. */
  locale?: () => string | undefined;
  /** Commit handler — receives the new value in the same shape as `modelValue()` returned. */
  onCommit: (value: string | number | null) => void;
}

export interface UseAsAmountReturn {
  // Resolved data
  currency: ComputedRef<string | undefined>;
  currencySymbol: ComputedRef<string | undefined>;
  /** Effective scale for display + editing: min(currencyDecimals, dbPrecisionScale). */
  scale: ComputedRef<number>;
  /** DB scale = storage cap; always populated (falls back to currencyDecimals or 2). */
  storageScale: ComputedRef<number>;
  decimalSeparator: ComputedRef<string>;
  thousandsSeparator: ComputedRef<string>;

  // Value views — pick one for your render strategy:
  //   • `displayValue` for SINGLE-input renderers (customer swaps that show
  //     one editable string).
  //   • `parts` for SPLIT renderers like our default two-input SFC.
  //   • `rawValue` is the canonical store-shape; used by both for commits.
  /** Single-input renderers: locale-formatted decimal "1,234.50" / "1 234,50". */
  displayValue: ComputedRef<string>;
  /** Canonical decimal "1234.50": no thousands, "." separator, padded to effective scale. */
  rawValue: ComputedRef<string>;
  /** Split renderers: integer is grouped per locale for display. */
  parts: ComputedRef<{ sign: "" | "-"; integer: string; decimal: string }>;

  // Commit paths
  /** Renderer received a complete typed value (e.g. single-input swap). */
  setFromInput: (raw: string) => void;
  /** Renderer captured the two halves separately (default two-input SFC uses this). */
  setFromParts: (sign: "" | "-", integer: string, decimal: string) => void;
}

/**
 * Reactive composable that powers the default `AsAmount` SFC and any
 * customer swap built against the same `TAsComponentProps` contract.
 * Render-choice-agnostic: it resolves currency + scale and exposes value
 * ops (`setFromInput`, `setFromParts`). Two-input UX, keyboard bridging,
 * focus state — none of that lives here.
 *
 * Storage shape is preserved on commit — string `modelValue` commits a
 * string padded to `storageScale`; number `modelValue` commits a number.
 * Currency-change re-rounding fires only when the effective scale
 * shrinks below the model's actual precision (raising scale never adds
 * digits back).
 */
export function useAsAmount(opts: UseAsAmountOptions): UseAsAmountReturn {
  const data = useAsData();
  const localeCtx = useAsLocale();

  const locale = computed<string | undefined>(() => {
    const explicit = opts.locale?.();
    if (explicit) return explicit;
    return localeCtx.locale.value;
  });

  const currency = computed<string | undefined>(() => {
    const literal = opts.currencyCode?.();
    if (literal) return literal;
    const ref = opts.currencyRefField?.();
    if (!ref) return undefined;
    const v = data.siblingValue<string>(ref).value;
    return typeof v === "string" && v.length > 0 ? v : undefined;
  });

  const currencySymbol = computed<string | undefined>(() => {
    const code = currency.value;
    if (!code) return undefined;
    return getCurrencyDisplayParts(code, locale.value).symbol;
  });

  // Currency-driven natural decimal count (JPY=0, EUR=2, BHD=3).
  const currencyDecimals = computed<number | undefined>(() => {
    const code = currency.value;
    if (!code) return undefined;
    return getCurrencyDecimals(code, locale.value);
  });

  // Effective scale used for display + editing: tightest of currency & DB.
  // When neither is known, default to 2 (most common money case).
  const scale = computed<number>(() => {
    const cd = currencyDecimals.value;
    const ps = opts.precisionScale?.();
    if (cd === undefined && ps === undefined) return 2;
    if (cd === undefined) return ps as number;
    if (ps === undefined) return cd;
    return Math.min(cd, ps);
  });

  // Storage cap — what the DB column accepts. Always populated.
  const storageScale = computed<number>(() => {
    const ps = opts.precisionScale?.();
    if (ps !== undefined) return ps;
    const cd = currencyDecimals.value;
    if (cd !== undefined) return cd;
    return 2;
  });

  const decimalSeparator = computed(() => getDecimalSeparator(locale.value));
  const thousandsSeparator = computed(() => getThousandsSeparator(locale.value));

  // rawValue — canonical "." decimal, truncated to the effective scale.
  // Note: we do NOT auto-re-commit during read. Initial loads stay as-is in
  // the model; the user gets a truncated display while the model is
  // untouched.
  const rawValue = computed<string>(() => {
    const v = opts.modelValue();
    if (v === null || v === undefined) return "";
    const s = typeof v === "number" ? (Number.isFinite(v) ? String(v) : "") : v;
    if (s === "") return "";
    return enforceScale(s, scale.value);
  });

  const displayValue = computed<string>(() => {
    if (rawValue.value === "") return "";
    return formatDecimalForDisplay({
      value: rawValue.value,
      scale: scale.value,
      locale: locale.value,
    });
  });

  const parts = computed<{ sign: "" | "-"; integer: string; decimal: string }>(() => {
    const raw = rawValue.value;
    if (raw === "") return { sign: "", integer: "", decimal: "" };
    const split = splitDecimalString(raw);
    return {
      sign: split.sign,
      integer: groupInteger(split.integer, locale.value),
      decimal: split.decimal,
    };
  });

  function commit(canonical: string): void {
    const padded = enforceScale(canonical, storageScale.value);
    const shaped = preserveShape(opts.modelValue(), padded);
    opts.onCommit(shaped);
  }

  function setFromInput(raw: string): void {
    if (raw.trim() === "") {
      // Empty input — commit null (clear). Same semantics as Phase 4.
      opts.onCommit(null);
      return;
    }
    const parsed = parseDecimalInput(raw, locale.value);
    if (parsed === null) return; // invalid → leave the model untouched
    // Editing-precision: truncate to the effective scale so a paste of
    // "10.99" into a JPY field doesn't propagate the lost ".99".
    const truncated = enforceScale(parsed, scale.value);
    commit(truncated);
  }

  function setFromParts(sign: "" | "-", integer: string, decimal: string): void {
    // Both halves empty → clear. Otherwise: an empty integer means "0".
    if (integer === "" && decimal === "") {
      opts.onCommit(null);
      return;
    }
    // Strip non-digits defensively — the SFC should already do this, but
    // the composable owns the canonical value path.
    const intDigits = integer.replace(/\D/g, "");
    const decDigits = decimal.replace(/\D/g, "");
    const joined = joinDecimalString({
      sign,
      integer: intDigits === "" ? "0" : intDigits,
      decimal: decDigits,
    });
    const truncated = enforceScale(joined, scale.value);
    commit(truncated);
  }

  // Currency-change re-rounding watcher. Skips initial mount and only fires
  // when the effective scale *shrinks* below the model's actual precision.
  watch(
    scale,
    (newScale, oldScale) => {
      if (oldScale === undefined) return;
      if (newScale >= oldScale) return;
      const v = opts.modelValue();
      if (v === null || v === undefined) return;
      const s = typeof v === "number" ? (Number.isFinite(v) ? String(v) : "") : v;
      if (s === "") return;
      const parts = splitDecimalString(s);
      if (parts.decimal.length <= newScale) return;
      // Re-round and re-commit using storageScale so the wire shape is
      // consistent with how user-driven commits land.
      const truncated = enforceScale(s, newScale);
      const padded = enforceScale(truncated, storageScale.value);
      const shaped = preserveShape(v, padded);
      opts.onCommit(shaped);
    },
    { flush: "sync" },
  );

  return {
    currency,
    currencySymbol,
    scale,
    storageScale,
    decimalSeparator,
    thousandsSeparator,
    displayValue,
    rawValue,
    parts,
    setFromInput,
    setFromParts,
  };
}
