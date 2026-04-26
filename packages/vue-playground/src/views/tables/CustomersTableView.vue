<script setup lang="ts">
import { AsTableRoot, AsTable, createDefaultTableComponents } from "@atscript/vue-table";
import TableToolbar from "../../components/TableToolbar.vue";
import TableFilterBar from "../../components/TableFilterBar.vue";
import TablePagination from "../../components/TablePagination.vue";

const components = createDefaultTableComponents();
</script>

<template>
  <div class="table-page">
    <AsTableRoot
      url="/db/tables/customers"
      :components="components"
      select="multi"
      :limit="10"
      v-slot="{ tableDef, loadedCount, totalCount, loadingMetadata }"
    >
      <TableToolbar
        title="Customers"
        subtitle="Custom cell slots, multi-select and load-more pagination."
        :table-def="tableDef"
        :loaded-count="loadedCount"
        :total-count="totalCount"
      />
      <div class="table-page-filters">
        <TableFilterBar />
      </div>
      <div class="table-page-body">
        <AsTable :column-menu="{ sort: true, filters: true, hide: true, resetWidth: true }">
          <template #cell-email="{ value }">
            <td>
              <a :href="`mailto:${value}`" style="color: rgb(37 99 235)">{{ value }}</a>
            </td>
          </template>
          <template #cell-active="{ value }">
            <td>
              <span :style="{ color: value ? 'rgb(22 163 74)' : 'rgb(220 38 38)' }">
                {{ value ? "Active" : "Inactive" }}
              </span>
            </td>
          </template>
        </AsTable>
        <div v-if="loadingMetadata" class="table-loading-overlay">
          <span class="table-loading-overlay-icon" aria-hidden="true" />
        </div>
      </div>
      <TablePagination mode="load-more" />
    </AsTableRoot>
  </div>
</template>
