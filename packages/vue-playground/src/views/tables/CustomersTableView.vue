<script setup lang="ts">
import { AsTableRoot, AsTable, createDefaultTableComponents } from "@atscript/vue-table";
import "@atscript/vue-table/styles";

const components = createDefaultTableComponents();
</script>

<template>
  <div class="demo-page">
    <h2>Customers Table</h2>
    <p>Custom cell slots, selection, and load-more pagination.</p>
    <AsTableRoot url="/db/tables/customers" :components="components" select="multi" :limit="10">
      <AsTable rows-control="load-more-btn">
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
      </AsTable>
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
