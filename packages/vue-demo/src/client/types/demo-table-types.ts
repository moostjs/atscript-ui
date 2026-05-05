import type { Component } from "vue";
import { createDefaultCellTypes, type TAsCellTypeComponents } from "@atscript/vue-table";
import AsCellStatusBadge from "../components/AsCellStatusBadge.vue";

/**
 * Table cell-type map — defaults plus the demo-specific `'status'` key
 * referenced by `users.status` via `@ui.table.type 'status'`. Other custom
 * types can be appended here.
 */
export function createDemoTableTypes(): TAsCellTypeComponents {
  return {
    ...createDefaultCellTypes(),
    status: AsCellStatusBadge,
  };
}

/**
 * Named-component overrides — looked up by `@ui.table.component "name"`.
 * `orders.status` carries `@ui.table.component 'status-badge'`, so the
 * named-component branch wins over the cell-type dispatch and renders
 * the same badge.
 */
export function createDemoTableComponents(): Record<string, Component> {
  return {
    "status-badge": AsCellStatusBadge,
  };
}
