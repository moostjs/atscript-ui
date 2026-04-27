<script setup lang="ts">
import type { ColumnDef } from "@atscript/ui";

defineProps<{
  queryError: Error | null | undefined;
  isEmpty: boolean;
  querying: boolean;
  columns: ColumnDef[];
  searchTerm?: string;
  hasActiveFilters: boolean;
  onClearFilters?: () => void;
  onRetry?: () => void;
}>();
</script>

<template>
  <div v-if="queryError" class="as-table-error">
    <slot name="error" :error="queryError" :retry="onRetry">
      <div class="as-vh-empty">
        <span class="as-vh-error-icon i-as-warning" aria-hidden="true" />
        <p class="as-vh-empty-title">Failed to load values</p>
        <p class="as-vh-empty-body">{{ queryError.message }}</p>
        <button v-if="onRetry" type="button" class="as-vh-empty-clear" @click="onRetry">
          <span class="i-as-refresh" aria-hidden="true" />
          Retry
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
        <p class="as-vh-empty-title">No matching values</p>
        <p v-if="searchTerm" class="as-vh-empty-body">
          No entries match <span class="as-vh-empty-code">"{{ searchTerm }}"</span>. Try a different
          search.
        </p>
        <p v-else-if="hasActiveFilters" class="as-vh-empty-body">
          No entries match the current filters.
        </p>
        <p v-else class="as-vh-empty-body">No entries available</p>
        <button
          v-if="(searchTerm || hasActiveFilters) && onClearFilters"
          type="button"
          class="as-vh-empty-clear"
          @click="onClearFilters"
        >
          <span class="i-as-refresh" aria-hidden="true" />
          Clear filters
        </button>
      </div>
    </slot>
  </div>
</template>
