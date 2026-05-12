<script setup lang="ts">
import { computed } from "vue";
import { type TAsComponentProps, useAsTuple } from "@atscript/vue-form";
import type { FormTupleFieldDef } from "@atscript/ui";

/**
 * Custom tuple renderer — three R/G/B sliders + a live preview swatch.
 * Opted-in per field via `@ui.form.type 'rgb-picker'`. Used by the
 * custom-components demo's `logoRgb: [number, number, number]`.
 *
 * Uses `useAsTuple` for its `onMounted` `fillMissing` (auto-pads
 * `[0,0,0]` on mount for non-optional tuples) — the per-position
 * itemFields/clear are not consumed because the UI is a single
 * integrated widget rather than three nested AsField shells.
 */
const props = defineProps<TAsComponentProps<[number, number, number] | null | undefined>>();

useAsTuple(props.field as FormTupleFieldDef);

function readChannel(idx: number): number {
  const v = props.model.value;
  if (!Array.isArray(v)) return 0;
  const n = v[idx];
  return typeof n === "number" && Number.isFinite(n) ? clamp(n) : 0;
}

function clamp(n: number): number {
  if (n < 0) return 0;
  if (n > 255) return 255;
  return Math.round(n);
}

function setChannel(idx: number, raw: number): void {
  const next: [number, number, number] = [readChannel(0), readChannel(1), readChannel(2)];
  next[idx] = clamp(raw);
  props.model.value = next;
}

const r = computed(() => readChannel(0));
const g = computed(() => readChannel(1));
const b = computed(() => readChannel(2));

const rgbCss = computed(() => `rgb(${r.value}, ${g.value}, ${b.value})`);
function toHex(n: number): string {
  return n.toString(16).padStart(2, "0");
}
const hex = computed(() => `#${toHex(r.value)}${toHex(g.value)}${toHex(b.value)}`);

const channels = [
  { idx: 0, label: "R", get: r },
  { idx: 1, label: "G", get: g },
  { idx: 2, label: "B", get: b },
];

function onSliderInput(idx: number, e: Event): void {
  const el = e.target as HTMLInputElement;
  const n = Number(el.value);
  if (Number.isFinite(n)) setChannel(idx, n);
}

function onGroupBlur(e: FocusEvent): void {
  const next = e.relatedTarget as Node | null;
  const group = e.currentTarget as HTMLElement;
  if (group && next && group.contains(next)) return;
  props.onBlur();
}
</script>

<template>
  <div class="demo-field" :class="{ hidden }" v-show="!hidden" data-testid="demo-rgb-picker">
    <label v-if="label" :for="inputId" class="demo-field-label">{{ label }}</label>
    <div v-if="description" :id="descId" class="demo-field-description">{{ description }}</div>
    <div
      class="demo-rgb-picker"
      :class="{ error: !!error }"
      :aria-describedby="ariaDescribedBy"
      :aria-invalid="!!error || undefined"
      @focusout="onGroupBlur"
    >
      <div class="demo-rgb-sliders">
        <div v-for="ch in channels" :key="ch.idx" class="demo-rgb-channel">
          <span class="demo-rgb-channel-label">{{ ch.label }}</span>
          <input
            :id="ch.idx === 0 ? inputId : undefined"
            type="range"
            min="0"
            max="255"
            class="demo-rgb-slider"
            :value="ch.get.value"
            :disabled="disabled"
            :readonly="readonly"
            :aria-label="`${ch.label} channel`"
            @input="onSliderInput(ch.idx, $event)"
          />
          <span class="demo-rgb-channel-value">{{ ch.get.value }}</span>
        </div>
      </div>
      <div class="demo-rgb-preview">
        <div class="demo-rgb-swatch" :style="{ backgroundColor: rgbCss }" aria-hidden="true" />
        <code class="demo-rgb-hex">{{ hex }}</code>
      </div>
    </div>
    <div
      v-if="error || hint"
      :id="errorId"
      class="demo-field-error"
      :role="error ? 'alert' : undefined"
    >
      {{ error || hint }}
    </div>
  </div>
</template>

<style scoped>
.demo-rgb-picker {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid currentColor;
  border-radius: 6px;
  opacity: 0.95;
}
.demo-rgb-picker.error {
  border-color: #ef4444;
}
.demo-rgb-sliders {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.demo-rgb-channel {
  display: grid;
  grid-template-columns: 16px 1fr 32px;
  align-items: center;
  gap: 8px;
}
.demo-rgb-channel-label {
  font-weight: 600;
  font-size: 12px;
}
.demo-rgb-channel-value {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  opacity: 0.7;
}
.demo-rgb-slider {
  width: 100%;
  cursor: pointer;
}
.demo-rgb-slider:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.demo-rgb-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 0 0 80px;
}
.demo-rgb-swatch {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  border: 1px solid currentColor;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
.demo-rgb-hex {
  font-size: 11px;
  font-family: ui-monospace, monospace;
  opacity: 0.75;
}
</style>
