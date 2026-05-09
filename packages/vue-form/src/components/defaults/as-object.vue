<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted } from "vue";
import { isObjectField, type FormObjectFieldDef } from "@atscript/ui";
import type { TAsComponentProps } from "../types";
import { useConsumeUnionContext, formatIndexedLabel } from "../../composables/use-form-context";
import { PATH_PREFIX_KEY } from "../../composables/internal-keys";
import {
  DESCENDANT_ERROR_COUNTS_KEY,
  useNestedSectionsStore,
} from "../../composables/use-nested-sections";
import AsIterator from "../as-iterator.vue";
import AsVariantPicker from "../internal/as-variant-picker.vue";

const props = defineProps<TAsComponentProps>();
// Declared so Vue doesn't warn about the framework-bound `@action` listener
// reaching this component's fragment template.
defineEmits<{ (e: "action", name: string): void }>();

const objectDef = computed(() =>
  isObjectField(props.field!) ? (props.field as FormObjectFieldDef).objectDef : undefined,
);

// Absolute dotted path — keys both the sections store and the
// descendant-error map. Provided by AsField/AsIterator after appending
// the current segment.
const path = inject(
  PATH_PREFIX_KEY,
  computed(() => ""),
);
const optionalEnabled = computed(() => props.model?.value !== undefined);

// Union context — present when this struct is the body of a union variant.
// Cleared on consume so nested children don't re-render the picker.
const unionCtx = useConsumeUnionContext();
const hasVariantPicker = computed(() => unionCtx !== undefined && unionCtx.variants.length > 1);

const level = computed(() => props.level ?? 0);

// Alternation rule (see COLLAPSIBLE_NESTED.md):
//   L0          → root (no chrome, just iterate children)
//   L1, L3, L5… → section (clickable summary, top divider)
//   L2, L4, L6… → island (padded card, alternating layer)
const variant = computed<"root" | "section" | "island">(() => {
  const lvl = level.value;
  if (lvl <= 0) return "root";
  return lvl % 2 === 1 ? "section" : "island";
});

const containerClass = computed<string | string[]>(() => {
  if (variant.value === "section") return "as-object-section";
  const layer =
    ((level.value - 2) / 2) % 2 === 0 ? "as-object-island-even" : "as-object-island-odd";
  return ["as-object-island", layer];
});

const titleClass = computed(() =>
  level.value <= 1 ? "as-object-title" : "as-object-title-nested",
);

const headingTag = computed(() => (level.value <= 1 ? "h3" : "h4"));

const store = useNestedSectionsStore();

onMounted(() => {
  if (variant.value !== "root" && path.value) store?.register(path.value);
});
onBeforeUnmount(() => {
  if (variant.value !== "root" && path.value) store?.unregister(path.value);
});

const isOpen = computed(() =>
  variant.value === "root" ? true : (store?.isOpen(path.value) ?? false),
);

const displayTitle = computed(
  () => formatIndexedLabel(props.title, props.arrayIndex) ?? props.name ?? "",
);

// Native `<details>` toggle event — also fires when browser find-in-page
// auto-opens a closed details to reveal a match. `setOpen` is idempotent
// so we accept the DOM's truth without flipping.
function onNativeToggle(e: Event): void {
  if (variant.value === "root" || !path.value) return;
  store?.setOpen(path.value, (e.target as HTMLDetailsElement).open);
}

// Indexed lookup (built once at AsForm level) — surfaces "n errors hidden
// inside" on collapsed sections in O(1) instead of an N×M scan per change.
const descendantErrorCounts = inject(DESCENDANT_ERROR_COUNTS_KEY, undefined);
const descendantErrorCount = computed(() =>
  path.value ? (descendantErrorCounts?.value.get(path.value) ?? 0) : 0,
);
</script>

<template>
  <!-- L0 root: no chrome, just iterate children -->
  <template v-if="variant === 'root'">
    <AsIterator v-if="objectDef" :def="objectDef" />
  </template>

  <!-- Optional struct, not yet enabled: dashed island placeholder -->
  <div v-else-if="optional && !optionalEnabled" class="as-object-empty" v-show="!hidden">
    <div class="as-object-empty-content">
      <h3 class="as-object-empty-title">{{ displayTitle }}</h3>
      <p v-if="description" class="as-object-description">{{ description }}</p>
    </div>
    <button type="button" class="as-object-empty-add" @click="onToggleOptional?.(true)">
      + Add data
    </button>
  </div>

  <!-- Collapsible struct (section L1,L3,L5… or island L2,L4,L6…) -->
  <details
    v-else
    v-show="!hidden"
    :open="isOpen"
    :class="containerClass"
    :data-object-level="level"
    :data-object-path="path"
    @toggle="onNativeToggle"
  >
    <summary class="as-object-summary">
      <div class="as-object-header">
        <component :is="headingTag" :class="titleClass">{{ displayTitle }}</component>
        <p v-if="description" class="as-object-description">{{ description }}</p>
      </div>
      <AsVariantPicker v-if="hasVariantPicker" :union-context="unionCtx!" :disabled="disabled" />
      <button
        v-if="onRemove"
        type="button"
        class="as-field-remove-btn"
        :disabled="!canRemove"
        :aria-label="removeLabel || 'Remove item'"
        @click.stop.prevent="onRemove"
      >
        {{ removeLabel || "Remove" }}
      </button>
      <span
        v-if="!isOpen && descendantErrorCount > 0"
        class="as-object-error-badge"
        :aria-label="`${descendantErrorCount} error${descendantErrorCount === 1 ? '' : 's'} inside`"
      >
        {{ descendantErrorCount }}
      </span>
      <span
        class="as-object-chevron"
        :class="{ 'as-object-chevron-collapsed': !isOpen }"
        aria-hidden="true"
      />
    </summary>
    <div class="as-object-body">
      <div v-if="error" class="as-object-error" role="alert">{{ error }}</div>
      <AsIterator v-if="objectDef" :def="objectDef" />
    </div>
  </details>
</template>
