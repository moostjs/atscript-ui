<script lang="ts">
// Multi-root template (empty slot vs <details>) — class is forwarded
// explicitly to the right branch, so Vue's auto-inherit must be off.
export default { inheritAttrs: false };
</script>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted } from "vue";
import {
  DESCENDANT_ERROR_COUNTS_KEY,
  useAsNestedSectionsStore,
} from "../composables/use-as-nested-sections-store";
import { useAsFocusFirstAfter } from "../composables/focus-after-toggle";
import { formatIndexedLabelParts } from "../composables/use-form-context";
import type { TAsCollapsibleProps, TAsCollapsibleSlots } from "./types";

const props = withDefaults(defineProps<TAsCollapsibleProps>(), { defaultOpen: false });

const titleParts = computed(() => formatIndexedLabelParts(props.title, props.arrayIndex));

defineSlots<TAsCollapsibleSlots>();

// Alternation rule (see COLLAPSIBLE_NESTED.md):
//   L0          → root (no chrome, just render body)
//   L1, L3, L5… → section (clickable summary, top divider)
//   L2, L4, L6… → island (padded card, alternating layer)
const variant = computed<"root" | "section" | "island">(() => {
  const lvl = props.level;
  if (lvl <= 0) return "root";
  return lvl % 2 === 1 ? "section" : "island";
});

const containerClass = computed<string | string[]>(() => {
  if (variant.value === "section") return "as-collapsible-section";
  const layer =
    ((props.level - 2) / 2) % 2 === 0 ? "as-collapsible-island-even" : "as-collapsible-island-odd";
  return ["as-collapsible-island", layer];
});

const titleClass = computed(() =>
  props.level <= 1 ? "as-collapsible-title" : "as-collapsible-title-nested",
);

const headingTag = computed(() => (props.level <= 1 ? "h3" : "h4"));

const store = useAsNestedSectionsStore();

onMounted(() => {
  if (variant.value !== "root" && props.path) {
    store?.register(props.path);
    if (props.defaultOpen) store?.setOpen(props.path, true);
  }
});
onBeforeUnmount(() => {
  if (variant.value !== "root" && props.path) store?.unregister(props.path);
});

const isOpen = computed(() =>
  variant.value === "root" ? true : (store?.isOpen(props.path) ?? false),
);

// Native `<details>` toggle event also fires when browser find-in-page
// auto-opens a closed details to reveal a match — `setOpen` is idempotent
// so we accept the DOM's truth without flipping.
function onNativeToggle(e: Event): void {
  if (variant.value === "root" || !props.path) return;
  store?.setOpen(props.path, (e.target as HTMLDetailsElement).open);
}

// Indexed lookup (built once at AsForm level) — surfaces "n errors hidden
// inside" on collapsed sections in O(1) instead of an N×M scan per change.
const descendantErrorCounts = inject(DESCENDANT_ERROR_COUNTS_KEY, undefined);
const descendantErrorCount = computed(() =>
  props.path ? (descendantErrorCounts?.value.get(props.path) ?? 0) : 0,
);

// `rootRef` is null while the empty slot renders; it binds to `<details>`
// on the next tick after `optionalEnabled` flips, so the deferred focus
// query lands on the freshly mounted subtree.
const { rootRef, runAndFocus, runAndFocusNew } = useAsFocusFirstAfter();

defineExpose({ runAndFocus, runAndFocusNew });
</script>

<template>
  <slot v-if="optional && !optionalEnabled" name="empty" />

  <details
    v-else
    ref="rootRef"
    v-show="!hidden"
    :open="isOpen"
    :class="[containerClass, 'as-grid-item', $attrs.class as string]"
    :data-object-level="level"
    @toggle="onNativeToggle"
  >
    <summary class="as-collapsible-summary">
      <div class="as-collapsible-header">
        <div class="as-collapsible-title-row">
          <component :is="headingTag" :class="titleClass">
            {{ titleParts?.base
            }}<span v-if="titleParts?.suffix" class="as-collapsible-title-index"
              >&nbsp;{{ titleParts.suffix }}</span
            >
          </component>
          <slot name="title-extras" />
        </div>
        <p v-if="description" class="as-collapsible-description">{{ description }}</p>
      </div>
      <slot name="badges" />
      <slot name="actions" />
      <span
        v-if="!isOpen && descendantErrorCount > 0"
        class="as-collapsible-error-badge"
        :aria-label="`${descendantErrorCount} error${descendantErrorCount === 1 ? '' : 's'} inside`"
      >
        {{ descendantErrorCount }}
      </span>
      <span
        class="as-collapsible-chevron"
        :class="{ 'as-collapsible-chevron-collapsed': !isOpen }"
        aria-hidden="true"
      />
    </summary>
    <div class="as-collapsible-body">
      <div v-if="error" class="as-collapsible-error" role="alert">{{ error }}</div>
      <slot name="body" />
    </div>
  </details>
</template>
