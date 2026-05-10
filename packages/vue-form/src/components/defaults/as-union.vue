<script setup lang="ts">
import type { TAsComponentProps, TAsUnionContext } from "../types";
import { computed, inject, provide, ref } from "vue";
import { useAsUnion } from "../../composables/use-as-union";
import { useAsDropdown } from "../../composables/use-as-dropdown";
import { useAsNestedSectionsStore } from "../../composables/use-as-nested-sections-store";
import { PATH_PREFIX_KEY, TYPES_KEY, UNION_CONTEXT_KEY } from "../../composables/internal-keys";
import { focusNewFocusableAfter } from "../../composables/focus-after-toggle";

const props = defineProps<TAsComponentProps>();

const {
  unionField,
  hasMultipleVariants,
  localUnionIndex,
  innerField,
  changeVariant,
  optionalEnabled,
} = useAsUnion(props);

const types = inject(TYPES_KEY);

// Provided so the variant component renders the picker via useAsUnionVariant()
// (consume-and-clear so descendants don't double-render).
const unionCtx: TAsUnionContext | undefined = unionField.value
  ? {
      variants: unionField.value.unionVariants,
      currentIndex: localUnionIndex,
      changeVariant,
    }
  : undefined;
if (unionCtx) provide(UNION_CONTEXT_KEY, unionCtx);

const variantComponent = computed(() =>
  innerField.value ? types?.value?.[innerField.value.type] : undefined,
);

const fieldLabel = computed(() => props.title ?? props.label ?? props.name ?? "");

// `rootRef` binds to an HTMLElement (empty <div>) OR a Vue instance (active
// <component :is>). Unwrap to the DOM root for focus-scope querying.
const rootRef = ref<HTMLElement | { $el: HTMLElement } | null>(null);
const rootEl = (): HTMLElement | null => {
  const r = rootRef.value as { querySelectorAll?: unknown; $el?: HTMLElement } | null;
  if (!r) return null;
  if (typeof r.querySelectorAll === "function") return r as unknown as HTMLElement;
  return (r.$el as HTMLElement | undefined) ?? null;
};
const pickerDropdownRef = ref<HTMLElement | null>(null);
const {
  isOpen: pickerOpen,
  toggle: togglePicker,
  select: selectPicker,
} = useAsDropdown(pickerDropdownRef);

// Pre-set the variant's section open in the store before it mounts so the
// variant's AsCollapsible reads `open` on first render — without this, picking
// a variant lands on a closed section and the focus query finds no inputs.
const path = inject(
  PATH_PREFIX_KEY,
  computed(() => ""),
);
const store = useAsNestedSectionsStore();

function pickAndFocus(vi: number) {
  void focusNewFocusableAfter(
    () => {
      changeVariant(vi);
      if (path.value) store?.setOpen(path.value, true);
    },
    rootEl,
    2,
  );
}

function handleEmptyClick() {
  if (hasMultipleVariants.value) {
    togglePicker();
    return;
  }
  pickAndFocus(0);
}

function handleVariantPick(vi: number) {
  selectPicker(() => pickAndFocus(vi));
}
</script>

<template>
  <div
    v-if="optional && !optionalEnabled"
    ref="rootRef"
    class="as-object-empty as-grid-item"
    :class="$props.class"
    v-show="!hidden"
  >
    <div v-if="hasMultipleVariants" ref="pickerDropdownRef" class="as-dropdown">
      <button type="button" class="as-object-empty-add" @click="handleEmptyClick">
        <span class="i-as-field-fill as-object-empty-add-icon" aria-hidden="true" />
        Add {{ fieldLabel }}
      </button>
      <div v-if="pickerOpen" class="as-dropdown-menu">
        <button
          v-for="(v, vi) in unionField!.unionVariants"
          :key="vi"
          type="button"
          class="as-dropdown-item"
          @click="handleVariantPick(vi)"
        >
          {{ v.label }}
        </button>
      </div>
    </div>
    <button v-else type="button" class="as-object-empty-add" @click="handleEmptyClick">
      <span class="i-as-field-fill as-object-empty-add-icon" aria-hidden="true" />
      Add {{ fieldLabel }}
    </button>
    <p v-if="description" class="as-collapsible-description">{{ description }}</p>
  </div>

  <!-- Active: dispatch to variant's component, forwarding the field's @meta.label
       as title so the variant's chrome shows it (innerField.type overrides "union"). -->
  <component
    v-else-if="variantComponent && innerField"
    ref="rootRef"
    :is="variantComponent"
    v-bind="$props"
    :field="innerField"
    :type="innerField.type"
    :title="fieldLabel"
    :key="localUnionIndex"
  />
</template>
