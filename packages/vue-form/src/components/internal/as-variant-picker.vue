<script setup lang="ts">
import { ref } from "vue";
import type { TAsUnionContext } from "../types";
import { useDropdown } from "../../composables/use-dropdown";

defineProps<{
  unionContext: TAsUnionContext;
  disabled?: boolean;
}>();

const dropdownRef = ref<HTMLElement | null>(null);
const { isOpen, toggle, select } = useDropdown(dropdownRef);

function onSelectVariant(ctx: TAsUnionContext, index: number) {
  select(() => ctx.changeVariant(index));
}
</script>

<template>
  <div ref="dropdownRef" class="as-dropdown">
    <button
      type="button"
      class="as-variant-trigger"
      :disabled="disabled"
      :title="unionContext.variants[unionContext.currentIndex.value]?.label ?? 'Switch variant'"
      @click="toggle"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="3" cy="8" r="1.5" fill="currentColor" />
        <circle cx="8" cy="8" r="1.5" fill="currentColor" />
        <circle cx="13" cy="8" r="1.5" fill="currentColor" />
      </svg>
    </button>
    <div v-if="isOpen" class="as-dropdown-menu">
      <button
        v-for="(v, vi) in unionContext.variants"
        :key="vi"
        type="button"
        class="as-dropdown-item"
        :class="{ 'as-dropdown-item--active': unionContext.currentIndex.value === vi }"
        @click="onSelectVariant(unionContext, vi)"
      >
        {{ v.label }}
      </button>
    </div>
  </div>
</template>
