<script setup lang="ts">
import { ref } from "vue";
import type { TAsComponentProps } from "@atscript/vue-form";

/**
 * Star-rating widget for a `number` field, opted-in via
 * `@ui.form.type 'stars'`. Used by Section B's `rating: number`.
 *
 * Hard-coded to 5 stars. Click the active star to clear back to null.
 * Keyboard: ArrowLeft/Right adjusts ±1 (below 1 clears), Backspace/Delete
 * clears, Enter/Space sets to the focused star's index.
 */
const props = defineProps<TAsComponentProps<number | null | undefined>>();

const MAX = 5;
const stars = Array.from({ length: MAX }, (_, i) => i + 1);

const hoverValue = ref<number | null>(null);

function isFilled(star: number): boolean {
  const display = hoverValue.value ?? props.model.value ?? 0;
  return star <= display;
}

function pick(star: number): void {
  if (props.model.value === star) {
    // Click the currently-active star to clear.
    props.model.value = null;
  } else {
    props.model.value = star;
  }
}

function clamp(n: number): number {
  if (n < 1) return 0;
  if (n > MAX) return MAX;
  return n;
}

function adjust(delta: number): void {
  const current = props.model.value ?? 0;
  const next = clamp(current + delta);
  props.model.value = next === 0 ? null : next;
}

function onKeyDown(e: KeyboardEvent, star: number): void {
  switch (e.key) {
    case "ArrowRight":
    case "ArrowUp":
      e.preventDefault();
      adjust(1);
      break;
    case "ArrowLeft":
    case "ArrowDown":
      e.preventDefault();
      adjust(-1);
      break;
    case "Backspace":
    case "Delete":
      e.preventDefault();
      props.model.value = null;
      break;
    case "Enter":
    case " ":
      e.preventDefault();
      pick(star);
      break;
  }
}

function onGroupBlur(e: FocusEvent): void {
  // Fire onBlur only when focus leaves the entire star group.
  const next = e.relatedTarget as Node | null;
  const group = (e.currentTarget as HTMLElement) ?? null;
  if (group && next && group.contains(next)) return;
  props.onBlur();
}
</script>

<template>
  <div class="demo-field" :class="{ hidden }" v-show="!hidden">
    <label v-if="label" :for="inputId" class="demo-field-label">{{ label }}</label>
    <div v-if="description" :id="descId" class="demo-field-description">{{ description }}</div>
    <div
      class="demo-star-group"
      role="radiogroup"
      :aria-label="label || name"
      :aria-describedby="ariaDescribedBy"
      :aria-required="required || undefined"
      :aria-invalid="!!error || undefined"
      @focusout="onGroupBlur"
      @mouseleave="hoverValue = null"
    >
      <button
        v-for="(star, idx) in stars"
        :key="star"
        :id="idx === 0 ? inputId : undefined"
        type="button"
        class="demo-star-btn"
        :class="{ filled: isFilled(star) }"
        :aria-label="`${star} star${star === 1 ? '' : 's'}`"
        :aria-checked="props.model.value === star"
        role="radio"
        :disabled="disabled"
        @click="pick(star)"
        @mouseenter="hoverValue = star"
        @focus="hoverValue = star"
        @blur="hoverValue = null"
        @keydown="onKeyDown($event, star)"
      >
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          aria-hidden="true"
          :fill="isFilled(star) ? '#f59e0b' : 'none'"
          :stroke="isFilled(star) ? '#f59e0b' : '#9ca3af'"
          stroke-width="1.5"
          stroke-linejoin="round"
        >
          <path
            d="M12 2.5l2.9 6.55 7.1.6-5.4 4.7 1.65 6.95L12 17.7l-6.25 3.6L7.4 14.35 2 9.65l7.1-.6L12 2.5z"
          />
        </svg>
      </button>
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
.demo-star-group {
  display: inline-flex;
  gap: 2px;
}
.demo-star-btn {
  appearance: none;
  background: transparent;
  border: 0;
  padding: 2px;
  cursor: pointer;
  line-height: 0;
  border-radius: 4px;
  color: inherit;
}
.demo-star-btn:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
.demo-star-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
