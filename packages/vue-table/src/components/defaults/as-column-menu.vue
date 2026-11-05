<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { ColumnDef } from "@atscript/ui";
import type { ColumnWidthEntry, FilterCondition } from "@atscript/ui-table";
import { isColumnFilterable, isFilled } from "@atscript/ui-table";
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "reka-ui";
import type { ColumnMenuConfig } from "../../types";
import { useAsTexts } from "@atscript/vue-form/locale";

const props = defineProps<{
  column: ColumnDef;
  order?: "asc" | "desc" | null;
  filters?: FilterCondition[];
  config: ColumnMenuConfig;
  widthEntry?: ColumnWidthEntry;
}>();

const { t } = useAsTexts();
const open = ref(false);

const emit = defineEmits<{
  (e: "sort", direction: "asc" | "desc" | null): void;
  (e: "hide"): void;
  (e: "filter"): void;
  (e: "filters-off"): void;
  (e: "reset-width"): void;
}>();

function emitSort(direction: "asc" | "desc") {
  if (direction === props.order) {
    emit("sort", null);
  } else {
    emit("sort", direction);
  }
}

const showSort = computed(() => props.config.sort && props.column.sortable);
const showFilters = computed(() => props.config.filters && isColumnFilterable(props.column));
const showHide = computed(() => props.config.hide);
const showResetWidth = computed(
  () => props.config.resetWidth && !!props.widthEntry && props.widthEntry.w !== props.widthEntry.d,
);
const filledCount = computed(() => props.filters?.filter(isFilled).length ?? 0);
const hasAnyItem = computed(
  () => showSort.value || showFilters.value || showResetWidth.value || showHide.value,
);

function onKeydown(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const key = e.key.toLowerCase();
  if (key === "a" && showSort.value) {
    emitSort("asc");
  } else if (key === "d" && showSort.value) {
    emitSort("desc");
  } else if (key === "f" && showFilters.value) {
    emit("filter");
  } else if (key === "c" && showFilters.value && filledCount.value > 0) {
    emit("filters-off");
  } else if (key === "w" && showResetWidth.value) {
    emit("reset-width");
  } else if (key === "h" && showHide.value) {
    emit("hide");
  } else {
    return;
  }
  e.preventDefault();
  open.value = false;
}

watch(open, (isOpen) => {
  if (isOpen) {
    window.addEventListener("keydown", onKeydown);
  } else {
    window.removeEventListener("keydown", onKeydown);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <slot v-if="!hasAnyItem" :open="false" :hasMenu="false" />
  <DropdownMenuRoot v-else :modal="false" v-model:open="open">
    <DropdownMenuTrigger as-child>
      <slot :open="open" :hasMenu="true" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent class="as-column-menu-content" :side-offset="4" align="start">
        <template v-if="showSort">
          <div class="as-column-menu-label">{{ t("UI_TABLE_SORT") }}</div>
          <DropdownMenuItem
            class="as-column-menu-item"
            :class="{ 'as-column-menu-item-active': order === 'asc' }"
            @select="emitSort('asc')"
          >
            <span class="as-column-menu-item-icon i-as-arrow-up" aria-hidden="true" />
            <span class="as-column-menu-item-label">{{ t("UI_TABLE_ASCENDING") }}</span>
            <span class="as-column-menu-item-hint">A</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            class="as-column-menu-item"
            :class="{ 'as-column-menu-item-active': order === 'desc' }"
            @select="emitSort('desc')"
          >
            <span class="as-column-menu-item-icon i-as-arrow-down" aria-hidden="true" />
            <span class="as-column-menu-item-label">{{ t("UI_TABLE_DESCENDING") }}</span>
            <span class="as-column-menu-item-hint">D</span>
          </DropdownMenuItem>
        </template>
        <DropdownMenuSeparator
          v-if="showSort && (showFilters || showHide)"
          class="as-column-menu-separator"
        />
        <DropdownMenuItem
          v-if="showFilters"
          class="as-column-menu-item"
          :class="{ 'as-column-menu-item-active': filledCount > 0 }"
          @select="emit('filter')"
        >
          <span class="as-column-menu-item-icon i-as-filter" aria-hidden="true" />
          <span class="as-column-menu-item-label">{{ t("UI_TABLE_FILTER_MENU") }}</span>
          <span v-if="filledCount" class="as-column-menu-item-badge">{{ filledCount }}</span>
          <span class="as-column-menu-item-hint">F</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          v-if="showFilters && filledCount"
          class="as-column-menu-item"
          @select="emit('filters-off')"
        >
          <span class="as-column-menu-item-icon i-as-close" aria-hidden="true" />
          <span class="as-column-menu-item-label">{{ t("UI_TABLE_CLEAR_FILTERS") }}</span>
          <span class="as-column-menu-item-hint">C</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator
          v-if="showFilters && (showResetWidth || showHide)"
          class="as-column-menu-separator"
        />
        <DropdownMenuItem
          v-if="showResetWidth"
          class="as-column-menu-item"
          @select="emit('reset-width')"
        >
          <span class="as-column-menu-item-icon i-as-refresh" aria-hidden="true" />
          <span class="as-column-menu-item-label">{{ t("UI_TABLE_RESET_WIDTH") }}</span>
          <span class="as-column-menu-item-hint">W</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator v-if="showResetWidth && showHide" class="as-column-menu-separator" />
        <DropdownMenuItem
          v-if="showHide"
          class="as-column-menu-item as-column-menu-item-danger"
          @select="emit('hide')"
        >
          <span class="as-column-menu-item-icon i-as-eye-slash" aria-hidden="true" />
          <span class="as-column-menu-item-label">{{ t("UI_TABLE_HIDE_COLUMN") }}</span>
          <span class="as-column-menu-item-hint">H</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
