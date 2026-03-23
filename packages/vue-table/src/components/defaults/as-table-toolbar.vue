<script setup lang="ts">
import { useTableContext } from "../../composables/use-table-state";
import { useTableComponent } from "../../composables/use-table-component";
import AsFilterBar from "./as-filter-bar.vue";

const { state } = useTableContext();

const FilterBarComp = useTableComponent("filterBar", AsFilterBar);

let searchTimer: ReturnType<typeof setTimeout>;

function onSearchInput(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  state.searchTerm.value = value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => state.query(), 300);
}
</script>

<template>
  <div class="as-table-toolbar">
    <div class="as-table-toolbar-left">
      <input
        v-if="state.tableDef.value?.searchable"
        class="as-table-search"
        type="search"
        placeholder="Search..."
        :value="state.searchTerm.value"
        @input="onSearchInput"
      />
      <component :is="FilterBarComp" />
    </div>
    <div class="as-table-toolbar-right">
      <span class="as-table-count">
        {{ state.loadedCount.value }} of {{ state.totalCount.value }}
      </span>
      <button class="as-table-config-btn" type="button" @click="state.showConfigDialog()">
        &#x2699;
      </button>
    </div>
  </div>
</template>
