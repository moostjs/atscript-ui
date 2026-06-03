<script setup lang="ts">
import type { TAsComponentProps } from "../types";

defineProps<
  TAsComponentProps & {
    /**
     * Text rendered before the action link, e.g. "Already have an account?".
     * Supplied via `@ui.form.attr 'text', '...'` (attrs flow onto the component
     * as props).
     */
    text?: string;
    /**
     * Horizontal alignment of the action row. Supplied via
     * `@ui.form.attr 'align', 'left' | 'center' | 'right'`. Defaults to left.
     */
    align?: "left" | "center" | "right";
  }
>();
const emit = defineEmits<{
  (e: "action", name: string): void;
}>();
</script>

<template>
  <!-- `as-action-field` is the flex row; alignment (`as-action-{left,center,
       right}`) is safelisted in the ui-styles preset since the static extractor
       can't see this interpolated class. The link styling lives directly on the
       <button> (as `as-field-action-link`) so `:hover`/`:focus` bind to the
       button alone — not the whole row. -->
  <div
    class="as-action-field"
    :class="[$props.class, `as-action-${align ?? 'left'}`]"
    v-show="!hidden"
  >
    <span v-if="text" class="as-action-text">{{ text }}</span>
    <button
      type="button"
      class="as-field-action-link"
      @click="formAction && emit('action', formAction.id)"
    >
      {{ formAction?.label }}
    </button>
  </div>
</template>
