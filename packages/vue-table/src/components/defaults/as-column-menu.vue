<script setup lang="ts">
import { computed, ref } from "vue";
import type { ColumnDef } from "@atscript/ui";
import type { FilterCondition } from "@atscript/ui-table";
import { isFilled } from "@atscript/ui-table";
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "reka-ui";
import type { ColumnMenuConfig } from "../../types";

const props = defineProps<{
  column: ColumnDef;
  order?: "asc" | "desc" | null;
  filters?: FilterCondition[];
  config: ColumnMenuConfig;
}>();

const open = ref(false);

const emit = defineEmits<{
  (e: "sort", direction: "asc" | "desc" | null): void;
  (e: "hide"): void;
  (e: "filter"): void;
  (e: "filters-off"): void;
}>();

function emitSort(direction: "asc" | "desc") {
  if (direction === props.order) {
    emit("sort", null);
  } else {
    emit("sort", direction);
  }
}

const showSort = computed(() => props.config.sort && props.column.sortable);
const showFilters = computed(() => props.config.filters && props.column.filterable);
const showHide = computed(() => props.config.hide);
const filledCount = computed(() => props.filters?.filter(isFilled).length ?? 0);
</script>

<template>
  <DropdownMenuRoot :modal="false" v-model:open="open">
    <DropdownMenuTrigger as-child>
      <slot :open="open" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent class="as-column-menu-content" :side-offset="4" align="start">
        <template v-if="showSort">
          <DropdownMenuItem
            class="as-column-menu-item"
            :class="{ 'as-column-menu-item-active': order === 'asc' }"
            @select="emitSort('asc')"
          >
            &#x25B2; Sort Ascending
          </DropdownMenuItem>
          <DropdownMenuItem
            class="as-column-menu-item"
            :class="{ 'as-column-menu-item-active': order === 'desc' }"
            @select="emitSort('desc')"
          >
            &#x25BC; Sort Descending
          </DropdownMenuItem>
        </template>
        <DropdownMenuSeparator
          v-if="showSort && (showFilters || showHide)"
          class="as-column-menu-separator"
        />
        <DropdownMenuItem v-if="showFilters" class="as-column-menu-item" @select="emit('filter')">
          &#x1F50D; {{ filledCount ? `Filters (${filledCount})` : "Filters" }}
        </DropdownMenuItem>
        <DropdownMenuItem
          v-if="showFilters && filledCount"
          class="as-column-menu-item"
          @select="emit('filters-off')"
        >
          &#x2716; Clear Filters
        </DropdownMenuItem>
        <DropdownMenuSeparator v-if="showFilters && showHide" class="as-column-menu-separator" />
        <DropdownMenuItem v-if="showHide" class="as-column-menu-item" @select="emit('hide')">
          &#x2716; Hide Column
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
