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
                <span
                  :class="[
                    'inline-flex items-center px-[8px] py-[2px] rounded-full text-[length:var(--as-fs-sm)] font-500 bg-current-hl/15 text-current-hl',
                    value ? 'scope-good' : 'scope-error',
                  ]"
                >
                  {{ value ? "In Stock" : "Out of Stock" }}
                </span>
              </td>
            </template>

            <!-- Custom cell: category as tag -->
            <template #cell-category="{ value }">
              <td>
                <span
                  class="scope-primary inline-flex items-center px-[8px] py-[2px] rounded-[var(--as-radius-sm)] text-[length:var(--as-fs-sm)] bg-current-hl/10 text-current-hl"
                >
                  {{ value }}
                </span>
              </td>
            </template>

            <!-- Custom empty state -->
            <template #empty>
              <div class="p-[48px] text-center text-current/60">
                <p class="text-[18px] mb-[8px]">No products found</p>
                <p class="text-[length:var(--as-fs-base)]">Try adjusting your filters</p>
              </div>
            </template>

            <!-- Custom loading state -->
            <template #loading>
              <div class="scope-primary p-[48px] text-center text-current-hl">
                <p>Fetching products...</p>
              </div>
            </template>

            <!-- Custom error state -->
            <template #error="{ error }">
              <div class="scope-error p-[48px] text-center text-current-hl">
                <p class="font-600">Something went wrong</p>
                <p class="text-[length:var(--as-fs-base)] mt-[4px]">{{ error.message }}</p>
              </div>
            </template>

            <!-- Footer row -->
            <template #last-row>
              <div
                class="px-[12px] py-[8px] text-[length:var(--as-fs-sm)] text-current/50 text-right"
              >
                Click a row to see details in the side panel
              </div>
            </template>
          </AsTable>
          <TablePagination mode="pagination" />
        </AsTableRoot>
      </div>

      <!-- Side panel showing selected row details -->
      <aside
        v-if="selectedProduct"
        class="layer-1 w-[280px] flex-shrink-0 border-1 rounded-[var(--as-radius-lg)] p-[16px]"
      >
        <h3 class="m-0 mb-[8px] text-[16px]">{{ selectedProduct.name }}</h3>
        <p class="text-[length:var(--as-fs-base)] text-current/60 mb-[12px]">
          {{ selectedProduct.description }}
        </p>
        <dl
          class="grid grid-cols-[auto_1fr] gap-y-[4px] gap-x-[12px] text-[length:var(--as-fs-base)] mb-[16px]"
        >
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
          class="scope-primary c8-outlined w-full h-fingertip-s rounded-[var(--as-radius)] text-[length:var(--as-fs-base)]"
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
