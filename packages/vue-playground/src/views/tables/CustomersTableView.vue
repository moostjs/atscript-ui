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
    <h2>Customers Table</h2>
    <p>Custom cell slots, selection, and load-more pagination.</p>
    <AsTableRoot
      url="/db/tables/customers"
      :components="components"
      select="multi"
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
      <AsTableView :column-menu="{ sort: true, filters: true, hide: true }">
        <template #cell-email="{ value }">
          <td>
            <a :href="`mailto:${value}`" style="color: #6366f1">{{ value }}</a>
          </td>
        </template>
        <template #cell-active="{ value }">
          <td>
            <span :style="{ color: value ? '#16a34a' : '#dc2626' }">
              {{ value ? "Active" : "Inactive" }}
            </span>
          </td>
        </template>
      </AsTableView>
      <TablePagination mode="load-more" />
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
