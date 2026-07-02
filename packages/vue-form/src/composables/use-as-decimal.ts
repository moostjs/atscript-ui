import { type ComputedRef, computed, watch } from "vue";
import {
  enforceScale,
  formatDecimalForDisplay,
  getDecimalSeparator,
  getThousandsSeparator,
  groupInteger,
  joinDecimalString,
  parseDecimalInput,
  splitDecimalString,
} from "@atscript/ui";
import { useAsLocale } from "./use-as-locale";
import { preserveShape } from "./_shape";

export interface UseAsDecimalOptions {
  /** Read the current value. Storage shape is preserved on commit. */
  modelValue: () => string | number | null | undefined;
  /**
   * Effective display + edit scale. Composables truncate user-typed values
   * to this so a paste of "10.99" into a JPY field doesn't propagate the
   * lost ".99". Resolution lives at AsField — see TAsComponentProps.scale.
   */
  scale?: () => number | undefined;
  /**
   * Storage cap (DB column scale). Outgoing strings are padded to this
   * regardless of `scale` — display can be tighter than storage. When
   * absent, falls back to `scale`.
   */
  storageScale?: () => number | undefined;
  /** Locale override; defaults to `useAsLocale()` then runtime locale. */
  locale?: () => string | undefined;
  /** Commit handler — receives the new value in the same shape as `modelValue()`. */
  onCommit: (value: string | number | null) => void;
}

export interface UseAsDecimalReturn {
  /** Effective display + edit scale. Defaults to 2 when neither scale nor storageScale provided. */
  scale: ComputedRef<number>;
  /** Storage cap (always populated; falls back to effective scale, then 2). */
  storageScale: ComputedRef<number>;
  decimalSeparator: ComputedRef<string>;
  thousandsSeparator: ComputedRef<string>;

  // Value views — pick one for your render strategy:
  //   • `displayValue` for SINGLE-input renderers (customer swap with one
  //     editable string).
  //   • `parts` for SPLIT renderers like our default two-input SFC.
  //   • `rawValue` is the canonical store shape — used by both for commits.
  /** Single-input renderers: locale-formatted decimal "1,234.50" / "1 234,50". */
  displayValue: ComputedRef<string>;
  /** Canonical decimal "1234.50": no thousands, "." separator, padded to effective scale. */
  rawValue: ComputedRef<string>;
  /** Split renderers: integer is grouped per locale for display. */
  parts: ComputedRef<{ sign: "" | "-"; integer: string; decimal: string }>;

  // Commit paths
  /** Renderer received a complete typed value (single-input swap). */
  setFromInput: (raw: string) => void;
  /** Renderer captured the two halves separately (default two-input SFC). */
  setFromParts: (sign: "" | "-", integer: string, decimal: string) => void;
}

/**
 * Reactive composable for decimal-typed inputs (the `AsDecimal` SFC and
 * customer swaps built against `TAsComponentProps`).
 *
 * Currency-agnostic: the SFC owns prefix/suffix render concerns and
 * resolves the effective scale via the `scale` prop set by AsField. This
 * composable just operates on the model with the scale given to it.
 *
 * Storage shape is preserved on commit — string `modelValue` commits a
 * string padded to `storageScale`; number `modelValue` commits a number.
 * A change to the effective `scale` getter that shrinks it below the
 * model's actual precision triggers a re-round + re-commit (the same
 * "currency-change" behaviour as before).
 */
export function useAsDecimal(opts: UseAsDecimalOptions): UseAsDecimalReturn {
  const localeCtx = useAsLocale();
  const locale = computed<string | undefined>(() => {
    const explicit = opts.locale?.();
    if (explicit) return explicit;
    return localeCtx.locale.value;
  });

  // Effective display + edit scale.
  const scale = computed<number>(() => {
    const s = opts.scale?.();
    if (s !== undefined) return s;
    const storage = opts.storageScale?.();
    if (storage !== undefined) return storage;
    // No metadata → default to 2 (most common money case).
    return 2;
  });

  // Storage cap — what the DB column accepts.
  const storageScale = computed<number>(() => {
    const storage = opts.storageScale?.();
    if (storage !== undefined) return storage;
    const s = opts.scale?.();
    if (s !== undefined) return s;
    return 2;
  });

  const decimalSeparator = computed(() => getDecimalSeparator(locale.value));
  const thousandsSeparator = computed(() => getThousandsSeparator(locale.value));

  // rawValue — canonical "." decimal, truncated to the effective scale.
  // No auto-re-commit during read; initial loads stay as-is in the model,
  // user gets a truncated display while the model is untouched.
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
      // Form inputs always group for readability, even without scale/unit.
      useGrouping: true,
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
      opts.onCommit(null);
      return;
    }
    const parsed = parseDecimalInput(raw, locale.value);
    if (parsed === null) return;
    // Editing-precision: truncate to the effective scale so a paste of
    // "10.99" into a JPY field doesn't propagate the lost ".99".
    const truncated = enforceScale(parsed, scale.value);
    commit(truncated);
  }

  function setFromParts(sign: "" | "-", integer: string, decimal: string): void {
    if (integer === "" && decimal === "") {
      opts.onCommit(null);
      return;
    }
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

  // Scale-shrink re-rounding watcher. Skips initial mount and only fires
  // when the effective scale *shrinks* below the model's actual precision
  // (raising scale never adds digits back). This mirrors the previous
  // useAsAmount currency-change re-round; the trigger is now a scale-prop
  // change driven by AsField's resolution.
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
      const truncated = enforceScale(s, newScale);
      const padded = enforceScale(truncated, storageScale.value);
      const shaped = preserveShape(v, padded);
      opts.onCommit(shaped);
    },
    { flush: "sync" },
  );

  return {
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
