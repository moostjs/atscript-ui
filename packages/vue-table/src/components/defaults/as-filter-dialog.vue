<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { ColumnDef } from "@atscript/ui";
import {
  columnFilterType,
  defaultCondition,
  formatFilterCondition,
  isFilled,
  isSimpleEq,
  type FilterCondition,
  type FilterConditionType,
} from "@atscript/ui-table";
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogClose,
  TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "reka-ui";
import { useTableContext } from "../../composables/use-table-state";
import AsFilterConditions from "../internal/as-filter-conditions.vue";
import AsFilterValueHelp from "../internal/as-filter-value-help.vue";

const { state } = useTableContext();

const isOpen = computed({
  get: () => state.filterDialogColumn.value !== null,
  set: (val: boolean) => {
    if (!val) state.closeFilterDialog();
  },
});

const column = computed<ColumnDef | null>(() => state.filterDialogColumn.value);

const hasValueHelp = computed(
  () =>
    !!column.value &&
    (!!column.value.valueHelpInfo ||
      (column.value.options != null && column.value.options.length > 0)),
);

const defCondition = computed<FilterConditionType>(() =>
  column.value ? defaultCondition(columnFilterType(column.value.type)) : "eq",
);

const valueHelpConditions = ref<FilterCondition[]>([]);
const freeConditions = ref<FilterCondition[]>([]);
const activeTab = ref<"value-help" | "conditions">("value-help");

watch(column, (col) => {
  if (!col) return;
  const existing = state.filters.value[col.path] ?? [];
  if (hasValueHelp.value) {
    valueHelpConditions.value = existing.filter(isSimpleEq);
    freeConditions.value = existing.filter((c) => !isSimpleEq(c));
  } else {
    valueHelpConditions.value = [];
    freeConditions.value = existing.length > 0 ? [...existing] : [];
  }
  if (freeConditions.value.length === 0) {
    freeConditions.value = [{ type: defCondition.value, value: [] }];
  }
  activeTab.value = hasValueHelp.value ? "value-help" : "conditions";
});

interface ChipItem {
  key: string;
  label: string;
  bucket: "value-help" | "free";
  index: number;
}

const CHIP_PREVIEW_LIMIT = 10;

const chips = computed<ChipItem[]>(() => {
  const result: ChipItem[] = [];
  valueHelpConditions.value.forEach((c, i) => {
    if (isFilled(c)) {
      result.push({
        key: `vh:${i}:${String(c.value[0] ?? "")}`,
        label: formatFilterCondition(c),
        bucket: "value-help",
        index: i,
      });
    }
  });
  freeConditions.value.forEach((c, i) => {
    if (isFilled(c)) {
      result.push({
        key: `fc:${i}:${c.type}:${String(c.value[0] ?? "")}`,
        label: formatFilterCondition(c),
        bucket: "free",
        index: i,
      });
    }
  });
  return result;
});

const visibleChips = computed(() => chips.value.slice(0, CHIP_PREVIEW_LIMIT));
const hiddenChipCount = computed(() => Math.max(0, chips.value.length - CHIP_PREVIEW_LIMIT));

function removeChip(chip: ChipItem) {
  if (chip.bucket === "value-help") {
    valueHelpConditions.value = valueHelpConditions.value.filter((_, i) => i !== chip.index);
  } else {
    const next = freeConditions.value.filter((_, i) => i !== chip.index);
    freeConditions.value = next.length > 0 ? next : [{ type: defCondition.value, value: [] }];
  }
}

function clearAll() {
  valueHelpConditions.value = [];
  freeConditions.value = [{ type: defCondition.value, value: [] }];
}

function onApply() {
  if (!column.value) return;
  const merged = [...valueHelpConditions.value, ...freeConditions.value.filter(isFilled)];
  if (merged.length > 0) {
    state.setFieldFilter(column.value.path, merged);
  } else {
    state.removeFieldFilter(column.value.path);
  }
  state.closeFilterDialog();
}

function onCancel() {
  state.closeFilterDialog();
}
</script>

<template>
  <DialogRoot v-model:open="isOpen">
    <DialogPortal>
      <DialogOverlay class="as-filter-dialog-overlay" />
      <DialogContent
        class="as-filter-dialog-content"
        :class="{ 'as-filter-dialog-has-value-help': hasValueHelp }"
      >
        <div class="as-filter-dialog-header">
          <DialogTitle class="as-filter-dialog-title">
            <span class="as-filter-dialog-title-label">Filter</span>
            <span class="as-filter-dialog-title-value">{{ column?.label }}</span>
          </DialogTitle>
          <DialogClose class="as-filter-dialog-close" aria-label="Close">
            <span class="i-as-close" aria-hidden="true" />
          </DialogClose>
        </div>

        <TabsRoot v-if="column && hasValueHelp" v-model="activeTab" class="as-filter-dialog-tabs">
          <TabsList class="as-config-tabs-list">
            <TabsTrigger value="value-help" class="as-config-tab-trigger">
              Values
              <span
                v-if="valueHelpConditions.length > 0"
                class="as-config-tab-count"
                :class="{ 'as-config-tab-count-active': activeTab === 'value-help' }"
              >
                {{ valueHelpConditions.length }}
              </span>
            </TabsTrigger>
            <TabsTrigger value="conditions" class="as-config-tab-trigger">
              Conditions
              <span
                v-if="freeConditions.filter((c) => isFilled(c)).length > 0"
                class="as-config-tab-count"
                :class="{ 'as-config-tab-count-active': activeTab === 'conditions' }"
              >
                {{ freeConditions.filter((c) => isFilled(c)).length }}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="value-help" class="as-filter-dialog-tab-content">
            <AsFilterValueHelp :column="column" v-model="valueHelpConditions" />
          </TabsContent>

          <TabsContent
            value="conditions"
            class="as-filter-dialog-tab-content as-filter-dialog-tab-conditions"
          >
            <AsFilterConditions :column="column" v-model="freeConditions" />
          </TabsContent>
        </TabsRoot>

        <div v-else-if="column" class="as-filter-dialog-body">
          <AsFilterConditions :column="column" v-model="freeConditions" />
        </div>

        <div v-if="chips.length > 0" class="as-filter-dialog-chips-bar">
          <div class="as-filter-dialog-chips-header">
            <span>
              <span class="as-filter-dialog-chips-count">{{ chips.length }}</span>
              {{ chips.length === 1 ? "condition" : "conditions" }} applied
            </span>
            <button type="button" class="as-filter-dialog-clear-all" @click="clearAll">
              Clear all
            </button>
          </div>
          <div class="as-filter-dialog-chips">
            <span v-for="chip in visibleChips" :key="chip.key" class="as-filter-dialog-chip">
              {{ chip.label }}
              <button
                type="button"
                class="as-filter-dialog-chip-remove"
                aria-label="Remove"
                @click="removeChip(chip)"
              >
                <span class="i-as-close" aria-hidden="true" />
              </button>
            </span>
            <span v-if="hiddenChipCount > 0" class="as-filter-dialog-chips-more">
              +{{ hiddenChipCount }} more
            </span>
          </div>
        </div>

        <div class="as-filter-dialog-footer">
          <div class="as-filter-dialog-footer-right">
            <button type="button" class="as-filter-btn" @click="onCancel">Cancel</button>
            <button type="button" class="as-filter-btn-apply" @click="onApply">Apply</button>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
