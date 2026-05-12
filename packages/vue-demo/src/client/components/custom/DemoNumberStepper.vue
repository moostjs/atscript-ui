<script setup lang="ts">
import { computed } from "vue";
import { AsFieldShell, type TAsComponentProps } from "@atscript/vue-form";

/**
 * Number stepper — `[ - ][ input ][ + ]` — registered via the
 * `components` map under the name `'stepper'` and opted-in per field
 * with `@ui.form.component 'stepper'`. Used by Section B's
 * `quantity: number`.
 *
 * Clamped to `>= 0` (the schema isn't currently marked `@meta.min 0`;
 * Step 2 clamps unconditionally for simplicity).
 *
 * Wrapped in the library's `<AsFieldShell>` so label, description, and
 * error chrome stay consistent with built-in fields.
 *
 * Skipped `useAsNumber` here — the composable's value pipeline assumes
 * a single text input with locale-aware decimal parsing; the stepper
 * uses an HTML number input plus +/- buttons committing integers, so
 * direct prop binding stays cleaner.
 */
const props = defineProps<TAsComponentProps<number | null | undefined>>();

const current = computed(() => props.model.value ?? 0);

function commit(n: number): void {
  const clamped = Math.max(0, n);
  props.model.value = clamped;
}

function dec(): void {
  commit(current.value - 1);
}

function inc(): void {
  commit(current.value + 1);
}

function onInput(e: Event): void {
  const el = e.target as HTMLInputElement;
  if (el.value === "") {
    props.model.value = null;
    return;
  }
  const n = Number(el.value);
  if (Number.isFinite(n)) commit(n);
}

function onGroupBlur(e: FocusEvent): void {
  const next = e.relatedTarget as Node | null;
  const group = e.currentTarget as HTMLElement;
  if (group && next && group.contains(next)) return;
  props.onBlur();
}
</script>

<template>
  <AsFieldShell v-bind="$props" data-testid="demo-number-stepper">
    <template #default="{ inputId }">
      <div class="demo-stepper" @focusout="onGroupBlur">
        <button
          type="button"
          class="demo-stepper-btn"
          aria-label="Decrement"
          :disabled="disabled || readonly || current <= 0"
          @click="dec"
        >
          −
        </button>
        <input
          :id="inputId"
          type="number"
          class="demo-stepper-input"
          :class="{ error: !!error }"
          :value="model.value ?? ''"
          :placeholder="placeholder"
          :name="name"
          :disabled="disabled"
          :readonly="readonly"
          :aria-required="required || undefined"
          :aria-invalid="!!error || undefined"
          :aria-describedby="ariaDescribedBy"
          :aria-label="!label ? name : undefined"
          min="0"
          @input="onInput"
        />
        <button
          type="button"
          class="demo-stepper-btn"
          aria-label="Increment"
          :disabled="disabled || readonly"
          @click="inc"
        >
          +
        </button>
      </div>
    </template>
  </AsFieldShell>
</template>

<style scoped>
.demo-stepper {
  display: inline-flex;
  align-items: stretch;
  border: 1px solid currentColor;
  border-radius: 4px;
  overflow: hidden;
  width: fit-content;
  opacity: 0.95;
}
.demo-stepper-btn {
  appearance: none;
  background: transparent;
  border: 0;
  padding: 0 12px;
  font: inherit;
  font-size: 16px;
  line-height: 1;
  color: inherit;
  cursor: pointer;
  min-width: 32px;
}
.demo-stepper-btn:hover:not(:disabled) {
  background: currentColor;
  color: transparent;
}
.demo-stepper-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
.demo-stepper-input {
  width: 64px;
  padding: 6px 8px;
  border: 0;
  border-left: 1px solid currentColor;
  border-right: 1px solid currentColor;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: center;
  -moz-appearance: textfield;
}
.demo-stepper-input::-webkit-outer-spin-button,
.demo-stepper-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.demo-stepper-input:focus {
  outline: none;
  background: rgba(127, 127, 127, 0.06);
}
.demo-stepper-input.error {
  background: rgba(239, 68, 68, 0.08);
}
</style>
