<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { splitDecimalString } from "@atscript/ui";
import type { TAsComponentProps } from "../types";
import AsFieldShell from "../internal/as-field-shell.vue";
import { useAsAmount } from "../../composables/use-as-amount";

/**
 * Default amount renderer — the "bank UX": one bordered shell containing
 * a currency symbol, an integer input, a decimal separator and a decimal
 * input. Keyboard arrows bridge between the two halves so typing a long
 * amount feels like a single field. All value math goes through
 * `useAsAmount`; the SFC owns only render choices and keyboard glue.
 *
 * Render-choice-agnostic guarantee: customer swaps that prefer a single
 * input (or a custom layout) consume `useAsAmount` directly — see
 * `__tests__/use-as-amount-contract.spec.ts`.
 */
const props = defineProps<TAsComponentProps<string | number | null | undefined>>();

const {
  currency,
  currencySymbol,
  scale,
  decimalSeparator,
  rawValue,
  parts,
  setFromInput,
  setFromParts,
} = useAsAmount({
  modelValue: () => props.model.value,
  currencyCode: () => props.currencyCode,
  currencyRefField: () => props.currencyRefField,
  precisionScale: () => props.precisionScale,
  onCommit: (v) => {
    props.model.value = v;
  },
});

// Local refs reflect what the user is typing in each half. We do NOT bind
// directly to `parts` — the user might be mid-edit ("12" → backspace → "1")
// and committing each keystroke through `setFromParts` would re-canonicalise
// the input under their cursor.
const integerInput = ref<HTMLInputElement | null>(null);
const decimalInput = ref<HTMLInputElement | null>(null);
const focusActive = ref(false);
// Tracks whether the user has actually typed into the decimal half during
// the current edit session. Typing "4" in integer canonicalises to "4.00";
// without this flag the decimal half would paint "00" before the user has
// touched it (jarring). Reset on full-component blur so the next edit
// session starts clean.
const decimalDirty = ref(false);

// On blur of the whole component, snap back to formatted display. While
// either input has focus we render the un-grouped integer (easier to edit).
const integerDisplay = computed(() => {
  if (focusActive.value) {
    // Edit mode — show un-grouped digits with the sign char baked in.
    const p = splitDecimalString(rawValue.value);
    if (rawValue.value === "") return "";
    return `${p.sign}${p.integer}`;
  }
  // Blur mode — show grouped integer half of the formatted output.
  return parts.value.sign + parts.value.integer;
});

const decimalDisplay = computed(() => {
  const d = parts.value.decimal;
  // While editing, hide pure-zero padding that `enforceScale` injects so the
  // user doesn't see "00" appear under their fingers after typing the first
  // integer digit. Real decimal digits (any non-zero or user-typed "0") show
  // through. Once blurred, the canonical (padded) decimal renders.
  if (focusActive.value && !decimalDirty.value && /^0*$/.test(d)) return "";
  return d;
});

function onFocus(): void {
  focusActive.value = true;
}

