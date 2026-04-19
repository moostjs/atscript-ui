<script setup lang="ts">
import { ref } from "vue";
import { AsTableRoot, AsTable, createDefaultTableComponents } from "@atscript/vue-table";
import TableToolbar from "../../components/TableToolbar.vue";
import TableFilterBar from "../../components/TableFilterBar.vue";
import TablePagination from "../../components/TablePagination.vue";

const components = createDefaultTableComponents();
const filterFields = ref<string[]>(["customerId", "productId", "status"]);
</script>

<template>
  <div class="table-page">
    <AsTableRoot
      url="/db/tables/orders"
      :components="components"
      :limit="10"
      v-model:filter-fields="filterFields"
      v-slot="{ tableDef, loadedCount, totalCount }"
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
        <AsTable :column-menu="{ sort: true, filters: true, hide: true }" />
      </div>
      <TablePagination mode="pagination" />
    </AsTableRoot>
  </div>
</template>
