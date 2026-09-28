<script setup lang="ts">
import { ref, watch } from "vue";
import type { TableDef } from "@atscript/ui";
import {
  useTableContext,
  useTableNavBridge,
  AsFilterField,
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
  /** `<AsFilters>` overflow showcase (see `DemoTable.filtersOverflow`). */
  filtersOverflow?: { maxVisible: number };
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
  state.clearSelection();
}

// ── Overflow-popover showcase (only rendered with `filtersOverflow`) ──
const moreOpen = ref(false);
const openFocusCount = ref(0);
const closeFocusCount = ref(0);
const keepFocusOnOpen = ref(false);
const keepFocusOnClose = ref(false);
const customOverflowBody = ref(false);
const closeOnFilterDialog = ref(false);

function onOverflowOpenAutoFocus(event: Event) {
  openFocusCount.value++;
  if (keepFocusOnOpen.value) event.preventDefault();
}

function onOverflowCloseAutoFocus(event: Event) {
  closeFocusCount.value++;
  if (keepFocusOnClose.value) event.preventDefault();
}

// Documented host recipe: close the popover as a filter dialog opens.
watch(
  () => state.filterDialogColumn.value,
  (column) => {
    if (column && closeOnFilterDialog.value) moreOpen.value = false;
  },
);
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
      <AsFilters v-if="!filtersOverflow" />
      <AsFilters
        v-else
        v-model:overflow-open="moreOpen"
        :max-visible="filtersOverflow.maxVisible"
        @overflow-open-auto-focus="onOverflowOpenAutoFocus"
        @overflow-close-auto-focus="onOverflowCloseAutoFocus"
      >
        <template #overflow-trigger="{ activeCount, open }">
          <button
            type="button"
            class="as-page-toolbar-btn demo-more-filters"
            :data-open="open ? 'true' : 'false'"
          >
            More ({{ activeCount }})
          </button>
        </template>
        <template v-if="customOverflowBody" #overflow="{ columns, close }">
          <div class="demo-overflow-body flex flex-col gap-$s">
            <div class="demo-overflow-title text-callout">{{ columns.length }} more filters</div>
            <AsFilterField v-for="col in columns" :key="col.path" :column="col" />
            <button type="button" class="as-page-toolbar-btn demo-overflow-done" @click="close">
              Done
            </button>
          </div>
        </template>
      </AsFilters>
    </div>

    <div
      v-if="filtersOverflow"
      class="demo-overflow-controls col-span-2 flex flex-wrap items-center gap-$m text-callout"
    >
      <button type="button" class="as-page-toolbar-btn demo-overflow-open" @click="moreOpen = true">
        Open more filters
      </button>
      <button
        type="button"
        class="as-page-toolbar-btn demo-overflow-close"
        @click="moreOpen = false"
      >
        Close more filters
      </button>
      <span class="demo-overflow-state">{{ moreOpen ? "open" : "closed" }}</span>
      <span>
        open-auto-focus: <span class="demo-open-focus-count">{{ openFocusCount }}</span>
      </span>
      <span>
        close-auto-focus: <span class="demo-close-focus-count">{{ closeFocusCount }}</span>
      </span>
      <label class="flex items-center gap-$xs">
        <input v-model="keepFocusOnOpen" type="checkbox" class="demo-keep-focus-open" />
        Keep focus on open
      </label>
      <label class="flex items-center gap-$xs">
        <input v-model="keepFocusOnClose" type="checkbox" class="demo-keep-focus-close" />
        Keep focus on close
      </label>
      <label class="flex items-center gap-$xs">
        <input v-model="customOverflowBody" type="checkbox" class="demo-custom-overflow" />
        Custom popover body
      </label>
      <label class="flex items-center gap-$xs">
        <input v-model="closeOnFilterDialog" type="checkbox" class="demo-close-on-dialog" />
        Close on filter dialog
      </label>
    </div>
  </div>
</template>
