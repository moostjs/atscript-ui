<script setup lang="ts">
import type { TableDef } from "@atscript/ui";
import {
  useTableContext,
  useTableNavBridge,
  AsFilters,
  AsPresetPicker,
  AsTableActions,
  type ConfigTab,
} from "@atscript/vue-table";

const props = defineProps<{
  title: string;
  subtitle?: string;
  tableDef?: TableDef | null;
  /** Current selection mode (from parent). Drives the toggle label/icon. */
  selectMode?: "none" | "multi";
  /** Hide the toggle entirely for read-only roles. */
  canToggleSelect?: boolean;
}>();

defineEmits<{ (e: "toggle-select-mode"): void }>();

const { state } = useTableContext();
// Bridge needs the renderer's selection mode so Enter dispatches with the
// right semantics (main-action vs toggle-select fallback). Reactive getter
// re-reads on every dispatch.
const navBridge = useTableNavBridge(undefined, {
  mode: () => props.selectMode ?? "none",
});

function onSearchInput(e: Event) {
  // Model-driven: writing to state.searchTerm triggers the root watcher's
  // re-query — never call state.query() here (CLAUDE.md: model-driven, no
  // explicit triggers).
  state.searchTerm.value = (e.target as HTMLInputElement).value;
}

function refresh() {
  state.query();
}

function openConfig(tab: ConfigTab) {
  state.showConfigDialog(tab);
}

function clearSelection() {
  state.selectedRows.value = [];
}
</script>

<template>
  <header class="as-page-header">
    <div class="as-page-header-titles">
      <div class="as-page-header-eyebrow">atscript-ui demo · Tables</div>
      <div class="as-page-header-title-row">
        <h1 class="as-page-header-title">{{ title }}</h1>
        <button
          v-if="canToggleSelect"
          type="button"
          class="as-page-title-toggle"
          :aria-pressed="selectMode === 'multi' ? 'true' : 'false'"
          :title="
            selectMode === 'multi'
              ? 'Hide checkboxes — show row actions inline'
              : 'Show selection checkboxes'
          "
          @click="$emit('toggle-select-mode')"
        >
          <span class="i-as-check-square" aria-hidden="true" />
        </button>
      </div>
      <div v-if="subtitle" class="as-page-header-sub">{{ subtitle }}</div>
    </div>
    <div class="as-page-header-actions">
      <AsPresetPicker />
      <AsTableActions />
      <slot name="actions" />
      <button type="button" class="as-page-toolbar-btn" @click="refresh">
        <span class="i-as-refresh" aria-hidden="true" />
        <span>Refresh</span>
      </button>
      <div class="as-page-toolbar-island">
        <button
          type="button"
          class="as-page-toolbar-island-btn"
          title="Columns"
          @click="openConfig('columns')"
        >
          <span class="i-as-columns" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="as-page-toolbar-island-btn"
          title="Filters"
          @click="openConfig('filters')"
        >
          <span class="i-as-filter" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="as-page-toolbar-island-btn"
          title="Sorters"
          @click="openConfig('sorters')"
        >
          <span class="i-as-sorters" aria-hidden="true" />
        </button>
      </div>
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
        @keydown="navBridge.onKeydown"
      />
    </div>
    <div v-else class="as-page-search" />

    <div class="as-page-toolbar-right">
      <span v-if="state.selectedCount.value > 0" class="as-page-selection-summary">
        <span class="as-page-selection-count">{{ state.selectedCount.value }} selected</span>
        <button type="button" class="as-page-toolbar-btn" @click="clearSelection">
          <span class="i-ph:x" aria-hidden="true" />
          <span>Clear</span>
        </button>
      </span>
      <span class="as-page-pill">
        <strong class="as-page-pill-strong">{{ state.loadedCount.value }}</strong>
        of
        <strong class="as-page-pill-strong">{{ state.totalCount.value }}</strong>
      </span>
    </div>

    <div class="as-page-filters-row">
      <AsFilters />
    </div>
  </div>
</template>
