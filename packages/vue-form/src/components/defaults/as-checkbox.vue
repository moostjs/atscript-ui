<script setup lang="ts">
import type { TAsComponentProps } from "../types";
import { useAsTriStateCheckbox } from "../../composables/use-as-tri-state-checkbox";
import AsFieldShell from "../internal/as-field-shell.vue";
import AsOptionalClear from "../internal/as-optional-clear.vue";

const props = defineProps<TAsComponentProps<boolean | undefined>>();

const { checked, indeterminate, inputRef, onChange } = useAsTriStateCheckbox({
  modelValue: () => props.model.value,
  onCommit: (v) => {
    props.model.value = v;
  },
});
</script>

<template>
  <AsFieldShell v-bind="$props" field-class="as-checkbox-field" :chromeless="true">
    <template #default="{ inputId }">
      <div class="as-checkbox-row">
        <label
          :for="inputId"
          class="as-field-label"
          :class="{ 'as-checkbox-indeterminate': indeterminate }"
        >
          <input
            ref="inputRef"
            :id="inputId"
            type="checkbox"
            :checked="checked"
            @change="onChange"
            @blur="onBlur"
            :name="name"
            :disabled="disabled"
            :readonly="readonly"
            :aria-invalid="!!error || undefined"
            :aria-describedby="ariaDescribedBy"
          />
          {{ label }}
        </label>
        <!-- Treat both undefined and null as 'unset' — DB-roundtripped null otherwise renders as "set". -->
        <AsOptionalClear
          v-if="optional && model.value != null"
          @clear="onToggleOptional?.(false)"
        />
      </div>
    </template>
    <template #after-input="{ descId }">
      <div v-if="description" :id="descId" class="as-field-description">{{ description }}</div>
    </template>
  </AsFieldShell>
</template>
