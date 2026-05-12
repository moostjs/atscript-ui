<script setup lang="ts">
import { ref } from "vue";
import { AsFieldShell, type TAsComponentProps } from "@atscript/vue-form";

/**
 * Palette picker — registers under the `types` map key `'color-swatch'`
 * and is opted-in per field with `@ui.form.type 'color-swatch'`. Used by
 * Section B's `brandColor: string`.
 *
 * Palette-only (no custom hex entry). Click a swatch to set the model
 * to its hex string. Selected swatch shows a ring. Keyboard: Tab into
 * the first swatch, ArrowLeft/Right cycles, Enter/Space picks.
 *
 * Wrapped in the library's `<AsFieldShell>` so label, description, and
 * error chrome stay consistent with built-in fields.
 */
const props = defineProps<TAsComponentProps<string | null | undefined>>();

const PALETTE = [
  "#ef4444", // red
  "#f97316", // orange
  "#facc15", // yellow
  "#22c55e", // green
  "#0ea5e9", // blue
  "#6366f1", // indigo
  "#a855f7", // purple
  "#64748b", // slate
] as const;

const buttonRefs = ref<HTMLButtonElement[]>([]);

function setRef(el: Element | null | undefined, index: number): void {
  if (el instanceof HTMLButtonElement) {
    buttonRefs.value[index] = el;
  }
}

function pick(hex: string): void {
  props.model.value = hex;
}

function focusIndex(idx: number): void {
  const clamped = (idx + PALETTE.length) % PALETTE.length;
  buttonRefs.value[clamped]?.focus();
}

function onKeyDown(e: KeyboardEvent, idx: number, hex: string): void {
  switch (e.key) {
    case "ArrowRight":
    case "ArrowDown":
      e.preventDefault();
      focusIndex(idx + 1);
      break;
    case "ArrowLeft":
    case "ArrowUp":
      e.preventDefault();
      focusIndex(idx - 1);
      break;
    case "Enter":
    case " ":
      e.preventDefault();
      pick(hex);
      break;
  }
}

function onGroupBlur(e: FocusEvent): void {
  const next = e.relatedTarget as Node | null;
  const group = e.currentTarget as HTMLElement;
  if (group && next && group.contains(next)) return;
  props.onBlur();
}
</script>

<template>
  <AsFieldShell v-bind="$props" data-testid="demo-color-swatch">
    <template #default="{ inputId }">
      <div
        class="demo-swatch-group"
        role="radiogroup"
        :aria-label="label || name"
        :aria-describedby="ariaDescribedBy"
        :aria-required="required || undefined"
        :aria-invalid="!!error || undefined"
        @focusout="onGroupBlur"
      >
        <button
          v-for="(hex, idx) in PALETTE"
          :key="hex"
          :ref="(el) => setRef(el as Element | null, idx)"
          :id="idx === 0 ? inputId : undefined"
          type="button"
          class="demo-swatch"
          :class="{ selected: model.value === hex }"
          :style="{ backgroundColor: hex }"
          :aria-label="hex"
          :aria-checked="model.value === hex"
          role="radio"
          :disabled="disabled"
          @click="pick(hex)"
          @keydown="onKeyDown($event, idx, hex)"
        />
      </div>
    </template>
  </AsFieldShell>
</template>

<style scoped>
.demo-swatch-group {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
}
.demo-swatch {
  appearance: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid transparent;
  padding: 0;
  cursor: pointer;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1);
  transition: transform 0.1s ease;
}
.demo-swatch:hover:not(:disabled) {
  transform: scale(1.1);
}
.demo-swatch.selected {
  border-color: currentColor;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.15);
}
.demo-swatch:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
.demo-swatch:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
