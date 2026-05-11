import { type ComputedRef, computed } from "vue";
import {
  enforceScale,
  formatDecimalForDisplay,
  getDecimalSeparator,
  parseDecimalInput,
} from "@atscript/ui";
import { useAsData } from "./use-as-data";
import { useAsLocale } from "./use-as-locale";

function preserveShape(
  original: string | number | null | undefined,
  normalized: string,
): string | number {
  if (original === null || original === undefined) return normalized;
  if (typeof original === "string") return normalized;
  return Number(normalized);
}

export interface UseAsMeasureOptions {
  /** Read the current value. Storage shape is preserved on commit. */
  modelValue: () => string | number | null | undefined;
  /** Static unit code from `@db.unit 'kg'` (props.unitCode). */
  unitCode?: () => string | undefined;
  /** Sibling-field path from `@db.unit.ref 'unit'` (props.unitRefField). */
  unitRefField?: () => string | undefined;
  /** Number of fraction digits (`@db.column.precision _, scale`). */
  precisionScale?: () => number | undefined;
  /** Locale override; defaults to `useAsLocale()` then runtime locale. */
  locale?: () => string | undefined;
  /** Commit handler — receives the new value in the same shape as `modelValue()` returned. */
  onCommit: (value: string | number | null) => void;
}

export interface UseAsMeasureReturn {
  /** Resolved unit code: static `unitCode` wins, falls back to sibling-field reactive read. */
  unit: ComputedRef<string | undefined>;
  /** Display scale (== precisionScale; `undefined` means no padding/truncation). */
  scale: ComputedRef<number | undefined>;
  decimalSeparator: ComputedRef<string>;
  /**
   * Single-input renderers: locale-formatted decimal for display
   * (no unit — that's the SFC's responsibility).
   */
  displayValue: ComputedRef<string>;
  /** Canonical decimal ("." separator), truncated to scale when known. */
  rawValue: ComputedRef<string>;
  /** Renderer received a complete typed value. */
  setFromInput: (raw: string) => void;
}

/**
 * Reactive composable that powers the default `AsMeasure` SFC. Single-
 * input shape (units aren't precision-critical the way money is), but
 * the storage-string semantics are the same as `useAsAmount`.
 */
export function useAsMeasure(opts: UseAsMeasureOptions): UseAsMeasureReturn {
  const data = useAsData();
  const localeCtx = useAsLocale();

  const locale = computed<string | undefined>(() => {
    const explicit = opts.locale?.();
    if (explicit) return explicit;
    return localeCtx.locale.value;
  });

  const unit = computed<string | undefined>(() => {
    const literal = opts.unitCode?.();
    if (literal) return literal;
    const ref = opts.unitRefField?.();
    if (!ref) return undefined;
    const v = data.siblingValue<string>(ref).value;
    return typeof v === "string" && v.length > 0 ? v : undefined;
  });

  const scale = computed<number | undefined>(() => opts.precisionScale?.());

  const decimalSeparator = computed(() => getDecimalSeparator(locale.value));

  const rawValue = computed<string>(() => {
    const v = opts.modelValue();
    if (v === null || v === undefined) return "";
    const s = typeof v === "number" ? (Number.isFinite(v) ? String(v) : "") : v;
    if (s === "") return "";
    return scale.value !== undefined ? enforceScale(s, scale.value) : s;
  });

  const displayValue = computed<string>(() => {
    if (rawValue.value === "") return "";
    return formatDecimalForDisplay({
      value: rawValue.value,
      scale: scale.value,
      locale: locale.value,
    });
  });

  function setFromInput(raw: string): void {
    if (raw.trim() === "") {
      opts.onCommit(null);
      return;
    }
    const parsed = parseDecimalInput(raw, locale.value);
    if (parsed === null) return;
    const truncated = scale.value !== undefined ? enforceScale(parsed, scale.value) : parsed;
    const shaped = preserveShape(opts.modelValue(), truncated);
    opts.onCommit(shaped);
  }

  return {
    unit,
    scale,
    decimalSeparator,
    displayValue,
    rawValue,
    setFromInput,
  };
}
