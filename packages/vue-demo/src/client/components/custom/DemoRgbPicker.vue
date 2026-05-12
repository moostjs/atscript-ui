<script setup lang="ts">
import { computed } from "vue";
import { AsFieldShell, type TAsComponentProps, useAsTuple } from "@atscript/vue-form";
import type { FormTupleFieldDef } from "@atscript/ui";

/**
 * Custom tuple renderer — three R/G/B sliders + a live preview swatch.
 * Opted-in per field via `@ui.form.type 'rgb-picker'`. Used by the
 * custom-components demo's `logoRgb: [number, number, number]`.
 *
 * Wrapped in the library's `<AsFieldShell>` so label, description, and
 * error chrome stay consistent with built-in fields.
 *
 * Uses `useAsTuple` for its `onMounted` `fillMissing` (auto-pads
 * `[0,0,0]` on mount for non-optional tuples) — the per-position
 * itemFields/clear are not consumed because the UI is a single
 * integrated widget rather than three nested AsField shells.
 *
 * Styling: outer wrapper sits on `layer-1` (matches the address card).
 * Preview swatch's background is the only inline `:style` — the
 * rgb(...) IS the value. Hex readout uses `text-callout` + mono font.
 * `<input type="range">` is left mostly native because consistent
 * cross-browser styling of range thumbs requires a fair amount of CSS
 * that doesn't fit any current vunor primitive — see final report.
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
  <AsFieldShell v-bind="$props" data-testid="demo-rgb-picker">
    <template #default="{ inputId }">
      <div
        class="layer-1 border-1 rounded-r2 p-$m flex items-center gap-$m"
        :class="{ 'scope-error current-border-hl border-current': !!error }"
        :aria-describedby="ariaDescribedBy"
        :aria-invalid="!!error || undefined"
        @focusout="onGroupBlur"
      >
        <div class="flex-1 flex flex-col gap-$xs">
          <div
            v-for="ch in channels"
            :key="ch.idx"
            class="grid grid-cols-[1.25em_1fr_2.25em] items-center gap-$s"
          >
            <span class="text-callout font-600">{{ ch.label }}</span>
            <input
              :id="ch.idx === 0 ? inputId : undefined"
              type="range"
              min="0"
              max="255"
              class="w-full cursor-pointer disabled-soft disabled:cursor-not-allowed"
              :value="ch.get.value"
              :disabled="disabled"
              :readonly="readonly"
              :aria-label="`${ch.label} channel`"
              @input="onSliderInput(ch.idx, $event)"
            />
            <span
              class="text-right text-callout text-current-muted [font-variant-numeric:tabular-nums]"
            >
              {{ ch.get.value }}
            </span>
          </div>
        </div>
        <div class="flex flex-col items-center gap-$xs flex-none w-[5em]">
          <div
            class="demo-rgb-swatch size-[4em] rounded-r2 border-1 border-current/20 shadow-popup"
            :style="{ backgroundColor: rgbCss }"
            aria-hidden="true"
          />
          <code class="text-callout text-current-muted font-mono">{{ hex }}</code>
        </div>
      </div>
    </template>
  </AsFieldShell>
</template>
