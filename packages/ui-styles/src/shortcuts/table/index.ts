import { mergeVunorShortcuts } from "vunor/theme";
import { asColumnMenuShortcuts } from "./as-column-menu";
import { asConfigDialogShortcuts } from "./as-config-dialog";
import { asConfigTabShortcuts } from "./as-config-tab";
import { asConfirmDialogShortcuts } from "./as-confirm-dialog";
import { asFilterDialogShortcuts } from "./as-filter-dialog";
import { asFilterFieldShortcuts } from "./as-filter-field";
import { asFpillShortcuts } from "./as-fpill";
import { asOrderableListShortcuts } from "./as-orderable-list";
import { asPageShortcuts } from "./as-page";
import { asPresetDialogShortcuts } from "./as-preset-dialog";
import { asPresetPickerShortcuts } from "./as-preset-picker";
import { asRowActionsShortcuts } from "./as-row-actions";
import { asSorterShortcuts } from "./as-sorter";
import { asTableActionsShortcuts } from "./as-table-actions";
import { asTableShortcuts } from "./as-table";
import { asWindowScrollbarShortcuts } from "./as-window-scrollbar";
import { asWindowSkeletonShortcuts } from "./as-window-skeleton";
import { asWindowTableShortcuts } from "./as-window-table";

export {
  asColumnMenuShortcuts,
  asConfigDialogShortcuts,
  asConfigTabShortcuts,
  asConfirmDialogShortcuts,
  asFilterDialogShortcuts,
  asFilterFieldShortcuts,
  asFpillShortcuts,
  asOrderableListShortcuts,
  asPageShortcuts,
  asPresetDialogShortcuts,
  asPresetPickerShortcuts,
  asRowActionsShortcuts,
  asSorterShortcuts,
  asTableActionsShortcuts,
  asTableShortcuts,
  asWindowScrollbarShortcuts,
  asWindowSkeletonShortcuts,
  asWindowTableShortcuts,
};

export const tableShortcuts = mergeVunorShortcuts([
  asTableShortcuts,
  asPageShortcuts,
  asFpillShortcuts,
  asColumnMenuShortcuts,
  asPresetPickerShortcuts,
  asPresetDialogShortcuts,
  asFilterDialogShortcuts,
  asFilterFieldShortcuts,
  asConfigDialogShortcuts,
  asConfigTabShortcuts,
  asConfirmDialogShortcuts,
  asOrderableListShortcuts,
  asRowActionsShortcuts,
  asSorterShortcuts,
  asTableActionsShortcuts,
  asWindowTableShortcuts,
  asWindowSkeletonShortcuts,
  asWindowScrollbarShortcuts,
]);
