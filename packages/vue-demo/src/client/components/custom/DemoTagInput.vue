<script setup lang="ts">
import { ref } from "vue";
import { AsFieldShell, type TAsComponentProps } from "@atscript/vue-form";

/**
 * Tag-input — `string[]` rendered as removable pills + a trailing text
 * input. Opted-in per field via `@ui.form.type 'tag-input'`. Used by
 * the custom-components demo's `tags: string[]`.
 *
 * Wrapped in the library's `<AsFieldShell>` so label, description, and
 * error chrome stay consistent with built-in fields.
 *
 * Skipped `useAsArray` here. That composable's contract is built around
 * per-item AsField recursion (stable `itemKeys`, `getItemField`, item
 * shells with their own labels/errors). A tag input is the wrong fit:
 * the entire UI is a single control over a flat string[], not a list
 * of nested field cards. Direct prop binding keeps the wiring obvious.
 *
 * Styling: wrapper paints the merged-chrome border + focus ring; the
 * inner `<input>` escapes ambient `as-default-field` descendant chrome
 * with `!`-qualified resets (same canonical pattern as `innerInputReset`
 * in `packages/ui-styles/src/shortcuts/form/as-decimal-number.ts`).
 * Pills sit on `layer-2` for a subtle one-level-deeper-than-input feel.
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
  <AsFieldShell v-bind="$props" data-testid="demo-tag-input">
    <template #default="{ inputId }">
      <div
        class="flex flex-wrap items-center gap-$xs layer-0 border-1 rounded-base px-$xs py-$xs min-h-fingertip-m cursor-text focus-within:current-border-hl focus-within:outline focus-within:i8-apply-outline"
        :class="{
          'scope-error current-border-hl border-current': !!error,
          'disabled-soft cursor-not-allowed': disabled,
        }"
        @focusout="onGroupBlur"
        @click="onContainerClick"
      >
        <span
          v-for="(tag, idx) in currentTags()"
          :key="`${idx}-${tag}`"
          class="inline-flex items-center gap-$xxs pl-$s pr-$xxs py-$xxs rounded-base layer-2 text-callout whitespace-nowrap"
        >
          <span>{{ tag }}</span>
          <button
            type="button"
            class="c8-chrome inline-grid place-items-center size-[1.5em] rounded-full appearance-none border-0 p-0 cursor-pointer text-body-l leading-[1] disabled-soft"
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
          class="demo-tag-input-field !flex-1 !min-w-[8em] !w-auto !h-auto !bg-transparent !border-0 !rounded-none !outline-none !ring-0 !shadow-none !px-$xxs !py-$xxs !layer-0 !text-scope-dark-0 dark:!text-scope-light-0"
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
    </template>
  </AsFieldShell>
</template>
