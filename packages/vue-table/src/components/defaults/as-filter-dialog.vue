<script setup lang="ts">
import { computed, watch, shallowRef } from "vue";
import { conditionLabel, dateShortcuts } from "@atscript/ui-table";
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "reka-ui";
import { useTableContext } from "../../composables/use-table-state";
import { useTableFilter } from "../../composables/use-table-filter";
import AsFilterInput from "./as-filter-input.vue";

const { state } = useTableContext();

const isOpen = computed({
  get: () => state.filterDialogColumn.value !== null,
  set: (val: boolean) => {
    if (!val) state.closeFilterDialog();
  },
});

type FilterState = ReturnType<typeof useTableFilter>;
const filter = shallowRef<FilterState | null>(null);

watch(
  () => state.filterDialogColumn.value,
  (column) => {
    if (column) {
      filter.value = useTableFilter(column, state);
    } else {
      filter.value = null;
    }
  },
);

const isDateType = computed(() => filter.value?.filterType === "date");
const shortcuts = computed(() => (isDateType.value ? dateShortcuts() : []));

function applyShortcut(dates: [string, string]) {
  if (!filter.value) return;
  filter.value.conditions.value = [{ type: "bw", value: [dates[0], dates[1]] }];
}

function onApply() {
  filter.value?.apply();
  state.closeFilterDialog();
}

function onClear() {
  filter.value?.clear();
  state.closeFilterDialog();
}

function onCancel() {
  filter.value?.reset();
  state.closeFilterDialog();
}
</script>

<template>
  <DialogRoot v-model:open="isOpen">
    <DialogPortal>
      <DialogOverlay class="as-filter-dialog-overlay" />
      <DialogContent class="as-filter-dialog-content">
        <div class="as-filter-dialog-header">
          <DialogTitle class="as-filter-dialog-title">
            Filter: {{ state.filterDialogColumn.value?.label }}
          </DialogTitle>
          <DialogClose class="as-filter-dialog-close" aria-label="Close"> &times; </DialogClose>
        </div>

        <div v-if="filter" class="as-filter-dialog-body">
          <!-- Condition rows -->
          <div
            v-for="(cond, index) in filter.conditions.value"
            :key="index"
            class="as-filter-condition-row"
          >
            <select
              class="as-filter-condition-select"
              :value="cond.type"
              @change="
                filter.updateCondition(index, {
                  type: ($event.target as HTMLSelectElement).value as any,
                  value: [],
                })
              "
            >
              <option v-for="ct in filter.availableConditions" :key="ct" :value="ct">
                {{ conditionLabel(ct) }}
              </option>
            </select>

            <AsFilterInput
              :column="state.filterDialogColumn.value!"
              :condition="cond"
              :filter-type="filter.filterType"
              @update:condition="(c) => filter!.updateCondition(index, c)"
            />

            <button
              v-if="filter.conditions.value.length > 1"
              type="button"
              class="as-filter-condition-remove"
              aria-label="Remove condition"
              @click="filter.removeCondition(index)"
            >
              &times;
            </button>
          </div>

          <button type="button" class="as-filter-add-condition" @click="filter.addCondition()">
            + Add condition
          </button>

          <!-- Date shortcuts -->
          <div v-if="isDateType && shortcuts.length > 0" class="as-filter-shortcuts">
            <span class="as-filter-shortcuts-label">Quick:</span>
            <button
              v-for="sc in shortcuts"
              :key="sc.label"
              type="button"
              class="as-filter-shortcut-btn"
              @click="applyShortcut(sc.dates)"
            >
              {{ sc.label }}
            </button>
          </div>
        </div>

        <div class="as-filter-dialog-footer">
          <button type="button" class="as-filter-btn as-filter-btn-clear" @click="onClear">
            Clear
          </button>
          <div class="as-filter-dialog-footer-right">
            <button type="button" class="as-filter-btn as-filter-btn-cancel" @click="onCancel">
              Cancel
            </button>
            <button type="button" class="as-filter-btn as-filter-btn-apply" @click="onApply">
              Apply
            </button>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
