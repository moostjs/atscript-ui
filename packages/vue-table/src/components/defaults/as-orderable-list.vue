<script setup lang="ts" generic="T extends Record<string, unknown>">
import { ref, computed, watch, type UnwrapRef } from "vue";
import {
  ListboxRoot,
  ListboxFilter,
  ListboxContent,
  ListboxItem,
  ListboxItemIndicator,
} from "reka-ui";

type TModelItem = { label: string; value: string; data: T; index: number };

const props = defineProps<{
  items: T[];
  disabled?: string[];
  getLabel: (item: T) => string;
  getValue: (item: T) => string;
}>();

const modelValue = defineModel<string[]>({ default: () => [] });

const itemsMap = computed(() => {
  const m = new Map<string, Omit<TModelItem, "index">>();
  for (const item of props.items) {
    const value = props.getValue(item);
    m.set(value, { data: item, value, label: props.getLabel(item) });
  }
  return m;
});

const listBoxModel = ref<string[]>([]);

const disabledSet = computed(() => new Set(props.disabled));

const dragIndex = ref(-1);
const dragOverIndex = ref(-1);

const orderedItems = ref<TModelItem[]>([]);
const searchTerm = ref("");

const orderedItemsWithSearch = computed<TModelItem[]>(() => {
  if (!searchTerm.value.trim()) return orderedItems.value as TModelItem[];
  const term = searchTerm.value.trim().toLowerCase();
  return (orderedItems.value as TModelItem[]).filter((f) =>
    (f.label || f.value).toLowerCase().includes(term),
  );
});

// Build the ordered items list: selected first (in model order), then unselected (alphabetical).
// Only called on init and when items prop changes — NOT on checkbox toggle.
function buildOrderedItems() {
  const model = modelValue.value || [];
  const modelSet = new Set<string>(model);
  const valuesSet = new Set<string>(itemsMap.value.keys());
  const unselectedSet = new Map<string, Omit<TModelItem, "index">>(itemsMap.value);

  modelSet.forEach((name) => {
    if (valuesSet.has(name)) {
      unselectedSet.delete(name);
    } else {
      modelSet.delete(name);
    }
  });

  const selected = Array.from(modelSet);
  listBoxModel.value = selected;
  const unselected = Array.from(unselectedSet.values())
    .toSorted((a, b) => (a.label > b.label ? 1 : -1))
    .map((v) => v.value);
  const ordered: Omit<TModelItem, "index">[] = [];
  for (const name of selected) {
    ordered.push(itemsMap.value.get(name)!);
  }
  for (const name of unselected) {
    ordered.push(itemsMap.value.get(name)!);
  }
  const next: TModelItem[] = [];
  for (let index = 0; index < ordered.length; index++) {
    const o = ordered[index];
    next.push({
      value: o.value,
      label: o.label || o.value,
      data: o.data as UnwrapRef<T>,
      index,
    });
  }
  orderedItems.value = next;
}

// Sort once on mount (selected first, unselected alphabetical).
// Never re-sort after that — checkbox toggles and tab switches don't move items.
watch(() => props.items, buildOrderedItems, { immediate: true });

function dragStart(index: number, event: DragEvent) {
  dragIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
}

function drop() {
  const items = orderedItems.value as TModelItem[];
  const itemToMove = items.splice(dragIndex.value, 1)[0];
  const targetIndex =
    dragOverIndex.value > dragIndex.value ? dragOverIndex.value - 1 : dragOverIndex.value;
  items.splice(targetIndex, 0, itemToMove);
  updateOrderedFields();
  dragIndex.value = -1;
  dragOverIndex.value = -1;
}

function over(event: DragEvent, index: number) {
  const item = event.target as HTMLDivElement;
  const { y, height } = item.getBoundingClientRect();
  const atTop = event.clientY - y < height / 2;
  const overIndex = atTop ? index : (findFilteredIndex(index, 1) ?? index + 1);
  if (dragOverIndex.value !== overIndex) {
    dragOverIndex.value = overIndex;
  }
}

function findFilteredIndex(index: number, offset: number) {
  const items = orderedItemsWithSearch.value;
  for (let i = 0; i < items.length; i++) {
    if (items[i].index === index) {
      return items[i + offset]?.index;
    }
  }
}

