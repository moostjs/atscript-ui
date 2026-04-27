<script setup lang="ts">
import type { TableDef } from "@atscript/ui";
import { useTableContext, useTableNavBridge } from "@atscript/vue-table";

const props = defineProps<{
  title: string;
  subtitle?: string;
  tableDef?: TableDef | null;
  loadedCount: number;
  totalCount: number;
}>();

const { state } = useTableContext();
const navBridge = useTableNavBridge();

function onSearchInput(e: Event) {
  const value = (e.target as HTMLInputElement).value;
  state.searchTerm.value = value;
  state.query();
}

function refresh() {
  state.query();
}

function openConfig(tab: "columns" | "filters" | "sorters") {
  state.showConfigDialog(tab);
}

// avoid unused warning
void props;
</script>

<template>
  <header class="as-page-header">
    <div class="as-page-header-titles">
      <div class="as-page-header-eyebrow">atscript-ui · Tables</div>
      <h1 class="as-page-header-title">{{ title }}</h1>
      <div v-if="subtitle" class="as-page-header-sub">{{ subtitle }}</div>
    </div>
    <div class="as-page-header-actions">
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
        <span class="i-as-sort-asc" aria-hidden="true" />
        <span>Sorters</span>
      </button>
    </div>
  </header>

  <div class="as-page-toolbar">
    <div v-if="tableDef?.searchable" class="as-page-search">
      <span class="as-page-search-icon i-as-search" aria-hidden="true" />
      <input
        type="search"
        class="as-page-search-input"
        placeholder="Search across all columns…"
        :value="state.searchTerm.value"
        @input="onSearchInput"
        @keydown="navBridge.onKeydown"
      />
    </div>
    <div v-else class="as-page-search" />

    <div class="as-page-toolbar-right">
      <span class="as-page-pill">
        <strong class="as-page-pill-strong">{{ loadedCount }}</strong>
        of
        <strong class="as-page-pill-strong">{{ totalCount }}</strong>
      </span>
    </div>
  </div>
</template>
