<script setup lang="ts">
import { AsTableRoot, AsTable, createDefaultTableComponents } from "@atscript/vue-table";
import "@atscript/vue-table/styles";
import TableToolbar from "../../components/TableToolbar.vue";
import TableFilterBar from "../../components/TableFilterBar.vue";
import TablePagination from "../../components/TablePagination.vue";

const components = createDefaultTableComponents();
</script>

<template>
  <div class="demo-page">
    <h2>Products Table</h2>
    <p>Live data from SQLite via Moost server. Try sorting columns and paginating.</p>
    <AsTableRoot
      url="/db/tables/products"
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
      <AsTable :column-menu="{ sort: true, filters: true, hide: true }" />
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
