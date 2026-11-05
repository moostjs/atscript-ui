<script setup lang="ts">
import { computed } from "vue";
import type { ColumnDef } from "@atscript/ui";
import { useAsTexts } from "@atscript/vue-form/locale";
import { textAround } from "../../utils/text-around";

const props = defineProps<{
  queryError: Error | null | undefined;
  isEmpty: boolean;
  querying: boolean;
  columns: ColumnDef[];
  searchTerm?: string;
  hasActiveFilters: boolean;
  onClearFilters?: () => void;
  onRetry?: () => void;
}>();

const { t } = useAsTexts();
const noMatchText = computed(() =>
  textAround(t, "UI_TABLE_NO_MATCH_SEARCH", "term", { term: props.searchTerm ?? "" }),
);
</script>

<template>
  <div v-if="queryError" class="as-table-error">
    <slot name="error" :error="queryError" :retry="onRetry">
      <div class="as-vh-empty">
        <span class="as-vh-error-icon i-as-warning" aria-hidden="true" />
        <p class="as-vh-empty-title">{{ t("UI_TABLE_LOAD_FAILED") }}</p>
        <p class="as-vh-empty-body">{{ queryError.message }}</p>
        <button v-if="onRetry" type="button" class="as-vh-empty-clear" @click="onRetry">
          <span class="i-as-refresh" aria-hidden="true" />
          {{ t("UI_RETRY") }}
        </button>
      </div>
    </slot>
  </div>
  <div v-else-if="isEmpty && !querying && columns.length > 0" class="as-table-empty">
    <slot
      name="empty"
      :search-term="searchTerm"
      :has-active-filters="hasActiveFilters"
      :on-clear-filters="onClearFilters"
    >
      <div class="as-vh-empty">
        <span class="as-vh-empty-icon i-as-search" aria-hidden="true" />
        <p class="as-vh-empty-title">{{ t("UI_TABLE_NO_MATCHING") }}</p>
        <p v-if="searchTerm" class="as-vh-empty-body">
          {{ noMatchText[0]
          }}<span v-if="noMatchText[1]" class="as-vh-empty-code">"{{ noMatchText[1] }}"</span
          >{{ noMatchText[2] }}
        </p>
        <p v-else-if="hasActiveFilters" class="as-vh-empty-body">
          {{ t("UI_TABLE_NO_MATCH_FILTERS") }}
        </p>
        <p v-else class="as-vh-empty-body">{{ t("UI_TABLE_NO_ENTRIES") }}</p>
        <button
          v-if="(searchTerm || hasActiveFilters) && onClearFilters"
          type="button"
          class="as-vh-empty-clear"
          @click="onClearFilters"
        >
          <span class="i-as-refresh" aria-hidden="true" />
          {{ t("UI_TABLE_CLEAR_FILTERS") }}
        </button>
      </div>
    </slot>
  </div>
</template>
