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
  /**
   * Per-action resolved navigate href (see `actionHref`). `undefined` (per
   * action or wholesale) keeps the classic menu item + `select` path; a
   * string turns navigate items into real anchors / new-tab-able prompts.
   */
  hrefFor?: (action: TVueTableActionInfo) => string | undefined;
}>();

defineEmits<{
  (e: "select", action: TVueTableActionInfo, event: KeyboardEvent | MouseEvent): void;
  /** Mod/middle-click on a promptText navigate item — confirm → `window.open`. */
  (e: "newtab", action: TVueTableActionInfo): void;
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
        :href="hrefFor?.(action)"
        @select="$emit('select', action, $event as KeyboardEvent | MouseEvent)"
        @newtab="$emit('newtab', action)"
      >
        <template v-if="slots['menu-item']" #default="slotProps">
          <slot name="menu-item" :action="slotProps.action" />
        </template>
      </AsActionMenuItem>
    </template>
  </DropdownMenuContent>
</template>
