<script setup lang="ts">
import { computed, inject, useTemplateRef } from "vue";
import { isObjectField, type FormObjectFieldDef } from "@atscript/ui";
import type { TAsComponentProps } from "../types";
import { useAsUnionVariant, formatIndexedLabel } from "../../composables/use-form-context";
import { PATH_PREFIX_KEY } from "../../composables/internal-keys";
import { useAsNestedSectionsStore } from "../../composables/use-as-nested-sections-store";
import AsIterator from "../as-iterator.vue";
import AsCollapsible from "../internal/as-collapsible.vue";
import AsOptionalClear from "../internal/as-optional-clear.vue";
import AsVariantPicker from "../internal/as-variant-picker.vue";

const props = defineProps<TAsComponentProps>();
// Declared so Vue doesn't warn about the framework-bound `@action` listener
// reaching this component's fragment template.
defineEmits<{ (e: "action", name: string): void }>();

const objectDef = computed(() =>
  isObjectField(props.field!) ? (props.field as FormObjectFieldDef).objectDef : undefined,
);

const path = inject(
  PATH_PREFIX_KEY,
  computed(() => ""),
);
// Treat both undefined and null as "unset" — DB-roundtripped null (SQL NULL) renders empty-state, not the object body.
const optionalEnabled = computed(() => props.model?.value != null);

// Cleared on consume so nested children don't re-render the picker.
const unionCtx = useAsUnionVariant();
const hasVariantPicker = computed(() => unionCtx !== undefined && unionCtx.variants.length > 1);

const level = computed(() => props.level ?? 0);
const isRoot = computed(() => level.value <= 0);

const displayTitle = computed(
  () => formatIndexedLabel(props.title, props.arrayIndex) ?? props.name ?? "",
);

const store = useAsNestedSectionsStore();
const collapsibleRef = useTemplateRef<{
  runAndFocus: (action: () => void, ticks?: number) => void;
}>("collapsibleRef");

function handleAddData(): void {
  // Two ticks: one for the optional toggle to render `<details>`, one for the
  // store-driven `open` flip to expand its body so the focus query finds inputs.
  collapsibleRef.value?.runAndFocus(() => {
    props.onToggleOptional?.(true);
    if (path.value) store?.setOpen(path.value, true);
  }, 2);
}
</script>

<template>
  <template v-if="isRoot">
    <h2 v-if="title" class="as-form-title">{{ title }}</h2>
    <p v-if="description" class="as-form-description">{{ description }}</p>
    <div v-if="objectDef" class="as-form-grid" :class="$props.class">
      <AsIterator :def="objectDef" />
    </div>
  </template>

  <AsCollapsible
    v-else
    ref="collapsibleRef"
    :class="$props.class"
    :title="title"
    :array-index="arrayIndex"
    :description="description"
    :level="level"
    :optional="!!optional"
    :optional-enabled="optionalEnabled"
    :path="path"
    :error="error"
    :hidden="hidden"
    :default-open="arrayIndex !== undefined"
  >
    <template #title-extras>
      <AsVariantPicker v-if="hasVariantPicker" :union-context="unionCtx!" :disabled="disabled" />
    </template>

    <template #actions>
      <button
        v-if="onRemove"
        type="button"
        class="as-field-remove-btn"
        :disabled="!canRemove"
        aria-label="Remove"
        title="Remove"
        @click.stop.prevent="onRemove"
      >
        <span class="as-field-remove-btn-icon" aria-hidden="true" />
      </button>
      <AsOptionalClear
        v-else-if="optional && optionalEnabled"
        :label="displayTitle"
        @clear="onToggleOptional?.(false)"
      />
    </template>

    <template #body>
      <AsIterator v-if="objectDef" :def="objectDef" />
    </template>

    <template #empty>
      <div class="as-object-empty as-grid-item" :class="$props.class" v-show="!hidden">
        <button type="button" class="as-object-empty-add" @click="handleAddData">
          <span class="i-as-field-fill as-object-empty-add-icon" aria-hidden="true" />
          Add {{ displayTitle }}
        </button>
        <p v-if="description" class="as-collapsible-description">{{ description }}</p>
      </div>
    </template>
  </AsCollapsible>
</template>
