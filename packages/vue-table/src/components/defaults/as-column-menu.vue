<script setup lang="ts">
import { ref } from "vue";
import type { ColumnDef } from "@atscript/ui-core";

const props = withDefaults(
  defineProps<{
    column: ColumnDef;
    config?: { sort?: boolean; filters?: boolean; hide?: boolean };
  }>(),
  {
    config: () => ({ sort: true, filters: true, hide: true }),
  },
);

const emit = defineEmits<{
  (e: "sort", direction: "asc" | "desc"): void;
  (e: "hide"): void;
  (e: "filter"): void;
}>();

const open = ref(false);

function sortAsc() {
  emit("sort", "asc");
  open.value = false;
}

function sortDesc() {
  emit("sort", "desc");
  open.value = false;
}

function hide() {
  emit("hide");
  open.value = false;
}
</script>

<template>
  <details
    class="as-column-menu"
    :open="open"
    @toggle="open = ($event.target as HTMLDetailsElement).open"
  >
    <summary class="as-column-menu-trigger">&vellip;</summary>
    <div class="as-column-menu-dropdown">
      <template v-if="config.sort && props.column.sortable">
        <button type="button" class="as-column-menu-item" @click="sortAsc">
          &#x25B2; Sort Ascending
        </button>
        <button type="button" class="as-column-menu-item" @click="sortDesc">
          &#x25BC; Sort Descending
        </button>
      </template>
      <button v-if="config.hide" type="button" class="as-column-menu-item" @click="hide">
        &#x2716; Hide Column
      </button>
    </div>
  </details>
</template>
