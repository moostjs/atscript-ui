import { type ComputedRef, type Ref, computed, nextTick, ref } from "vue";
import { splitDecimalString } from "@atscript/ui";

/**
 * Keyboard plumbing for the bank-UX two-input pattern (integer + decimal
 * halves joined by a separator pill). Extracted from the original
 * AsAmount SFC so AsDecimal and any customer two-input renderer can
 * share the same arrow-bridge / digit-overwrite / paste-split behaviour.
 *
 * This composable is render-agnostic — the SFC owns the layout, the
 * shell chrome and the value model wiring. The composable just exposes
 * the input refs, edit-state, focus handlers and event handlers wired
 * to a `setFromParts` / `setFromInput` callback pair.
 */
export interface UseAsDualInputOptions {
  /** Effective scale (max digits in the decimal half). 0 → no decimal half. */
  scale: () => number;
  /** Locale-aware decimal separator (used for bridge-key detection). */
  decimalSeparator: () => string;
  /** Read the current parts. The composable owns NO model state. */
  parts: () => { sign: "" | "-"; integer: string; decimal: string };
  /** Read the canonical "X.YZ" string — used by paste/bridge to know current state. */
  rawValue: () => string;
  /** Commit a fresh split. Pure callback into the parent's state machine. */
  setFromParts: (sign: "" | "-", integer: string, decimal: string) => void;
  /** Commit a raw typed string (for paste). */
  setFromInput: (raw: string) => void;
  /** Called from `onBlurAll` after focus leaves both inputs. */
  onBlur?: () => void;
}

