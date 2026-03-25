import "./as-table-defaults.css";

import AsTableDefault from "./as-table-default.vue";
import AsTableToolbar from "./as-table-toolbar.vue";
import AsTablePagination from "./as-table-pagination.vue";
import AsColumnMenu from "./as-column-menu.vue";
import AsTableCellValue from "../as-table-cell-value.vue";
import AsTableHeaderCell from "../as-table-header-cell.vue";
import AsFilterBar from "./as-filter-bar.vue";
import AsFilterDialog from "./as-filter-dialog.vue";
import AsFilterInput from "./as-filter-input.vue";
import AsFilterRefInline from "./as-filter-ref-inline.vue";

export {
  AsTableDefault,
  AsTableToolbar,
  AsTablePagination,
  AsColumnMenu,
  AsFilterBar,
  AsFilterDialog,
  AsFilterInput,
  AsFilterRefInline,
};

export function createDefaultTableComponents() {
  return {
    table: AsTableDefault,
    toolbar: AsTableToolbar,
    pagination: AsTablePagination,
    headerCell: AsTableHeaderCell,
    cellValue: AsTableCellValue,
    columnMenu: AsColumnMenu,
    filterBar: AsFilterBar,
    filterDialog: AsFilterDialog,
    filterInput: AsFilterInput,
    filterRefInput: AsFilterRefInline,
  };
}
