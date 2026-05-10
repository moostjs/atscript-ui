import { computed, type ComputedRef } from "vue";
import { useAsData } from "./use-as-data";
import { useNumericIO } from "./internal-numeric-io";

export interface UseAsAmountOptions {
  /** Read the current numeric value. Returns `null` / `undefined` for empty. */
  modelValue: () => number | null | undefined;
  /** Static currency code from `@db.amount.currency 'USD'` (props.currencyCode). */
  currencyCode?: () => string | undefined;
  /** Sibling-field path from `@db.amount.currency.ref 'currency'` (props.currencyRefField). */
  currencyRefField?: () => string | undefined;
  /** Number of fraction digits (`@db.column.precision _, scale`). */
  precisionScale?: () => number | undefined;
  /** Commit a parsed numeric value (or `null` to clear). */
  onCommit: (value: number | null) => void;
}

export interface UseAsAmountReturn {
  /** Resolved currency code: static `currencyCode` wins, falls back to sibling-field reactive read. */
  currency: ComputedRef<string | undefined>;
  /** Convenient currency symbol for prefix display. Derives from `currency` via `Intl.NumberFormat.formatToParts`. */
  currencySymbol: ComputedRef<string | undefined>;
  /** HTML input `step` attribute derived from `precisionScale` (e.g. scale=2 → "0.01"). */
  step: ComputedRef<string | undefined>;
  /** Bind to `<input :value>`. Empty string when model is null/undefined. */
  displayValue: ComputedRef<string>;
  /** Bind to `@input` / `@change`. Parses, validates against `precisionScale`, calls `onCommit`. */
  setFromInput: (raw: string) => void;
}

/**
 * Cache the locale-resolved currency glyph per code. The runtime locale
 * is intentionally inherited (`Intl.NumberFormat(undefined, ...)`) — a
 * USD value renders as "$" in en-US and "US$" in fr-FR, which is the
 * desired locale-aware behaviour. The cache survives only as long as
 * the runtime locale; if a host app switches locale it must reload.
 */
const symbolCache = new Map<string, string>();

function resolveCurrencySymbol(code: string): string {
  const cached = symbolCache.get(code);
  if (cached !== undefined) return cached;
  let symbol: string;
  try {
    // `formatToParts` reliably extracts the currency glyph regardless of
    // locale-specific spacing rules. Fall back to the code itself if Intl
    // rejects an unknown / typo currency.
    const parts = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);
    const part = parts.find((p) => p.type === "currency");
    symbol = part?.value ?? code;
  } catch {
    symbol = code;
  }
  symbolCache.set(code, symbol);
  return symbol;
}

/**
 * Composable backing the default `AsAmount` input. Resolves currency
 * (static or sibling-ref), derives a localized currency symbol for the
 * adornment, and converts between the underlying numeric model value and
 * the `<input>` string display.
 *
 * Customer swap: build your own `<MyMoneyField>` against the same
 * `TAsComponentProps` contract and reuse this composable verbatim — no
 * SFC-shaped wrapper required.
 */
export function useAsAmount(opts: UseAsAmountOptions): UseAsAmountReturn {
  const data = useAsData();

  const currency = computed<string | undefined>(() => {
    const literal = opts.currencyCode?.();
    if (literal) return literal;
    const ref = opts.currencyRefField?.();
    if (!ref) return undefined;
    // Reactive read of the sibling currency field. `useAsData().siblingValue`
    // walks the active path-prefix so this works inside nested objects /
    // array items without the caller knowing the absolute path.
    const v = data.siblingValue<string>(ref).value;
    return typeof v === "string" && v.length > 0 ? v : undefined;
  });

  const currencySymbol = computed<string | undefined>(() => {
    const code = currency.value;
    if (!code) return undefined;
    return resolveCurrencySymbol(code);
  });

  const { step, displayValue, setFromInput } = useNumericIO({
    modelValue: opts.modelValue,
    precisionScale: opts.precisionScale,
    onCommit: opts.onCommit,
  });

  return { currency, currencySymbol, step, displayValue, setFromInput };
}
