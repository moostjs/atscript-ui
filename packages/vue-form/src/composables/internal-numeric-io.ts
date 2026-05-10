import { computed, type ComputedRef } from "vue";

/**
 * Shared numeric I/O for `useAsAmount` / `useAsMeasure`. Internal —
 * the public composables differ in the adornment they resolve
 * (currency symbol vs unit code), but their `step` / `displayValue` /
 * `setFromInput` behaviour is identical.
 */
export interface NumericIOOptions {
  modelValue: () => number | null | undefined;
  precisionScale?: () => number | undefined;
  onCommit: (value: number | null) => void;
}

export interface NumericIO {
  step: ComputedRef<string | undefined>;
  displayValue: ComputedRef<string>;
  setFromInput: (raw: string) => void;
}

export function useNumericIO(opts: NumericIOOptions): NumericIO {
  const step = computed<string | undefined>(() => {
    const scale = opts.precisionScale?.();
    if (scale === undefined || scale < 0) return undefined;
    if (scale === 0) return "1";
    // Build "0.001…1" without floating-point drift (e.g. scale=2 → "0.01").
    return `0.${"0".repeat(scale - 1)}1`;
  });

  const displayValue = computed<string>(() => {
    const v = opts.modelValue();
    if (v === null || v === undefined) return "";
    if (typeof v === "number" && !Number.isFinite(v)) return "";
    return String(v);
  });

  function setFromInput(raw: string): void {
    const trimmed = raw.trim();
    if (trimmed === "") {
      opts.onCommit(null);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      // Invalid input → leave model untouched. The error layer (validation
      // / external errors) is what surfaces feedback; we don't fight the
      // user mid-keystroke.
      return;
    }
    const scale = opts.precisionScale?.();
    if (scale !== undefined && scale >= 0) {
      // Round to declared scale so per-keystroke commits don't accumulate
      // FP noise (e.g. typing 0.1 + 0.2 in derived totals).
      const factor = 10 ** scale;
      opts.onCommit(Math.round(n * factor) / factor);
      return;
    }
    opts.onCommit(n);
  }

  return { step, displayValue, setFromInput };
}
