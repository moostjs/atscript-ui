<script setup lang="ts">
import {
  AsTableRoot,
  AsTableView,
  createDefaultTableComponents,
} from "@atscript/vue-table";
import "@atscript/vue-table/styles";
import TableToolbar from "../../components/TableToolbar.vue";
import TableFilterBar from "../../components/TableFilterBar.vue";

const components = createDefaultTableComponents();
</script>

<template>
  <div class="fullpage-table">
    <div class="fullpage-header">
      <h2>Virtual Scroll — 5,000 Products</h2>
      <p>Full-page table with virtual scrolling. Only visible rows are rendered.</p>
    </div>
    <div class="fullpage-body">
      <AsTableRoot url="/db/tables/products" :components="components" :limit="5000"
        v-slot="{ tableDef, loadedCount, totalCount, showConfigDialog }">
        <TableToolbar :table-def="tableDef" :loaded-count="loadedCount" :total-count="totalCount" @config="showConfigDialog()" />
        <TableFilterBar />
        <AsTableView
          sticky-header
          :virtual-row-height="36"
          :virtual-overscan="10"
        />
      </AsTableRoot>
    </div>
  </div>
</template>

<style scoped>
.fullpage-table {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 32px);
}
.fullpage-header {
  flex-shrink: 0;
  padding-bottom: 8px;
}
.fullpage-header h2 {
  margin: 0 0 4px;
}
.fullpage-header p {
  color: #6b7280;
  font-size: 13px;
  margin: 0;
}
.fullpage-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.fullpage-body :deep(.as-table-scroll-container) {
  flex: 1;
  min-height: 0;
}
</style>
