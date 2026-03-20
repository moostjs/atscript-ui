<script setup lang="ts">
import { useTableState } from "../../composables/use-table-state";

const state = useTableState();
</script>

<template>
  <div class="as-table-toolbar">
    <div class="as-table-toolbar-left">
      <input
        class="as-table-search"
        type="search"
        placeholder="Search..."
        :value="state.searchTerm.value"
        @input="state.searchTerm.value = ($event.target as HTMLInputElement).value"
      />
      <slot name="filters" />
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