function moveExact(index: number, targetIndex: number) {
  const items = orderedItems.value as TModelItem[];
  const itemToMove = items.splice(index, 1)[0];
  items.splice(targetIndex, 0, itemToMove);
  updateOrderedFields();
}

function moveOneStep(index: number, offset: number) {
  const targetIndex = findFilteredIndex(index, offset);
  if (typeof targetIndex === "number") {
    const items = orderedItems.value as TModelItem[];
    const itemToMove = items.splice(index, 1)[0];
    items.splice(targetIndex, 0, itemToMove);
    updateOrderedFields();
  }
}

function updateOrderedFields() {
  const items = orderedItems.value as TModelItem[];
  items.forEach((o, index) => (o.index = index));
  orderedItems.value = [...items];
  updateModel();
}

function updateModel() {
  const s = new Set(listBoxModel.value as string[]);
  modelValue.value = (orderedItems.value as TModelItem[])
    .filter((f) => s.has(f.value))
    .map((f) => f.value);
}

function selectAll() {
  listBoxModel.value = orderedItemsWithSearch.value.map((f) => f.value);
  updateModel();
}

function deselectAll() {
  listBoxModel.value = (listBoxModel.value as string[]).filter((v) => disabledSet.value.has(v));
  updateModel();
}
</script>

<template>
  <ListboxRoot
    multiple
    v-model="listBoxModel"
    class="as-orderable-list-box"
    @update:model-value="updateModel"
  >
    <ListboxFilter as-child class="as-orderable-list-toolbar">
      <div>
        <input
          v-model="searchTerm"
          type="text"
          class="as-orderable-list-search"
          placeholder="Search..."
        />
        <div class="as-orderable-list-toolbar-actions">
          <button type="button" class="as-orderable-list-toolbar-btn" @click="selectAll">
            Select all
          </button>
          <button type="button" class="as-orderable-list-toolbar-btn" @click="deselectAll">
            None
          </button>
        </div>
      </div>
    </ListboxFilter>
    <ListboxContent class="as-orderable-list-items">
      <ListboxItem
        v-for="item of orderedItemsWithSearch"
        :key="item.value"
        :value="item.value"
        class="as-orderable-list-item group"
        :disabled="disabledSet.has(item.value)"
        :class="{
          'as-orderable-list-item-dragging': dragIndex === item.index,
          'as-orderable-list-item-disabled': dragIndex >= 0 && disabledSet.has(item.value),
        }"
        @dragenter.prevent="over($event, item.index)"
        @dragover.prevent="over($event, item.index)"
        @drop="drop()"
      >
        <!-- drop indicator -->
        <div v-if="dragOverIndex === item.index" class="as-orderable-list-drop-indicator" />

        <div class="as-orderable-list-item-content">
          <span
            class="as-orderable-list-grip i-as-grip"
            :class="{ 'as-orderable-list-grip-disabled': disabledSet.has(item.value) }"
            :draggable="disabledSet.has(item.value) ? false : true"
            aria-hidden="true"
            @dragstart="dragStart(item.index, $event)"
            @click.stop.prevent
          />
          <div
            class="as-orderable-list-checkbox"
            :class="{ 'as-orderable-list-checkbox-disabled': disabledSet.has(item.value) }"
          >
            <ListboxItemIndicator class="as-orderable-list-check-icon">
              &#x2713;
            </ListboxItemIndicator>
          </div>

          <div class="as-orderable-list-item-body">
            <slot name="label" :item="item.data as T" :label="item.label" :value="item.value">
              <span class="as-orderable-list-item-label">{{ item.label }}</span>
            </slot>

            <slot
              name="item-extra"
              :item="item.data as T"
              :value="item.value"
              :selected="(listBoxModel as string[]).includes(item.value)"
            />

            <div class="as-orderable-list-item-actions">
              <button type="button" title="Move to top" @click.stop="moveExact(item.index, 0)">
                &#x23EB;
              </button>
              <button type="button" title="Move up" @click.stop="moveOneStep(item.index, -1)">
                &#x25B2;
              </button>
              <button type="button" title="Move down" @click.stop="moveOneStep(item.index, 1)">
                &#x25BC;
              </button>
              <button
                type="button"
                title="Move to bottom"
                @click.stop="moveExact(item.index, orderedItems.length)"
              >
                &#x23EC;
              </button>
            </div>
          </div>
        </div>
      </ListboxItem>
    </ListboxContent>
  </ListboxRoot>
</template>
