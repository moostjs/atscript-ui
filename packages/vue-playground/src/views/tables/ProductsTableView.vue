<script setup lang="ts">
import { AsTableRoot, AsTable, createDefaultTableComponents } from "@atscript/vue-table";
import "@atscript/vue-table/styles";

const components = createDefaultTableComponents();
</script>

<template>
  <div class="demo-page">
    <h2>Products Table</h2>
    <p>Live data from SQLite via Moost server. Try sorting columns and paginating.</p>
    <AsTableRoot url="/db/tables/products" :components="components" :limit="10">
      <AsTable rows-control="pagination" />
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
