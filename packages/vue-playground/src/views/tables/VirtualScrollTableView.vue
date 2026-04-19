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
      v-slot="{ tableDef, loadedCount, totalCount, loadingMetadata }"
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
        <div v-if="loadingMetadata" class="table-loading-overlay">
          <span class="table-loading-overlay-icon" aria-hidden="true" />
        </div>
      </div>
    </AsTableRoot>
  </div>
</template>
