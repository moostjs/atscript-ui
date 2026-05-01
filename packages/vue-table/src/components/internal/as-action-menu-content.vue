<script setup lang="ts">
import { computed, useSlots } from "vue";
import { DropdownMenuContent, DropdownMenuSeparator } from "reka-ui";
import AsActionMenuItem from "./as-action-menu-item.vue";
import type { TVueTableActionInfo } from "../../types";

const props = defineProps<{
  /** Empty groups are dropped — separators only land between rendered groups. */
  groups: TVueTableActionInfo[][];
  /** Action rendered with `data-default` (and the level's default-styling). */
  defaultMarker?: TVueTableActionInfo;
  /** Class prefix shared with the consumer (`as-row-actions` / `as-table-actions`). */
  prefix: string;
}>();

defineEmits<{
  (e: "select", action: TVueTableActionInfo, event: KeyboardEvent | MouseEvent): void;
}>();

const slots = useSlots();
const visibleGroups = computed(() => props.groups.filter((g) => g.length > 0));
</script>

<template>
  <DropdownMenuContent :class="`${prefix}-menu`" :side-offset="4" align="end">
    <template v-for="(group, gIdx) in visibleGroups" :key="gIdx">
      <DropdownMenuSeparator v-if="gIdx > 0" :class="`${prefix}-menu-separator`" />
      <AsActionMenuItem
        v-for="(action, aIdx) in group"
        :key="`${gIdx}-${action.name}-${aIdx}`"
        :action="action"
        :prefix="prefix"
        :default="action === defaultMarker"
        @select="$emit('select', action, $event as KeyboardEvent | MouseEvent)"
      >
        <template v-if="slots['menu-item']" #default="slotProps">
          <slot name="menu-item" :action="slotProps.action" />
        </template>
      </AsActionMenuItem>
    </template>
  </DropdownMenuContent>
</template>
