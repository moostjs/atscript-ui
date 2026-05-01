<script setup lang="ts">
import { DropdownMenuItem } from "reka-ui";
import { ariaLabelFor, intentClass } from "../../composables/state/intent-scope";
import type { TVueTableActionInfo } from "../../types";

const props = defineProps<{
  action: TVueTableActionInfo;
  /**
   * Class prefix shared by the consuming surface — e.g. `"as-row-actions"`
   * or `"as-table-actions"`. The atom composes `${prefix}-menu-item`,
   * `${prefix}-menu-item-icon`, `${prefix}-menu-item-label`, and the intent
   * variant `${prefix}-intent-{intent}` against this prefix. Consumers
   * declare the runtime classes in their `.vue` file's safelist comment.
   */
  prefix: string;
  /** Marks this entry as the level's declared default action (`data-default`). */
  default?: boolean;
}>();

defineEmits<{ (e: "select", event: Event): void }>();
</script>

<template>
  <DropdownMenuItem
    :class="[`${prefix}-menu-item`, intentClass(prefix, action)]"
    :data-default="props.default || undefined"
    :aria-label="ariaLabelFor(action)"
    @select="$emit('select', $event)"
  >
    <slot :action="action">
      <span
        v-if="action.icon"
        :class="[`${prefix}-menu-item-icon`, action.icon]"
        aria-hidden="true"
      />
      <span :class="`${prefix}-menu-item-label`">{{ action.label || action.name }}</span>
    </slot>
  </DropdownMenuItem>
</template>
