<script setup lang="ts">
import type { TAsComponentProps } from "../types";
import AsField from "../as-field.vue";
import AsNoData from "../internal/as-no-data.vue";
import { useFormUnion } from "../../composables/use-form-union";

const props = defineProps<TAsComponentProps>();

const {
  unionField,
  hasMultipleVariants,
  localUnionIndex,
  innerField,
  changeVariant,
  optionalEnabled,
  dropdownRef,
  isOpen,
  toggle,
  select,
  handleNaClick,
} = useFormUnion(props);
</script>

<template>
  <div class="as-union" v-show="!hidden">
    <!-- Optional N/A state: click opens variant picker when multiple variants -->
    <template v-if="optional && !optionalEnabled">
      <div v-if="hasMultipleVariants" ref="dropdownRef" class="as-dropdown-anchor">
        <AsNoData :on-edit="handleNaClick" />
        <div v-if="isOpen" class="as-dropdown-menu">
          <button
            v-for="(v, vi) in unionField!.unionVariants"
            :key="vi"
            type="button"
            class="as-dropdown-item"
            @click="
              select(() => {
                changeVariant(vi);
                onToggleOptional?.(true);
              })
            "
          >
            {{ v.label }}
          </button>
        </div>
      </div>
      <AsNoData v-else :on-edit="() => onToggleOptional?.(true)" />
    </template>
    <template v-else>
      <!-- Optional clear button -->
      <button
        v-if="optional"
        type="button"
        class="as-optional-clear"
        @click="onToggleOptional?.(false)"
      >
        &times;
      </button>
      <!-- Inner field — variant picker rendered by consumer via union context -->
      <AsField
        v-if="innerField"
        :key="localUnionIndex"
        :field="innerField"
        :array-index="arrayIndex"
        :on-remove="onRemove"
        :can-remove="canRemove"
        :remove-label="removeLabel"
      />
    </template>
  </div>
</template>

<style>
.as-union {
  margin: 0;
}
</style>
