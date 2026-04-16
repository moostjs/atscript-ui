import "./as-table-defaults.css";

import AsTablePagination from "./as-table-pagination.vue";
import AsColumnMenu from "./as-column-menu.vue";
import AsTableCellValue from "../as-table-cell-value.vue";
import AsTableHeaderCell from "../as-table-header-cell.vue";
import AsFilterBar from "./as-filter-bar.vue";
import AsFilterDialog from "./as-filter-dialog.vue";
import AsFilterInput from "./as-filter-input.vue";
import AsFilterField from "./as-filter-field.vue";

export {
  AsTablePagination,
  AsColumnMenu,
  AsFilterBar,
  AsFilterDialog,
  AsFilterInput,
  AsFilterField,
};

export function createDefaultTableComponents() {
  return {
    headerCell: AsTableHeaderCell,
    cellValue: AsTableCellValue,
    columnMenu: AsColumnMenu,
    filterDialog: AsFilterDialog,
    filterInput: AsFilterInput,
    filterField: AsFilterField,
  };
}
