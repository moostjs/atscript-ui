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
 *
 * The textarea itself sits as a descendant of the shell's
 * `as-default-field` root, which paints input chrome (border, layer,
 * focus ring, scope-error reaction) on every nested `<textarea>` via
 * descendant selectors — so the markup carries no styling, only
 * height/resize bounds.
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
        class="min-h-[60px] max-h-[300px] resize-none overflow-y-auto leading-[1.45]"
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
