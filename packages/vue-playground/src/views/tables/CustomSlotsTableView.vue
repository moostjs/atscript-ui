<script setup lang="ts">
import { ref } from "vue";
import {
  AsTableRoot,
  AsTableView,
  AsFilterBar,
  AsTablePagination,
  createDefaultTableComponents,
} from "@atscript/vue-table";
import "@atscript/vue-table/styles";
import TableToolbar from "../../components/TableToolbar.vue";

const components = createDefaultTableComponents();
const selectedProduct = ref<Record<string, unknown> | null>(null);

function onRowClick(row: Record<string, unknown>) {
  selectedProduct.value = row;
}
</script>

<template>
  <div class="demo-page">
    <h2>Custom Slots Demo</h2>
    <p>All available table slots with custom rendering and logic.</p>

    <div class="demo-layout">
      <div>
        <AsTableRoot url="/db/tables/products" :components="components" :limit="10"
          v-slot="{ tableDef, loadedCount, totalCount, showConfigDialog }">
          <TableToolbar :table-def="tableDef" :loaded-count="loadedCount" :total-count="totalCount" @config="showConfigDialog()" />
          <AsFilterBar />
          <AsTableView
            :column-menu="{ sort: true, filters: true, hide: true }"
            @row-click="onRowClick"
          >
            <!-- Custom header for name column -->
            <template #header-name="{ column }">
              <th style="min-width: 15em">
                <span style="font-weight: 700; color: #6366f1">{{ column.label }}</span>
              </th>
            </template>

            <!-- Custom cell: product name as bold -->
            <template #cell-name="{ value }">
              <td style="font-weight: 600">{{ value }}</td>
            </template>

            <!-- Custom cell: price with currency formatting -->
            <template #cell-price="{ value }">
              <td style="text-align: right; font-variant-numeric: tabular-nums">
                ${{ typeof value === "number" ? value.toFixed(2) : value }}
              </td>
            </template>

            <!-- Custom cell: inStock as colored badge -->
            <template #cell-inStock="{ value }">
              <td>
                <span
                  :style="{
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 500,
                    background: value ? '#dcfce7' : '#fee2e2',
                    color: value ? '#166534' : '#991b1b',
                  }"
                >
                  {{ value ? "In Stock" : "Out of Stock" }}
                </span>
              </td>
            </template>

            <!-- Custom cell: category as tag -->
            <template #cell-category="{ value }">
              <td>
                <span
                  style="
                    padding: 2px 8px;
                    border-radius: 6px;
                    font-size: 12px;
                    background: #eef2ff;
                    color: #4338ca;
                  "
                >
                  {{ value }}
                </span>
              </td>
            </template>

            <!-- Custom empty state -->
            <template #empty>
              <div style="padding: 48px; text-align: center; color: #9ca3af">
                <p style="font-size: 18px; margin-bottom: 8px">No products found</p>
                <p style="font-size: 13px">Try adjusting your filters</p>
              </div>
            </template>

            <!-- Custom loading state -->
            <template #loading>
              <div style="padding: 48px; text-align: center; color: #6366f1">
                <p>Fetching products...</p>
              </div>
            </template>

            <!-- Custom error state -->
            <template #error="{ error }">
              <div style="padding: 48px; text-align: center; color: #dc2626">
                <p style="font-weight: 600">Something went wrong</p>
                <p style="font-size: 13px; margin-top: 4px">{{ error.message }}</p>
              </div>
            </template>

            <!-- Footer row -->
            <template #last-row>
              <div style="padding: 8px 12px; font-size: 12px; color: #9ca3af; text-align: right">
                Click a row to see details in the side panel
              </div>
            </template>
          </AsTableView>
          <AsTablePagination mode="pagination" />
        </AsTableRoot>
      </div>

      <!-- Side panel showing selected row details -->
      <aside v-if="selectedProduct" class="detail-panel">
        <h3>{{ selectedProduct.name }}</h3>
        <p class="detail-desc">{{ selectedProduct.description }}</p>
        <dl class="detail-list">
          <dt>SKU</dt>
          <dd>{{ selectedProduct.sku }}</dd>
          <dt>Price</dt>
          <dd>${{ (selectedProduct.price as number)?.toFixed(2) }}</dd>
          <dt>Category</dt>
          <dd>{{ selectedProduct.category }}</dd>
          <dt>In Stock</dt>
          <dd>{{ selectedProduct.inStock ? "Yes" : "No" }}</dd>
        </dl>
        <button class="detail-close" @click="selectedProduct = null">Close</button>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.demo-page {
  max-width: 1400px;
}
.demo-page h2 {
  margin-bottom: 8px;
}
.demo-page p {
  color: #6b7280;
  font-size: 14px;
  margin-bottom: 16px;
}
.demo-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.demo-layout > :first-child {
  flex: 1;
  min-width: 0;
}
.detail-panel {
  width: 280px;
  flex-shrink: 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  background: #f9fafb;
}
.detail-panel h3 {
  margin: 0 0 8px;
  font-size: 16px;
  color: #111827;
}
.detail-desc {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 12px;
}
.detail-list {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 12px;
  font-size: 13px;
  margin-bottom: 16px;
}
.detail-list dt {
  color: #9ca3af;
  font-weight: 500;
}
.detail-list dd {
  margin: 0;
  color: #374151;
}
.detail-close {
  width: 100%;
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #374151;
  font-size: 13px;
  cursor: pointer;
}
.detail-close:hover {
  border-color: #6366f1;
  background: #eef2ff;
  color: #4338ca;
}
</style>
