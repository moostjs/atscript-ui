<script setup lang="ts">
import { computed, shallowRef } from "vue";
import type { SortControl } from "@atscript/ui";
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
  TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "reka-ui";
import { arraysEqual, isColumnFilterable, sortersEqual } from "@atscript/ui-table";
import type { ConfigTab } from "../../types";
import { useTableContext } from "../../composables/use-table-state";
import { useTableComponent } from "../../composables/use-table-component";
import { useDialogTabKeyboard } from "../../composables/use-dialog-tab-keyboard";
import { useSeedOnOpen } from "../../composables/use-seed-on-open";
import AsFieldsSelector from "../internal/as-fields-selector.vue";
import AsSortersConfig from "../internal/as-sorters-config.vue";
import { useAsTexts } from "@atscript/vue-form/locale";
import { textAround } from "../../utils/text-around";

const { state } = useTableContext();
const { t } = useAsTexts();
// Static skin-slot resolution — `controls.fieldsSelector` / `controls.sortersConfig`
// replace the internal defaults without them ever being public exports.
const FieldsSelector = useTableComponent("fieldsSelector", AsFieldsSelector);
const SortersConfig = useTableComponent("sortersConfig", AsSortersConfig);

// Copy-on-open dialog models
const columnsModel = shallowRef<string[]>([]);
const filtersModel = shallowRef<string[]>([]);
const sortersModel = shallowRef<SortControl[]>([]);

const isOpen = computed({
  get: () => state.configDialogOpen.value,
  set: (val: boolean) => {
    state.configDialogOpen.value = val;
  },
});

const activeTab = computed({
  get: () => state.configTab.value,
  set: (val: string) => {
    state.configTab.value = val as ConfigTab;
  },
});

// On open: shallow-copy current state into dialog models.
useSeedOnOpen(isOpen, () => {
  columnsModel.value = [...state.columnNames.value];
  filtersModel.value = [...state.filterFields.value];
  sortersModel.value = state.sorters.value.map((s) => ({ ...s }));
});

const filterableColumns = computed(() => state.allColumns.value.filter(isColumnFilterable));
const sortableColumns = computed(() => {
  // Same rule as the table header — `state.localSortAvailable` owns it.
  const localOk = state.localSortAvailable.value;
  return state.allColumns.value.filter((c) => c.sortable && (localOk || !c.local));
});

// The summary under the tabs: "3 of 10 columns visible" (the count in a badge) and a hint.
const tabSummary = computed(() => {
  switch (activeTab.value) {
    case "columns":
      return {
        count: columnsModel.value.length,
        total: state.allColumns.value.length,
        text: "UI_TABLE_COLUMNS_VISIBLE",
        hint: "UI_TABLE_COLUMNS_HINT",
      };
    case "filters":
      return {
        count: filtersModel.value.length,
        total: filterableColumns.value.length,
        text: "UI_TABLE_FILTERS_SHOWN",
        hint: "UI_TABLE_FILTERS_HINT",
      };
    default:
      return {
        count: sortersModel.value.length,
        total: sortableColumns.value.length,
        text: "UI_TABLE_SORTERS_ACTIVE",
        hint: "UI_TABLE_SORTERS_HINT",
      };
  }
});
const summaryText = computed(() =>
  textAround(t, tabSummary.value.text, "count", {
    count: tabSummary.value.count,
    total: tabSummary.value.total,
  }),
);

function filterCount(path: string): number {
  return state.filters.value[path]?.length ?? 0;
}

function onApply() {
  if (!arraysEqual(state.columnNames.value, columnsModel.value)) {
    state.columnNames.value = columnsModel.value;
  }
  if (!arraysEqual(state.filterFields.value, filtersModel.value)) {
    state.filterFields.value = filtersModel.value;
  }
  if (!sortersEqual(state.sorters.value, sortersModel.value)) {
    state.sorters.value = sortersModel.value;
  }
  state.configDialogOpen.value = false;
}

function onCancel() {
  state.configDialogOpen.value = false;
}

// Focus the active tab's orderable-list search input. The composable wraps
// this in `nextTick` + `requestAnimationFrame` so Reka's `<Presence>` has a
// frame to mount the new TabsContent before we query.
function focusActiveTabSearch() {
  const search = document.querySelector<HTMLElement>(
    ".as-config-dialog-content [role='tabpanel'][data-state='active'] .as-orderable-list-search",
  );
  search?.focus();
}

const { onDialogKeydown, focusActiveTabAfterMount } = useDialogTabKeyboard<ConfigTab>({
  activeTab,
  tabOrder: ["columns", "filters", "sorters"],
  focusActiveTab: focusActiveTabSearch,
});

function onOpenAutoFocus(event: Event) {
  event.preventDefault();
  focusActiveTabAfterMount();
}
</script>

