<script setup lang="ts">
import { extractValueHelp } from "@atscript/ui";
import {
  ComboboxAnchor,
  ComboboxCancel,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxRoot,
  ComboboxViewport,
} from "reka-ui";
import { onMounted } from "vue";
import { useValueHelp } from "../../composables/use-value-help";
import type { TAsComponentProps } from "../types";
import AsFieldShell from "../internal/as-field-shell.vue";

const props = defineProps<TAsComponentProps>();

const info = props.field ? extractValueHelp(props.field.prop) : undefined;

const vh = info
  ? useValueHelp({
      info,
      model: props.model,
      onBlur: props.onBlur,
    })
  : undefined;

const results = vh?.results;
const loading = vh?.loading;
const accessible = vh?.accessible;

function onSearchInput(e: Event) {
  if (vh) vh.searchText.value = (e.target as HTMLInputElement).value;
}

if (vh) {
  onMounted(() => vh.init());
}
</script>

<template>
  <AsFieldShell v-bind="$props" id-prefix="as-ref">
    <template #default="{ inputId, errorId, descId }">
      <!-- Fallback: plain text input when no ValueHelpInfo -->
      <input
        v-if="!info || !vh"
        :id="inputId"
        v-model="model.value"
        type="text"
        :name="name"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :aria-required="required || undefined"
        :aria-invalid="!!error || undefined"
        :aria-describedby="error || hint ? errorId : description ? descId : undefined"
        :aria-label="!label ? name : undefined"
        @blur="onBlur"
      />

      <!-- reka-ui Combobox for FK ref fields — value is the raw FK id -->
      <ComboboxRoot
        v-else
        v-model="model.value"
        :disabled="disabled"
        :name="name"
        ignore-filter
        class="as-ref-root"
      >
        <ComboboxAnchor class="as-ref-anchor">
          <ComboboxInput
            :id="inputId"
            :placeholder="placeholder"
            :disabled="disabled"
            :readonly="readonly"
            :aria-required="required || undefined"
            :aria-invalid="!!error || undefined"
            :aria-describedby="error || hint ? errorId : description ? descId : undefined"
            :aria-label="!label ? name : undefined"
            class="as-ref-input"
            @input="onSearchInput"
            @blur="onBlur"
          />
          <ComboboxCancel
            v-if="model.value != null && model.value !== '' && !disabled && !readonly"
            class="as-ref-clear"
          >
            &times;
          </ComboboxCancel>
        </ComboboxAnchor>

        <ComboboxContent position="popper" side="bottom" :side-offset="4" class="as-ref-content">
          <ComboboxViewport class="as-ref-viewport">
            <div v-if="loading" class="as-ref-status">Loading...</div>
            <div v-else-if="accessible === false" class="as-ref-status">No access</div>
            <template v-else>
              <ComboboxItem
                v-for="item in results"
                :key="String(item[info.targetField])"
                :value="item[info.targetField]"
                class="as-ref-item"
              >
                <span class="as-ref-item-id">{{ item[info.targetField] }}</span>
                <span class="as-ref-item-label">
                  {{ item[info.labelField] }}
                  <span v-if="info.descrField && item[info.descrField]" class="as-ref-item-descr">
                    — {{ item[info.descrField] }}
                  </span>
                </span>
              </ComboboxItem>
              <ComboboxEmpty class="as-ref-status">No results</ComboboxEmpty>
            </template>
          </ComboboxViewport>
        </ComboboxContent>
      </ComboboxRoot>
    </template>
  </AsFieldShell>
</template>
