<script setup lang="ts">
import { computed, ref } from "vue";
import type { TAsComponentProps } from "../types";
import AsFieldShell from "./as-field-shell.vue";
import AsInputControl from "../internal/as-input-control.vue";
import { useAsNumber } from "../../composables/use-as-number";

/**
 * Default number renderer — single input with optional leading prefix
 * pill and trailing suffix pill. Shares the merged-chrome family with
 * `AsDecimal`; numbers aren't precision-critical, so there's no integer/
 * decimal split.
 *
 * Picks up `prefix` (resolved at AsField from `@ui.form.prefix` /
 * `.ref` / currency) and `suffix` (`@ui.form.suffix` / `.ref` /
 * `@db.unit*`) as plain string props.
 *
 * **Plain-number fallback** — when neither prefix nor suffix is set
 * (and the dispatcher only landed on this renderer because the field
 * is design-type `number` without adornments), this SFC delegates to
 * `AsInputControl` with the standard input chrome instead of painting
 * the merged-chrome shell. This keeps plain `<input type="number">`
 * rendering visually unchanged from the pre-Phase-6 behaviour.
 */
const props = defineProps<TAsComponentProps>();

const { displayValue, rawValue, setFromInput } = useAsNumber({
  modelValue: () => props.model.value as string | number | null | undefined,
  onCommit: (v) => {
    props.model.value = v;
  },
});

const focusActive = ref(false);

const editValue = computed(() => (focusActive.value ? rawValue.value : displayValue.value));

function onFocus(): void {
  focusActive.value = true;
}

function onBlurField(): void {
  focusActive.value = false;
  props.onBlur();
}

/**
 * Sanitize raw decimal input to keep only chars that could form a valid
 * decimal: optional leading "-", digits, and at most one decimal separator
 * (`.` or `,` — locale handling lives in `parseDecimalInput` downstream).
 * Without this, the composable correctly rejects garbage but the DOM input
 * keeps showing the typed letters until blur.
 */
function sanitizeDecimal(raw: string): string {
  let s = raw;
  let sign = "";
  if (s.startsWith("-")) {
    sign = "-";
    s = s.slice(1);
  }
  s = s.replace(/[^0-9.,]/g, "");
  const firstSep = s.search(/[.,]/);
  if (firstSep !== -1) {
    const head = s.slice(0, firstSep + 1);
    const tail = s.slice(firstSep + 1).replace(/[.,]/g, "");
    s = head + tail;
  }
  return sign + s;
}

function onInput(e: Event): void {
  const el = e.target as HTMLInputElement;
  const cleaned = sanitizeDecimal(el.value);
  if (cleaned !== el.value) el.value = cleaned;
  setFromInput(cleaned);
}

/**
 * Arrow-key step support for the merged-chrome path. The single input
 * inside the `as-number` shell is `type="text"` (so we can paint
 * prefix/suffix pills) — that means the browser doesn't ship the
 * native `<input type="number">` arrow-key behaviour. Re-introduce a
 * minimal +/- 1 step here. Commit goes through `setFromInput` so the
 * composable's null + number-coercion logic is single-sourced.
 */
function onKeyDown(e: KeyboardEvent): void {
  const delta = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
  if (!delta) return;
  e.preventDefault();
  const base = Number(rawValue.value);
  setFromInput(String((Number.isFinite(base) ? base : 0) + delta));
}

const shellTitle = computed(() => props.currencyCode ?? props.unitCode ?? undefined);
</script>

<template>
  <AsFieldShell v-bind="$props">
    <template #default="{ inputId }">
      <!-- Adornment path: bordered shell with prefix / suffix pills. The
           shell paints whenever AsField saw an adornment-driving
           annotation on the field — even when the resolved prefix/suffix
           is currently empty (sibling-ref source not selected yet),
           keeping the layout stable. -->
      <div
        v-if="hasAdornment"
        class="as-number"
        :class="{ error: !!error, required }"
        :title="shellTitle"
      >
        <span v-if="prefix" class="as-prefix" aria-hidden="true">{{ prefix }}</span>
        <input
          :id="inputId"
          class="as-number-input"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          :value="editValue"
          @input="onInput"
          @keydown="onKeyDown"
          @focus="onFocus"
          @blur="onBlurField"
          :placeholder="placeholder"
          :name="name"
          :disabled="disabled"
          :readonly="readonly"
          :aria-required="required || undefined"
          :aria-invalid="!!error || undefined"
          :aria-describedby="ariaDescribedBy"
          :aria-label="!label ? name : undefined"
        />
        <span v-if="suffix" class="as-suffix" aria-hidden="true">{{ suffix }}</span>
      </div>
      <!-- Plain-number fallback: defer to AsInputControl (visually unchanged
           from the pre-Phase-6 single <input type="number"> rendering). -->
      <AsInputControl v-else v-bind="$props" :input-id="inputId" />
    </template>
  </AsFieldShell>
</template>