function onBlurAll(e: FocusEvent): void {
  // Only flip back to display mode when focus leaves BOTH inputs.
  const next = e.relatedTarget as HTMLElement | null;
  if (next === integerInput.value || next === decimalInput.value) return;
  focusActive.value = false;
  decimalDirty.value = false;
  props.onBlur();
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function commitIntegerHalf(rawInteger: string): void {
  // Sign chars are extracted from the raw — handle "-" at start.
  let sign: "" | "-" = "";
  let body = rawInteger;
  if (body.startsWith("-")) {
    sign = "-";
    body = body.slice(1);
  }
  const intDigits = digitsOnly(body);
  // Hold onto current decimal half — composable commits "integer.decimal".
  const curDec = parts.value.decimal;
  setFromParts(sign, intDigits, curDec);
}

function commitDecimalHalf(rawDecimal: string): void {
  const decDigits = digitsOnly(rawDecimal).slice(0, scale.value);
  const p = splitDecimalString(rawValue.value);
  setFromParts(p.sign, p.integer, decDigits);
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
      /* some browsers reject setSelectionRange on input types they implement specially */
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
  // Right arrow at end → bridge to decimal half.
  if (e.key === "ArrowRight" && el.selectionStart === el.value.length && scale.value > 0) {
    e.preventDefault();
    void focusDecimal(0);
    return;
  }
  // Locale decimal separator key → bridge with select-all so typing replaces.
  if (e.key === decimalSeparator.value && scale.value > 0) {
    e.preventDefault();
    void focusDecimal();
    return;
  }
  // Sign toggle on "-": only at start, and only if not already negative.
  if (e.key === "-") {
    e.preventDefault();
    const p = splitDecimalString(rawValue.value);
    const newSign: "" | "-" = p.sign === "-" ? "" : "-";
    setFromParts(newSign, p.integer, p.decimal);
    return;
  }
}

function onDecimalKeydown(e: KeyboardEvent): void {
  const el = e.target as HTMLInputElement;
  // Left arrow at start → bridge to integer.
  if (e.key === "ArrowLeft" && el.selectionStart === 0) {
    e.preventDefault();
    void focusInteger(true);
    return;
  }
  // Backspace at start with no selection → bridge to integer END (do NOT
  // delete a character).
  if (e.key === "Backspace" && el.selectionStart === 0 && el.selectionEnd === 0) {
    e.preventDefault();
    void focusInteger(true);
    return;
  }
}

function onIntegerInput(e: Event): void {
  const el = e.target as HTMLInputElement;
  // Block non-digit chars by re-canonicalising the input.
  let raw = el.value;
  // Preserve leading "-" if it was already present.
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
  // Truncate to scale digits as the user types.
  const cleaned = digitsOnly(el.value).slice(0, scale.value);
  if (cleaned !== el.value) el.value = cleaned;
  commitDecimalHalf(cleaned);
}

function onIntegerPaste(e: ClipboardEvent): void {
  const text = e.clipboardData?.getData("text") ?? "";
  if (!text) return;
  // Heuristic: if the pasted text contains a decimal separator, smart-split
  // and commit through `setFromInput` (which handles thousands + sign).
  if (
    text.includes(decimalSeparator.value) ||
    (decimalSeparator.value !== "." && text.includes(".")) ||
    (decimalSeparator.value !== "," && text.includes(","))
  ) {
    e.preventDefault();
    setFromInput(text);
    // After commit, focus the decimal half at end for further edits.
    void focusDecimal(scale.value);
    return;
  }
  // No separator — let the browser paste; `onIntegerInput` will sanitise.
}

function onDecimalPaste(e: ClipboardEvent): void {
  const text = e.clipboardData?.getData("text") ?? "";
  if (!text) return;
  e.preventDefault();
  decimalDirty.value = true;
  const cleaned = digitsOnly(text).slice(0, scale.value);
  const el = e.target as HTMLInputElement;
  el.value = cleaned;
  commitDecimalHalf(cleaned);
}

const isNegative = computed(() => parts.value.sign === "-");
</script>

<template>
  <AsFieldShell v-bind="$props">
    <template #default="{ inputId }">
      <div
        class="as-amount"
        :class="{ 'as-amount-negative': isNegative, error: !!error, required }"
        :title="currency"
      >
        <span v-if="currencySymbol" class="as-amount-symbol" aria-hidden="true">
          {{ currencySymbol }}
        </span>
        <input
          :id="inputId"
          ref="integerInput"
          class="as-amount-integer"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          :value="integerDisplay"
          @input="onIntegerInput"
          @keydown="onIntegerKeydown"
          @paste="onIntegerPaste"
          @focus="onFocus"
          @blur="onBlurAll"
          :placeholder="placeholder"
          :name="name"
          :disabled="disabled"
          :readonly="readonly"
          :aria-required="required || undefined"
          :aria-invalid="!!error || undefined"
          :aria-describedby="ariaDescribedBy"
          :aria-label="!label ? name : undefined"
        />
        <template v-if="scale > 0">
          <span class="as-amount-sep" aria-hidden="true">{{ decimalSeparator }}</span>
          <input
            ref="decimalInput"
            class="as-amount-decimal"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            :value="decimalDisplay"
            :maxlength="scale"
            :size="scale"
            @input="onDecimalInput"
            @keydown="onDecimalKeydown"
            @paste="onDecimalPaste"
            @focus="onFocus"
            @blur="onBlurAll"
            :disabled="disabled"
            :readonly="readonly"
            :aria-label="`decimals of ${label ?? name ?? ''}`"
          />
        </template>
      </div>
    </template>
  </AsFieldShell>
</template>
