<script setup lang="ts">
import { ref } from "vue";
import { AsTableRoot, AsTable, createDefaultTableComponents } from "@atscript/vue-table";
import TableToolbar from "../../components/TableToolbar.vue";
import TableFilterBar from "../../components/TableFilterBar.vue";
import TablePagination from "../../components/TablePagination.vue";

const components = createDefaultTableComponents();
const selectedProduct = ref<Record<string, unknown> | null>(null);

function onRowClick(row: Record<string, unknown>) {
  selectedProduct.value = row;
}
</script>

<template>
  <div class="demo-page">
    <div class="demo-layout">
      <div>
        <AsTableRoot
          url="/db/tables/products"
          :components="components"
          :limit="10"
          v-slot="{ tableDef, loadedCount, totalCount }"
        >
          <TableToolbar
            title="Custom Slots Demo"
            subtitle="All available table slots with custom rendering and logic."
            :table-def="tableDef"
            :loaded-count="loadedCount"
            :total-count="totalCount"
          />
          <TableFilterBar />
          <AsTable :column-menu="{ sort: true, filters: true, hide: true }" @row-click="onRowClick">
            <!-- Custom header for name column -->
            <template #header-name="{ column }">
              <th class="min-w-[15em]">
                <span class="scope-primary font-700 text-current-hl">{{ column.label }}</span>
              </th>
            </template>

            <!-- Custom cell: product name as bold -->
            <template #cell-name="{ value }">
              <td class="font-600">{{ value }}</td>
            </template>

            <!-- Custom cell: price with currency formatting -->
            <template #cell-price="{ value }">
              <td class="text-right tabular-nums">
                ${{ typeof value === "number" ? value.toFixed(2) : value }}
              </td>
            </template>

            <!-- Custom cell: inStock as colored badge -->
            <template #cell-inStock="{ value }">
              <td>
                <span :class="['as-status-badge', value ? 'scope-good' : 'scope-error']">
                  {{ value ? "In Stock" : "Out of Stock" }}
                </span>
              </td>
            </template>

            <!-- Custom cell: category as tag -->
            <template #cell-category="{ value }">
              <td>
                <span class="scope-primary as-tag-chip">
                  {{ value }}
                </span>
              </td>
            </template>

            <!-- Custom empty state -->
            <template #empty>
              <div class="p-$xxl text-center text-current/60">
                <p class="text-body-l mb-$s">No products found</p>
                <p class="text-body">Try adjusting your filters</p>
              </div>
            </template>

            <!-- Custom loading state -->
            <template #loading>
              <div class="scope-primary p-$xxl text-center text-current-hl">
                <p>Fetching products...</p>
              </div>
            </template>

            <!-- Custom error state -->
            <template #error="{ error }">
              <div class="scope-error p-$xxl text-center text-current-hl">
                <p class="font-600">Something went wrong</p>
                <p class="mt-$xs">{{ error.message }}</p>
              </div>
            </template>

            <!-- Footer row -->
            <template #last-row>
              <div class="px-$m py-$s text-callout text-current/50 text-right">
                Click a row to see details in the side panel
              </div>
            </template>
          </AsTable>
          <TablePagination mode="pagination" />
        </AsTableRoot>
      </div>

      <!-- Side panel showing selected row details -->
      <aside v-if="selectedProduct" class="layer-1 w-[18em] flex-shrink-0 border-1 rounded-r2 p-$m">
        <h3 class="m-0 mb-$s text-body-l">{{ selectedProduct.name }}</h3>
        <p class="text-current/60 mb-$m">
          {{ selectedProduct.description }}
        </p>
        <dl class="grid grid-cols-[auto_1fr] gap-y-$xs gap-x-$m mb-$m">
          <dt class="text-current/50 font-500">SKU</dt>
          <dd class="m-0">{{ selectedProduct.sku }}</dd>
          <dt class="text-current/50 font-500">Price</dt>
          <dd class="m-0">${{ (selectedProduct.price as number)?.toFixed(2) }}</dd>
          <dt class="text-current/50 font-500">Category</dt>
          <dd class="m-0">{{ selectedProduct.category }}</dd>
          <dt class="text-current/50 font-500">In Stock</dt>
          <dd class="m-0">{{ selectedProduct.inStock ? "Yes" : "No" }}</dd>
        </dl>
        <button
          class="scope-primary c8-outlined w-full h-fingertip-s rounded-base text-body"
          @click="selectedProduct = null"
        >
          Close
        </button>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.demo-page {
  max-width: 1400px;
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
</style>
