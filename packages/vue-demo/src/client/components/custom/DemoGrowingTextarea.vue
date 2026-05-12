<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { AsFieldShell, type TAsComponentProps } from "@atscript/vue-form";

/**
 * Custom string renderer used by the custom-components demo:
 *
 *  - Section A (built-in type override) — registered in the `types` map
 *    under the `text` key, replacing the default `<AsInput>` for every
 *    string field on the form.
 *  - Section B — opt-in per field via `@ui.form.type 'bio'`.
 *
 * Wraps the widget in the library's public `<AsFieldShell>` (Tier-2
 * default in `@atscript/vue-form`) so label, description, optional
 * clear, and error chrome all stay consistent with the built-in fields.
 */
const props = defineProps<TAsComponentProps<string | null | undefined>>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);

function resize(): void {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = "auto";
  // Clamp at ~300px after which native overflow scrolling takes over.
  const next = Math.min(el.scrollHeight, 300);
  el.style.height = `${next}px`;
}

function onInput(e: Event): void {
  const el = e.target as HTMLTextAreaElement;
  props.model.value = el.value;
  resize();
}

// External model changes (form reset, programmatic write) must also
// resize. Wait a tick so the new content is in the DOM before measuring.
watch(
  () => props.model.value,
  () => {
    void nextTick(resize);
  },
);
</script>

<template>
  <AsFieldShell v-bind="$props" data-testid="demo-growing-textarea">
    <template #default="{ inputId, ariaDescribedBy }">
      <textarea
        :id="inputId"
        ref="textareaRef"
        class="demo-growing-textarea"
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
        rows="2"
        @input="onInput"
        @blur="onBlur"
      />
    </template>
  </AsFieldShell>
</template>

<style scoped>
.demo-growing-textarea {
  width: 100%;
  min-height: 60px;
  max-height: 300px;
  padding: 8px 10px;
  font: inherit;
  line-height: 1.4;
  color: inherit;
  background: transparent;
  border: 1px solid currentColor;
  border-radius: 4px;
  resize: none;
  overflow-y: auto;
  box-sizing: border-box;
  opacity: 0.95;
}
.demo-growing-textarea:focus {
  outline: 2px solid currentColor;
  outline-offset: 1px;
}
.demo-growing-textarea.error {
  border-color: #ef4444;
}
.demo-growing-textarea:disabled,
.demo-growing-textarea[readonly] {
  opacity: 0.5;
}
</style>
</content>
</invoke>