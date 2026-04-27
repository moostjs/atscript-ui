<script setup lang="ts">
import { AsTableRoot, AsWindowTable, createDefaultTableComponents } from "@atscript/vue-table";
import TableToolbar from "../../components/TableToolbar.vue";
import TableFilterBar from "../../components/TableFilterBar.vue";

const components = createDefaultTableComponents();
</script>

<template>
  <div class="table-page">
    <AsTableRoot
      url="/db/tables/products"
      :components="components"
      :limit="50"
      v-slot="{ tableDef, loadedCount, totalCount, loadingMetadata }"
    >
      <TableToolbar
        title="Window Table — Pool-Based Rendering"
        subtitle="Synthesized scrollbar; only viewport-many rows render at once. Random-access via thumb drag."
        :table-def="tableDef"
        :loaded-count="loadedCount"
        :total-count="totalCount"
      />
      <div class="table-page-filters">
        <TableFilterBar />
      </div>
      <div class="table-page-body">
        <AsWindowTable />
        <div v-if="loadingMetadata" class="table-loading-overlay">
          <span class="table-loading-overlay-icon" aria-hidden="true" />
        </div>
      </div>
    </AsTableRoot>
  </div>
</template>
