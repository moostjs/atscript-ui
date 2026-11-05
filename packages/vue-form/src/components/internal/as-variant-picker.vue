<script setup lang="ts">
import { computed, ref } from "vue";
import type { TAsUnionContext } from "../types";
import { useAsDropdown } from "../../composables/use-as-dropdown";
import { useAsTexts } from "../../composables/use-as-locale";
import { variantLabel } from "../../composables/variant-label";

const props = defineProps<{
  unionContext: TAsUnionContext;
  disabled?: boolean;
}>();

const { t } = useAsTexts();
const dropdownRef = ref<HTMLElement | null>(null);
const { isOpen, toggle, select } = useAsDropdown(dropdownRef);

// Variant labels carry a "N. " prefix from buildUnionVariants so the dropdown
// rows read as a numbered list. The trigger shows just the type name.
const currentLabel = computed(() => {
  const variant = props.unionContext.variants[props.unionContext.currentIndex.value];
  const raw = variant ? variantLabel(variant, t) : "";
  return raw.replace(/^\d+\.\s+/, "");
});

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
      :title="t('UI_FORM_SWITCH_TYPE', { type: currentLabel })"
      @click="toggle"
    >
      {{ currentLabel || t("UI_FORM_SWITCH") }}
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
        {{ variantLabel(v, t) }}
      </button>
    </div>
  </div>
</template>
