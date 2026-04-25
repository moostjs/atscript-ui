import {
  AsColumnMenu,
  AsConfigDialog,
  AsFilterDialog,
  AsFilterField,
  AsFilterInput,
  AsTableCellValue,
  AsTableHeaderCell,
} from "../components/defaults";

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
