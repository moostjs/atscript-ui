import { computed, type ComputedRef } from "vue";
import { useAsData } from "./use-as-data";
import { useNumericIO } from "./internal-numeric-io";

export interface UseAsMeasureOptions {
  /** Read the current numeric value. Returns `null` / `undefined` for empty. */
  modelValue: () => number | null | undefined;
  /** Static unit code from `@db.unit 'kg'` (props.unitCode). */
  unitCode?: () => string | undefined;
  /** Sibling-field path from `@db.unit.ref 'unit'` (props.unitRefField). */
  unitRefField?: () => string | undefined;
  /** Number of fraction digits (`@db.column.precision _, scale`). */
  precisionScale?: () => number | undefined;
  /** Commit a parsed numeric value (or `null` to clear). */
  onCommit: (value: number | null) => void;
}

export interface UseAsMeasureReturn {
  /** Resolved unit code: static `unitCode` wins, falls back to sibling-field reactive read. */
  unit: ComputedRef<string | undefined>;
  /** HTML input `step` attribute derived from `precisionScale` (e.g. scale=2 → "0.01"). */
  step: ComputedRef<string | undefined>;
  /** Bind to `<input :value>`. Empty string when model is null/undefined. */
  displayValue: ComputedRef<string>;
  /** Bind to `@input` / `@change`. Parses, validates against `precisionScale`, calls `onCommit`. */
  setFromInput: (raw: string) => void;
}

/**
 * Composable backing the default `AsMeasure` input. Resolves the unit
 * code (static or sibling-ref) and converts between the numeric model
 * value and the `<input>` string display. Symmetric with `useAsAmount`,
 * minus the currency symbol derivation — units render as plain text.
 */
export function useAsMeasure(opts: UseAsMeasureOptions): UseAsMeasureReturn {
  const data = useAsData();

  const unit = computed<string | undefined>(() => {
    const literal = opts.unitCode?.();
    if (literal) return literal;
    const ref = opts.unitRefField?.();
    if (!ref) return undefined;
    const v = data.siblingValue<string>(ref).value;
    return typeof v === "string" && v.length > 0 ? v : undefined;
  });

  const { step, displayValue, setFromInput } = useNumericIO({
    modelValue: opts.modelValue,
    precisionScale: opts.precisionScale,
    onCommit: opts.onCommit,
  });

  return { unit, step, displayValue, setFromInput };
}
