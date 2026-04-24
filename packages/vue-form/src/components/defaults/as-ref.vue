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
import { ref } from "vue";
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

const resolved = vh?.resolved;
const results = vh?.results;
const status = vh?.status;
const searching = vh?.searching;

const open = ref(false);

function onSearchInput(e: Event) {
  if (vh) vh.searchText.value = (e.target as HTMLInputElement).value;
}
</script>

<template>
  <AsFieldShell v-bind="$props" id-prefix="as-ref">
    <template #default="{ inputId, errorId, descId }">
      <!-- Fallback: plain text input when no ValueHelpInfo or target meta unreachable -->
      <input
        v-if="!info || !vh || status === 'error'"
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

      <div v-else-if="status === 'loading' || !resolved" class="as-ref-loading">
        <span class="as-ref-spinner" aria-hidden="true" />
      </div>

      <!-- reka-ui Combobox for FK ref fields — value is the raw FK id. -->
      <ComboboxRoot
        v-else
        v-model="model.value"
        v-model:open="open"
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
            @focus="open = true"
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
            <div v-if="searching" class="as-ref-status">
              <span class="as-ref-spinner" aria-hidden="true" />
            </div>
            <template v-else>
              <ComboboxItem
                v-for="item in results"
                :key="String(item[info.targetField])"
                :value="item[info.targetField]"
                class="as-ref-item"
              >
                <span class="as-ref-item-id">{{ item[info.targetField] }}</span>
                <span class="as-ref-item-label">
                  {{ item[resolved.labelField] }}
                  <span
                    v-if="resolved.descrField && item[resolved.descrField]"
                    class="as-ref-item-descr"
                  >
                    — {{ item[resolved.descrField] }}
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