export interface UseAsDualInputReturn {
  integerInput: Ref<HTMLInputElement | null>;
  decimalInput: Ref<HTMLInputElement | null>;
  /** Display string for the integer half — un-grouped while focused, grouped on blur. */
  integerDisplay: ComputedRef<string>;
  /** Display string for the decimal half — owns the suppression rules. */
  decimalDisplay: ComputedRef<string>;
  /** True while either input has focus. */
  focusActive: Ref<boolean>;
  onIntegerFocus: (e?: FocusEvent) => void;
  onDecimalFocus: (e?: FocusEvent) => void;
  onBlurAll: (e: FocusEvent) => void;
  onIntegerInput: (e: Event) => void;
  onIntegerKeydown: (e: KeyboardEvent) => void;
  onIntegerPaste: (e: ClipboardEvent) => void;
  onDecimalInput: (e: Event) => void;
  onDecimalKeydown: (e: KeyboardEvent) => void;
  onDecimalPaste: (e: ClipboardEvent) => void;
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

export function useAsDualInput(opts: UseAsDualInputOptions): UseAsDualInputReturn {
  const integerInput = ref<HTMLInputElement | null>(null);
  const decimalInput = ref<HTMLInputElement | null>(null);

  const focusActive = ref(false);
  // Tracks whether the user has typed into the decimal half this session.
  // Without this, typing "4" in integer canonicalises to "4.00" and the
  // decimal half would render "00" under fingers that haven't touched it.
  const decimalDirty = ref(false);
  // While decimal is being edited, hold the user's literal input. The
  // composable canonicalises storage; without this buffer, re-renders
  // would fight the cursor with auto-padding.
  const decimalEdit = ref<string | null>(null);

  const integerDisplay = computed(() => {
    const parts = opts.parts();
    if (focusActive.value) {
      const raw = opts.rawValue();
      if (raw === "") return "";
      const p = splitDecimalString(raw);
      return `${p.sign}${p.integer}`;
    }
    return parts.sign + parts.integer;
  });

  const decimalDisplay = computed(() => {
    if (decimalEdit.value !== null) return decimalEdit.value;
    const raw = opts.rawValue();
    if (raw === "") return "";
    const parts = opts.parts();
    const d = parts.decimal;
    if (!/^0*$/.test(d)) return d;
    const isZeroShaped = /^-?0*$/.test(parts.integer);
    if (focusActive.value && !decimalDirty.value) return "";
    if (isZeroShaped && !decimalDirty.value) return "";
    return d;
  });

  function onIntegerFocus(e?: FocusEvent): void {
    focusActive.value = true;
    decimalEdit.value = null;
    selectAllIfZeroShaped(e?.target);
  }

  function onDecimalFocus(e?: FocusEvent): void {
    focusActive.value = true;
    const parts = opts.parts();
    const d = parts.decimal;
    const i = parts.integer;
    const isZeroShaped = i === "" || /^-?0*$/.test(i);
    if (/^0*$/.test(d) && (isZeroShaped || !decimalDirty.value)) {
      decimalEdit.value = "";
    } else {
      decimalEdit.value = d;
    }
    selectAllIfZeroShaped(e?.target);
  }

  /**
   * UX polish: when an input shows only zeros at focus time (e.g. the
   * canonical "0" / "-0" of a freshly-initialised optional decimal, or
   * "00" left over in the decimal half), select the contents so the
   * first keystroke replaces them. Without this, typing `5` into "0"
   * produces "05" — confusing for a value already in canonical zero
   * form. Defer to the next frame so Vue's reactive re-render of the
   * `:value` binding has a chance to settle before we read the value.
   */
  function selectAllIfZeroShaped(target: EventTarget | null | undefined): void {
    const el = target as HTMLInputElement | null;
    if (!el || typeof el.select !== "function") return;
    if (!/^-?0+$/.test(el.value)) return;
    requestAnimationFrame(() => {
      if (document.activeElement === el && /^-?0+$/.test(el.value)) el.select();
    });
  }

  function onBlurAll(e: FocusEvent): void {
    const next = e.relatedTarget as HTMLElement | null;
    if (next === integerInput.value || next === decimalInput.value) return;
    focusActive.value = false;
    decimalDirty.value = false;
    decimalEdit.value = null;
    opts.onBlur?.();
  }

  function commitIntegerHalf(rawInteger: string): void {
    let sign: "" | "-" = "";
    let body = rawInteger;
    if (body.startsWith("-")) {
      sign = "-";
      body = body.slice(1);
    }
    const intDigits = digitsOnly(body);
    const curDec = opts.parts().decimal;
    opts.setFromParts(sign, intDigits, curDec);
  }

  function commitDecimalHalf(rawDecimal: string): void {
    const decDigits = digitsOnly(rawDecimal).slice(0, opts.scale());
    const p = splitDecimalString(opts.rawValue());
    opts.setFromParts(p.sign, p.integer, decDigits);
  }

  async function focusDecimal(at?: number): Promise<void> {
    await nextTick();
    const el = decimalInput.value;
    if (!el) return;
    el.focus();
    if (typeof at === "number") {
      const pos = Math.max(0, Math.min(at, el.value.length));
      try {
        el.setSelectionRange(pos, pos);
      } catch {
        /* swallow */
      }
    } else {
      try {
        el.select();
      } catch {
        /* swallow */
      }
    }
  }

  async function focusInteger(atEnd: boolean): Promise<void> {
    await nextTick();
    const el = integerInput.value;
    if (!el) return;
    el.focus();
    if (atEnd) {
      const pos = el.value.length;
      try {
        el.setSelectionRange(pos, pos);
      } catch {
        /* swallow */
      }
    }
  }

  function onIntegerKeydown(e: KeyboardEvent): void {
    const el = e.target as HTMLInputElement;
    const sc = opts.scale();
    if (e.key === "ArrowRight" && el.selectionStart === el.value.length && sc > 0) {
      e.preventDefault();
      void focusDecimal(0);
      return;
    }
    if ((e.key === "." || e.key === ",") && sc > 0) {
      e.preventDefault();
      void focusDecimal();
      return;
    }
    if (e.key === "-") {
      e.preventDefault();
      const p = splitDecimalString(opts.rawValue());
      const newSign: "" | "-" = p.sign === "-" ? "" : "-";
      opts.setFromParts(newSign, p.integer, p.decimal);
      return;
    }
  }

  function onDecimalKeydown(e: KeyboardEvent): void {
    const el = e.target as HTMLInputElement;
    if (e.key === "ArrowLeft" && el.selectionStart === 0) {
      e.preventDefault();
      void focusInteger(true);
      return;
    }
    if (e.key === "Backspace" && el.selectionStart === 0 && el.selectionEnd === 0) {
      e.preventDefault();
      void focusInteger(true);
      return;
    }
    if (/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const current = el.value;
      const cap = opts.scale();
      if (start === end && start >= cap) return;
      let next: string;
      let newCursor: number;
      if (start !== end) {
        next = current.slice(0, start) + e.key + current.slice(end);
        newCursor = start + 1;
      } else if (start < current.length) {
        next = current.slice(0, start) + e.key + current.slice(start + 1);
        newCursor = start + 1;
      } else {
        next = current + e.key;
        newCursor = next.length;
      }
      if (next.length > cap) next = next.slice(0, cap);
      decimalDirty.value = true;
      decimalEdit.value = next;
      commitDecimalHalf(next);
      void nextTick().then(() => {
        try {
          el.setSelectionRange(newCursor, newCursor);
        } catch {
          /* swallow */
        }
      });
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      return;
    }
  }

  function onIntegerInput(e: Event): void {
    const el = e.target as HTMLInputElement;
    let raw = el.value;
    let sign = "";
    if (raw.startsWith("-")) {
      sign = "-";
      raw = raw.slice(1);
    }
    const cleaned = `${sign}${digitsOnly(raw)}`;
    if (cleaned !== el.value) el.value = cleaned;
    commitIntegerHalf(cleaned);
  }

  function onDecimalInput(e: Event): void {
    const el = e.target as HTMLInputElement;
    decimalDirty.value = true;
    const cleaned = digitsOnly(el.value).slice(0, opts.scale());
    if (cleaned !== el.value) el.value = cleaned;
    decimalEdit.value = cleaned;
    commitDecimalHalf(cleaned);
  }

  function onIntegerPaste(e: ClipboardEvent): void {
    const text = e.clipboardData?.getData("text") ?? "";
    if (!text) return;
    const sep = opts.decimalSeparator();
    if (
      text.includes(sep) ||
      (sep !== "." && text.includes(".")) ||
      (sep !== "," && text.includes(","))
    ) {
      e.preventDefault();
      opts.setFromInput(text);
      void focusDecimal(opts.scale());
      return;
    }
    // No separator — let the browser paste; `onIntegerInput` sanitises.
  }

  function onDecimalPaste(e: ClipboardEvent): void {
    const text = e.clipboardData?.getData("text") ?? "";
    if (!text) return;
    e.preventDefault();
    decimalDirty.value = true;
    const cleaned = digitsOnly(text).slice(0, opts.scale());
    const el = e.target as HTMLInputElement;
    el.value = cleaned;
    decimalEdit.value = cleaned;
    commitDecimalHalf(cleaned);
  }

  return {
    integerInput,
    decimalInput,
    integerDisplay,
    decimalDisplay,
    focusActive,
    onIntegerFocus,
    onDecimalFocus,
    onBlurAll,
    onIntegerInput,
    onIntegerKeydown,
    onIntegerPaste,
    onDecimalInput,
    onDecimalKeydown,
    onDecimalPaste,
  };
}
