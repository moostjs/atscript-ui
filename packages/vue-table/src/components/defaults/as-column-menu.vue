<script setup lang="ts">
import type { ColumnDef } from "@atscript/ui";
import {
  ContextMenuRoot,
  ContextMenuTrigger,
  ContextMenuPortal,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "reka-ui";

const props = withDefaults(
  defineProps<{
    column: ColumnDef;
    config?: { sort?: boolean; filters?: boolean; hide?: boolean };
  }>(),
  {
    config: () => ({ sort: true, filters: true, hide: true }),
  },
);

const emit = defineEmits<{
  (e: "sort", direction: "asc" | "desc"): void;
  (e: "hide"): void;
  (e: "filter"): void;
}>();
</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent class="as-column-menu-content" :side-offset="4" align="start">
        <template v-if="config.sort && props.column.sortable">
          <ContextMenuItem class="as-column-menu-item" @select="emit('sort', 'asc')">
            &#x25B2; Sort Ascending
          </ContextMenuItem>
          <ContextMenuItem class="as-column-menu-item" @select="emit('sort', 'desc')">
            &#x25BC; Sort Descending
          </ContextMenuItem>
        </template>
        <ContextMenuSeparator
          v-if="config.sort && props.column.sortable && (config.filters || config.hide)"
          class="as-column-menu-separator"
        />
        <ContextMenuItem
          v-if="config.filters && props.column.filterable"
          class="as-column-menu-item"
          @select="emit('filter')"
        >
          &#x1F50D; Filter
        </ContextMenuItem>
        <ContextMenuItem v-if="config.hide" class="as-column-menu-item" @select="emit('hide')">
          &#x2716; Hide Column
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
