import { type ComputedRef, computed } from "vue";
import { getDecimalSeparator, parseDecimalInput } from "@atscript/ui";
import { useAsLocale } from "./use-as-locale";
import { preserveShape } from "./_shape";

export interface UseAsNumberOptions {
  /** Read the current value. Storage shape is preserved on commit. */
  modelValue: () => string | number | null | undefined;
  /** Locale override; defaults to `useAsLocale()` then runtime locale. */
  locale?: () => string | undefined;
  /** Commit handler — receives the new value in the same shape as `modelValue()` returned. */
  onCommit: (value: string | number | null) => void;
}

export interface UseAsNumberReturn {
  decimalSeparator: ComputedRef<string>;
  /**
   * Single-input renderers: raw model value with the locale decimal
   * separator swap. No Intl grouping, no padding, no truncation — numbers
   * aren't precision-critical the way decimals are.
   */
  displayValue: ComputedRef<string>;
  /** Canonical decimal ("." separator). Verbatim from the model — no scale enforcement. */
  rawValue: ComputedRef<string>;
  /** Renderer received a complete typed value. */
  setFromInput: (raw: string) => void;
}

/**
 * Reactive composable that powers the default `AsNumber` SFC. Single-
 * input shape — currency-agnostic, scale-agnostic, just a plain number
 * with optional prefix/suffix chrome owned by the SFC.
 *
 * Storage shape is preserved on commit — string `modelValue` commits a
 * string; number `modelValue` commits a number. The SFC owns prefix/
 * suffix render concerns; this composable only knows about the value.
 */
export function useAsNumber(opts: UseAsNumberOptions): UseAsNumberReturn {
  const localeCtx = useAsLocale();
  const locale = computed<string | undefined>(() => {
    const explicit = opts.locale?.();
    if (explicit) return explicit;
    return localeCtx.locale.value;
  });

  const decimalSeparator = computed(() => getDecimalSeparator(locale.value));

  const rawValue = computed<string>(() => {
    const v = opts.modelValue();
    if (v === null || v === undefined) return "";
    return typeof v === "number" ? (Number.isFinite(v) ? String(v) : "") : v;
  });

  const displayValue = computed<string>(() => {
    const s = rawValue.value;
    if (s === "") return "";
    const sep = decimalSeparator.value;
    return sep === "." ? s : s.replace(".", sep);
  });

  function setFromInput(raw: string): void {
    if (raw.trim() === "") {
      opts.onCommit(null);
      return;
    }
    const parsed = parseDecimalInput(raw, locale.value);
    if (parsed === null) return;
    opts.onCommit(preserveShape(opts.modelValue(), parsed));
  }

  return {
    decimalSeparator,
    displayValue,
    rawValue,
    setFromInput,
  };
}
