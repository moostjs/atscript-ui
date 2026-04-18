<script setup lang="ts">
import { AsTableRoot, AsTable, createDefaultTableComponents } from "@atscript/vue-table";
import TableToolbar from "../../components/TableToolbar.vue";
import TableFilterBar from "../../components/TableFilterBar.vue";

const components = createDefaultTableComponents();
</script>

<template>
  <div class="table-page">
    <AsTableRoot
      url="/db/tables/products"
      :components="components"
      :limit="5000"
      v-slot="{ tableDef, loadedCount, totalCount }"
    >
      <TableToolbar
        title="Virtual Scroll — 5,000 Products"
        subtitle="Full-page table with virtual scrolling. Only visible rows are rendered."
        :table-def="tableDef"
        :loaded-count="loadedCount"
        :total-count="totalCount"
      />
      <div class="table-page-filters">
        <TableFilterBar />
      </div>
      <div class="table-page-body">
        <AsTable sticky-header :virtual-row-height="36" :virtual-overscan="10" />
      </div>
    </AsTableRoot>
  </div>
</template>

<style scoped>
/* Virtual-scroll needs an inner flex container so the scroll container
   fills remaining height. Replaces the utility-class `overflow-auto` with
   `overflow-hidden` + column flex on the body. */
.table-page-body {
  overflow: hidden !important;
  display: flex;
  flex-direction: column;
}
.table-page-body :deep(.as-table-scroll-container) {
  flex: 1;
  min-height: 0;
}
</style>
