<script setup lang="ts">
import { computed } from "vue";
import { DropdownMenuItem } from "reka-ui";
import {
  ariaLabelFor,
  intentClass,
  isModClick,
  isPlainLeftClick,
} from "../../composables/state/intent-scope";
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
  /**
   * Resolved navigate href. When set and the action has no `promptText`, the
   * item renders as a real `<a href>` (`as="a"`): plain left click and
   * keyboard select route through `select` (SPA invoke path), while
   * modified/middle/right clicks reach the browser natively. With
   * `promptText`, the item stays a plain menu item and cmd/ctrl- or
   * middle-clicks emit `newtab` instead of selecting.
   */
  href?: string;
}>();

const emit = defineEmits<{
  (e: "select", event: Event): void;
  (e: "newtab"): void;
}>();

const asLink = computed(() => props.href !== undefined && !props.action.promptText);

// Modifier state of the pointer gesture currently turning into a click.
// Reka's `MenuItem` emits `select` with a synthetic `ITEM_SELECT` CustomEvent
// (no modifier info) and its click handler may run before ours in the merged
// listener array, so modifiers are recorded on `pointerdown` — which always
// precedes `click` — and consumed in `onSelect`. Keyboard selection never
// fires `pointerdown`, so it stays `null` and selects normally.
let pointer: { nonPlain: boolean; newTabChord: boolean } | null = null;

function onPointerdown(e: PointerEvent) {
  pointer = {
    nonPlain: e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey,
    newTabChord: isModClick(e),
  };
}

/**
 * Anchor mode: intercept ONLY plain left clicks (including the synthetic
 * `click()` reka dispatches on keyboard select) so the SPA invoke path runs
 * instead of a full page load. Modified clicks keep their native default
 * (new tab / new window) — the browser owns them.
 */
function onClick(e: MouseEvent) {
  if (asLink.value && isPlainLeftClick(e)) e.preventDefault();
}

function onSelect(e: Event) {
  const p = pointer;
  pointer = null;
  if (p && props.href !== undefined) {
    // Anchor + modified click: no invoke, no emit — native anchor behaviour
    // already handled the navigation. The uncancelled select closes the menu.
    if (asLink.value && p.nonPlain) return;
    // promptText navigate item + cmd/ctrl-click: confirm → window.open.
    if (!asLink.value && p.newTabChord) {
      emit("newtab");
      return;
    }
  }
  emit("select", e);
}

/** Middle click on a promptText navigate item → confirm → new tab. Anchor
 * items skip this — the browser's native middle-click handles them. */
function onAuxclick(e: MouseEvent) {
  if (e.button !== 1 || props.href === undefined || asLink.value) return;
  e.preventDefault();
  emit("newtab");
}
</script>

<template>
  <DropdownMenuItem
    :as="asLink ? 'a' : 'div'"
    :href="asLink ? href : undefined"
    :class="[`${prefix}-menu-item`, intentClass(prefix, action)]"
    :data-default="props.default || undefined"
    :aria-label="ariaLabelFor(action)"
    @select="onSelect"
    @pointerdown="onPointerdown"
    @click="onClick"
    @auxclick="onAuxclick"
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
