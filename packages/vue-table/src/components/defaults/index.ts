import "./as-table-defaults.css";

import AsColumnMenu from "./as-column-menu.vue";
import AsTableCellValue from "../as-table-cell-value.vue";
import AsTableHeaderCell from "../as-table-header-cell.vue";
import AsFilters from "./as-filters.vue";
import AsFilterDialog from "./as-filter-dialog.vue";
import AsFilterInput from "./as-filter-input.vue";
import AsFilterField from "./as-filter-field.vue";
import AsFilterConditions from "./as-filter-conditions.vue";
import AsFilterValueHelp from "./as-filter-value-help.vue";
import AsConfigDialog from "./as-config-dialog.vue";
import AsFieldsSelector from "./as-fields-selector.vue";
import AsSortersConfig from "./as-sorters-config.vue";
import AsOrderableList from "./as-orderable-list.vue";

export {
  AsColumnMenu,
  AsFilters,
  AsFilterDialog,
  AsFilterInput,
  AsFilterField,
  AsFilterConditions,
  AsFilterValueHelp,
  AsConfigDialog,
  AsFieldsSelector,
  AsSortersConfig,
  AsOrderableList,
};

export function createDefaultTableComponents() {
  return {
    headerCell: AsTableHeaderCell,
    cellValue: AsTableCellValue,
    columnMenu: AsColumnMenu,
    filterDialog: AsFilterDialog,
    filterInput: AsFilterInput,
    filterField: AsFilterField,
    configDialog: AsConfigDialog,
  };
}
