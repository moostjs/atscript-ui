<script setup lang="ts">
import type { TableDef } from "@atscript/ui";
import { useTableContext, AsFilters, type ConfigTab } from "@atscript/vue-table";

const props = defineProps<{
  title: string;
  subtitle?: string;
  tableDef?: TableDef | null;
  /**
   * Optional handler invoked when the user confirms "Delete selected" in the
   * toolbar. Receives the selected row values (as configured by `rowValueFn`
   * on `AsTableRoot`). After it resolves the toolbar re-queries the table and
   * clears the selection.
   */
  onDeleteSelected?: (ids: unknown[]) => Promise<void> | void;
}>();

const { state } = useTableContext();

function onSearchInput(e: Event) {
  const value = (e.target as HTMLInputElement).value;
  state.searchTerm.value = value;
}

function refresh() {
  state.query();
}

function openConfig(tab: ConfigTab) {
  state.showConfigDialog(tab);
}

async function deleteSelected() {
  if (!props.onDeleteSelected) return;
  const ids = [...state.selectedRows.value];
  if (ids.length === 0) return;
  await props.onDeleteSelected(ids);
  state.selectedRows.value = [];
  state.query();
}

function clearSelection() {
  state.selectedRows.value = [];
}
</script>

<template>
  <header class="as-page-header">
    <div class="as-page-header-titles">
      <div class="as-page-header-eyebrow">atscript-ui demo · Tables</div>
      <h1 class="as-page-header-title">{{ title }}</h1>
      <div v-if="subtitle" class="as-page-header-sub">{{ subtitle }}</div>
    </div>
    <div class="as-page-header-actions">
      <template v-if="state.selectedCount.value > 0">
        <span class="scope-primary font-mono text-callout text-current-hl">
          {{ state.selectedCount.value }} selected
        </span>
        <button
          v-if="onDeleteSelected"
          type="button"
          class="c8-flat scope-error as-page-toolbar-btn"
          @click="deleteSelected"
        >
          <span class="i-ph:trash" aria-hidden="true" />
          <span>Delete</span>
        </button>
        <button type="button" class="as-page-toolbar-btn" @click="clearSelection">
          <span class="i-ph:x" aria-hidden="true" />
          <span>Clear</span>
        </button>
        <span class="w-px h-fingertip-s bg-current/20 mx-$xs" aria-hidden="true" />
      </template>
      <slot name="actions" />
      <button type="button" class="as-page-toolbar-btn" @click="refresh">
        <span class="i-as-refresh" aria-hidden="true" />
        <span>Refresh</span>
      </button>
      <button type="button" class="as-page-toolbar-btn" @click="openConfig('columns')">
        <span class="i-as-columns" aria-hidden="true" />
        <span>Columns</span>
      </button>
      <button type="button" class="as-page-toolbar-btn" @click="openConfig('filters')">
        <span class="i-as-filter" aria-hidden="true" />
        <span>Filters</span>
      </button>
      <button type="button" class="as-page-toolbar-btn" @click="openConfig('sorters')">
        <span class="i-as-sorters" aria-hidden="true" />
        <span>Sorters</span>
      </button>
    </div>
  </header>

  <div class="as-page-toolbar">
    <div v-if="tableDef?.searchable" class="as-page-search">
      <span class="as-page-search-icon i-ph:magnifying-glass" aria-hidden="true" />
      <input
        type="search"
        class="as-page-search-input"
        placeholder="Search across all columns…"
        :value="state.searchTerm.value"
        @input="onSearchInput"
      />
    </div>
    <div v-else class="as-page-search" />

    <div class="as-page-toolbar-right">
      <span class="as-page-pill">
        <strong class="as-page-pill-strong">{{ state.loadedCount.value }}</strong>
        of
        <strong class="as-page-pill-strong">{{ state.totalCount.value }}</strong>
      </span>
    </div>

    <AsFilters class="as-page-filters" />
  </div>
</template>
