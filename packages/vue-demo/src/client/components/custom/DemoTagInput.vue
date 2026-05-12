<script setup lang="ts">
import { ref } from "vue";
import type { TAsComponentProps } from "@atscript/vue-form";

/**
 * Tag-input — `string[]` rendered as removable pills + a trailing text
 * input. Opted-in per field via `@ui.form.type 'tag-input'`. Used by
 * the custom-components demo's `tags: string[]`.
 *
 * Skipped `useAsArray` here. That composable's contract is built around
 * per-item AsField recursion (stable `itemKeys`, `getItemField`, item
 * shells with their own labels/errors). A tag input is the wrong fit:
 * the entire UI is a single control over a flat string[], not a list
 * of nested field cards. Direct prop binding keeps the wiring obvious.
 */
const props = defineProps<TAsComponentProps<string[] | null | undefined>>();

const draft = ref("");
const inputRef = ref<HTMLInputElement | null>(null);

function currentTags(): string[] {
  return Array.isArray(props.model.value) ? props.model.value : [];
}

function commit(next: string[]): void {
  // Replace the reference so AsField's model setter fires + the form's
  // reactive watchers pick up the change.
  props.model.value = next;
}

function addTag(raw: string): void {
  const trimmed = raw.trim();
  if (!trimmed) return;
  const tags = currentTags();
  if (tags.includes(trimmed)) {
    // Silently dedupe — clearing the draft is feedback enough.
    draft.value = "";
    return;
  }
  commit([...tags, trimmed]);
  draft.value = "";
}

function removeTag(index: number): void {
  const tags = currentTags();
  commit(tags.filter((_, i) => i !== index));
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    addTag(draft.value);
    return;
  }
  if (e.key === "Backspace" && draft.value === "") {
    const tags = currentTags();
    if (tags.length === 0) return;
    e.preventDefault();
    commit(tags.slice(0, -1));
  }
}

function onGroupBlur(e: FocusEvent): void {
  const next = e.relatedTarget as Node | null;
  const group = e.currentTarget as HTMLElement;
  if (group && next && group.contains(next)) return;
  // Commit any pending draft text on blur so users don't lose it.
  if (draft.value.trim()) addTag(draft.value);
  props.onBlur();
}

function onContainerClick(e: MouseEvent): void {
  // Click on the empty area focuses the input — mirrors native chip UIs.
  if (e.target === e.currentTarget) inputRef.value?.focus();
}
</script>

<template>
  <div class="demo-field" :class="{ hidden }" v-show="!hidden" data-testid="demo-tag-input">
    <label v-if="label" :for="inputId" class="demo-field-label">{{ label }}</label>
    <div v-if="description" :id="descId" class="demo-field-description">{{ description }}</div>
    <div
      class="demo-tag-input"
      :class="{ error: !!error, disabled }"
      @focusout="onGroupBlur"
      @click="onContainerClick"
    >
      <span v-for="(tag, idx) in currentTags()" :key="`${idx}-${tag}`" class="demo-tag-pill">
        <span class="demo-tag-pill-text">{{ tag }}</span>
        <button
          type="button"
          class="demo-tag-pill-remove"
          :aria-label="`Remove ${tag}`"
          :disabled="disabled"
          @click.stop="removeTag(idx)"
        >
          ×
        </button>
      </span>
      <input
        :id="inputId"
        ref="inputRef"
        v-model="draft"
        type="text"
        class="demo-tag-input-field"
        :placeholder="currentTags().length === 0 ? (placeholder ?? 'Add a tag…') : ''"
        :name="name"
        :disabled="disabled"
        :readonly="readonly"
        :aria-required="required || undefined"
        :aria-invalid="!!error || undefined"
        :aria-describedby="ariaDescribedBy"
        :aria-label="!label ? name : undefined"
        @keydown="onKeyDown"
      />
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
.demo-tag-input {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border: 1px solid currentColor;
  border-radius: 4px;
  min-height: 36px;
  cursor: text;
  opacity: 0.95;
}
.demo-tag-input:focus-within {
  outline: 2px solid currentColor;
  outline-offset: 1px;
}
.demo-tag-input.error {
  border-color: #ef4444;
}
.demo-tag-input.disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.demo-tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px 2px 8px;
  border-radius: 12px;
  background: rgba(99, 102, 241, 0.15);
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
}
.demo-tag-pill-text {
  color: inherit;
}
.demo-tag-pill-remove {
  appearance: none;
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
  padding: 0 4px;
  font-size: 14px;
  line-height: 1;
  border-radius: 50%;
  opacity: 0.7;
}
.demo-tag-pill-remove:hover:not(:disabled) {
  opacity: 1;
  background: rgba(0, 0, 0, 0.08);
}
.demo-tag-pill-remove:disabled {
  cursor: not-allowed;
  opacity: 0.3;
}
.demo-tag-input-field {
  flex: 1 1 80px;
  min-width: 80px;
  appearance: none;
  background: transparent;
  border: 0;
  outline: none;
  color: inherit;
  font: inherit;
  padding: 4px 2px;
}
.demo-tag-input-field:disabled {
  cursor: not-allowed;
}
</style>
