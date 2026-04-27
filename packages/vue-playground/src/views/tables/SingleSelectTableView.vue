<script setup lang="ts">
import { ref } from "vue";
import { AsTableRoot, AsTable, createDefaultTableComponents } from "@atscript/vue-table";
import TableToolbar from "../../components/TableToolbar.vue";
import TableFilterBar from "../../components/TableFilterBar.vue";
import TablePagination from "../../components/TablePagination.vue";

const components = createDefaultTableComponents();

const selected = ref<unknown[]>([]);

function findRow(rows: Record<string, unknown>[], pk: unknown): Record<string, unknown> | null {
  if (pk == null) return null;
  for (const r of rows) if (r.id === pk) return r;
  return null;
}

function onMainAction(row: Record<string, unknown>) {
  console.info("[main-action] drilldown into product", row);
  alert(`Drilldown: ${String(row.name ?? row.id)}`);
}
</script>

<template>
  <div class="table-page">
    <AsTableRoot
      v-model:selected-rows="selected"
      url="/db/tables/products"
      :components="components"
      select="single"
      :limit="10"
      v-slot="{ tableDef, loadedCount, totalCount, loadingMetadata, results }"
      @main-action="onMainAction"
    >
      <TableToolbar
        title="Products (single-select)"
        subtitle="Click a row to select. ArrowUp/Down navigates, Space toggles, Enter or dblclick triggers main-action drilldown."
        :table-def="tableDef"
        :loaded-count="loadedCount"
        :total-count="totalCount"
      />
      <div class="table-page-filters">
        <TableFilterBar />
      </div>
      <div class="table-page-body flex gap-$m">
        <div class="flex-1 min-w-0 relative">
          <AsTable :column-menu="{ sort: true, filters: true, hide: true, resetWidth: true }" />
          <div v-if="loadingMetadata" class="table-loading-overlay">
            <span class="table-loading-overlay-icon" aria-hidden="true" />
          </div>
        </div>
        <aside class="layer-1 w-[20em] flex-shrink-0 border-1 rounded-r2 p-$m">
          <template v-if="findRow(results, selected[0])">
            <h3 class="m-0 mb-$s text-body-l">{{ findRow(results, selected[0])!.name }}</h3>
            <dl class="m-0 grid grid-cols-[7em_1fr] gap-x-$s gap-y-$xxs text-callout">
              <dt class="m-0 text-grey-500">SKU</dt>
              <dd class="m-0">{{ findRow(results, selected[0])!.sku }}</dd>
              <dt class="m-0 text-grey-500">Category</dt>
              <dd class="m-0">{{ findRow(results, selected[0])!.category }}</dd>
              <dt class="m-0 text-grey-500">Price</dt>
              <dd class="m-0">
                ${{ (findRow(results, selected[0])!.price as number)?.toFixed(2) }}
              </dd>
              <dt class="m-0 text-grey-500">In stock</dt>
              <dd class="m-0">
                {{ findRow(results, selected[0])!.inStock ? "Yes" : "No" }}
              </dd>
            </dl>
            <button class="mt-$s c8-flat px-$m h-fingertip-s" @click="selected = []">
              Clear selection
            </button>
          </template>
          <p v-else class="m-0 text-grey-500 text-callout">
            Click a row (or use ArrowDown + Space) to see its details here.
          </p>
        </aside>
      </div>
      <TablePagination mode="pagination" />
    </AsTableRoot>
  </div>
</template>