<template>
  <DialogRoot v-model:open="isOpen">
    <DialogPortal>
      <DialogOverlay class="as-config-dialog-overlay" />
      <DialogContent
        class="as-config-dialog-content"
        @open-auto-focus="onOpenAutoFocus"
        @keydown="onDialogKeydown"
      >
        <div class="as-config-dialog-header">
          <DialogTitle class="as-config-dialog-title">{{ t("UI_TABLE_SETTINGS") }}</DialogTitle>
          <!-- Reka requires a description on every DialogContent — without it
               it logs a warning and leaves `aria-describedby="undefined"` on
               the surface. The dialog has no visible sub-heading, so the copy
               is screen-reader-only. -->
          <DialogDescription class="sr-only">
            {{ t("UI_TABLE_SETTINGS_DESCRIPTION") }}
          </DialogDescription>
          <DialogClose class="as-config-dialog-close" :aria-label="t('UI_CLOSE')">
            <span class="i-as-close" aria-hidden="true" />
          </DialogClose>
        </div>
        <TabsRoot v-model="activeTab" class="as-config-dialog-tabs">
          <TabsList class="as-config-tabs-list">
            <TabsTrigger value="columns" class="as-config-tab-trigger">
              <span class="as-config-tab-icon i-as-columns" aria-hidden="true" />
              {{ t("UI_TABLE_COLUMNS") }}
              <span
                class="as-config-tab-count"
                :class="{ 'as-config-tab-count-active': activeTab === 'columns' }"
              >
                {{ columnsModel.length }}
              </span>
            </TabsTrigger>
            <TabsTrigger value="filters" class="as-config-tab-trigger">
              <span class="as-config-tab-icon i-as-filter" aria-hidden="true" />
              {{ t("UI_TABLE_FILTERS") }}
              <span
                class="as-config-tab-count"
                :class="{ 'as-config-tab-count-active': activeTab === 'filters' }"
              >
                {{ filtersModel.length }}
              </span>
            </TabsTrigger>
            <TabsTrigger value="sorters" class="as-config-tab-trigger">
              <span class="as-config-tab-icon i-as-sorters" aria-hidden="true" />
              {{ t("UI_TABLE_SORTERS") }}
              <span
                class="as-config-tab-count"
                :class="{ 'as-config-tab-count-active': activeTab === 'sorters' }"
              >
                {{ sortersModel.length }}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="columns" class="as-config-tab-content">
            <component
              :is="FieldsSelector"
              :columns="state.allColumns.value"
              v-model="columnsModel"
            >
              <template #label="{ label, value }">
                <span class="as-config-field-label-wrap">
                  <span class="as-config-field-label-text">{{ label }}</span>
                  <!-- Client-owned (`:display-columns`) columns are rendered by
                       the app, not fetched — say so, so nobody hunts for a
                       missing field on the server. -->
                  <span
                    v-if="state.localColumnPaths.value.has(value)"
                    class="as-config-field-hint"
                    >{{ t("UI_TABLE_CLIENT_SORTER") }}</span
                  >
                </span>
              </template>
            </component>
          </TabsContent>

          <TabsContent value="filters" class="as-config-tab-content">
            <component :is="FieldsSelector" :columns="filterableColumns" v-model="filtersModel">
              <template #label="{ label, value }">
                <span class="as-config-field-label-wrap">
                  <span class="as-config-field-label-text">{{ label }}</span>
                  <span v-if="filterCount(value) > 0" class="as-config-field-count">
                    {{ filterCount(value) }}
                  </span>
                </span>
              </template>
            </component>
          </TabsContent>

          <TabsContent value="sorters" class="as-config-tab-content">
            <component
              :is="SortersConfig"
              :columns="sortableColumns"
              :force-sorters="state.forceSorters.value"
              v-model="sortersModel"
            />
          </TabsContent>
        </TabsRoot>

        <div class="as-config-tab-summary">
          <span class="as-config-tab-summary-count">
            {{ summaryText[0]
            }}<span v-if="summaryText[1]" class="as-config-tab-summary-count-num">{{
              summaryText[1]
            }}</span
            >{{ summaryText[2] }}
          </span>
          <span class="as-config-tab-summary-hint">
            {{ t(tabSummary.hint) }}
          </span>
        </div>

        <div class="as-config-dialog-footer">
          <button
            v-if="activeTab === 'sorters' && sortersModel.length > 0"
            type="button"
            class="as-filter-btn-ghost"
            @click="sortersModel = []"
          >
            {{ t("UI_CLEAR_ALL") }}
          </button>
          <div class="as-filter-dialog-footer-right">
            <button type="button" class="as-filter-btn" @click="onCancel">
              {{ t("UI_CANCEL") }}
            </button>
            <button type="button" class="as-filter-btn-apply" @click="onApply">
              {{ t("UI_APPLY") }}
            </button>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
