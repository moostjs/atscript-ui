<script setup lang="ts">
import { ref } from "vue";
import {
  AsTableRoot,
  AsTable,
  createDefaultControls,
  createDefaultCellTypes,
} from "@atscript/vue-table";
import TableToolbar from "../../components/TableToolbar.vue";
import TableFilterBar from "../../components/TableFilterBar.vue";
import TablePagination from "../../components/TablePagination.vue";

const controls = createDefaultControls();
const types = createDefaultCellTypes();
const filterFields = ref<string[]>(["customerId", "productId", "status"]);
</script>

<template>
  <div class="table-page">
    <AsTableRoot
      url="/db/tables/orders"
      :controls="controls"
      :types="types"
      :limit="10"
      v-model:filter-fields="filterFields"
      v-slot="{ tableDef, loadedCount, totalCount, loadingMetadata }"
    >
      <TableToolbar
        title="Orders (FK)"
        subtitle="Orders with FK columns (customerId, productId). Open filter on these columns to see value-help mini-table."
        :table-def="tableDef"
        :loaded-count="loadedCount"
        :total-count="totalCount"
      />
      <div class="table-page-filters">
        <TableFilterBar />
      </div>
      <div class="table-page-body">
        <AsTable :column-menu="{ sort: true, filters: true, hide: true, resetWidth: true }" />
        <div v-if="loadingMetadata" class="table-loading-overlay">
          <span class="table-loading-overlay-icon" aria-hidden="true" />
        </div>
      </div>
      <TablePagination mode="pagination" />
    </AsTableRoot>
  </div>
</template>
