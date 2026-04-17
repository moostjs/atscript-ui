<script setup lang="ts">
import { AsTableRoot, AsTableView, createDefaultTableComponents } from "@atscript/vue-table";
import "@atscript/vue-table/styles";
import TableToolbar from "../../components/TableToolbar.vue";
import TableFilterBar from "../../components/TableFilterBar.vue";
import TablePagination from "../../components/TablePagination.vue";

const components = createDefaultTableComponents();
</script>

<template>
  <div class="demo-page">
    <h2>Orders Table</h2>
    <p>
      Orders with FK columns (customerId, productId). Open filter on these columns to see value-help
      mini-table with data from the referenced table.
    </p>
    <AsTableRoot
      url="/db/tables/orders"
      :components="components"
      :limit="10"
      v-slot="{ tableDef, loadedCount, totalCount, showConfigDialog }"
    >
      <TableToolbar
        :table-def="tableDef"
        :loaded-count="loadedCount"
        :total-count="totalCount"
        @config="showConfigDialog()"
      />
      <TableFilterBar />
      <AsTableView :column-menu="{ sort: true, filters: true, hide: true }" />
      <TablePagination mode="pagination" />
    </AsTableRoot>
  </div>
</template>

<style scoped>
.demo-page {
  max-width: 1200px;
}
.demo-page h2 {
  margin-bottom: 8px;
}
.demo-page p {
  color: #6b7280;
  font-size: 14px;
  margin-bottom: 16px;
}
</style>
