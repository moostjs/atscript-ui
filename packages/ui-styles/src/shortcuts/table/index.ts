import { mergeVunorShortcuts } from "vunor/theme";
import { asColumnMenuShortcuts } from "./as-column-menu";
import { asConfigDialogShortcuts } from "./as-config-dialog";
import { asConfigTabShortcuts } from "./as-config-tab";
import { asFilterDialogShortcuts } from "./as-filter-dialog";
import { asFilterFieldShortcuts } from "./as-filter-field";
import { asFpillShortcuts } from "./as-fpill";
import { asOrderableListShortcuts } from "./as-orderable-list";
import { asPageShortcuts } from "./as-page";
import { asSorterShortcuts } from "./as-sorter";
import { asTableShortcuts } from "./as-table";
import { asWindowScrollbarShortcuts } from "./as-window-scrollbar";
import { asWindowSkeletonShortcuts } from "./as-window-skeleton";
import { asWindowTableShortcuts } from "./as-window-table";

export {
  asColumnMenuShortcuts,
  asConfigDialogShortcuts,
  asConfigTabShortcuts,
  asFilterDialogShortcuts,
  asFilterFieldShortcuts,
  asFpillShortcuts,
  asOrderableListShortcuts,
  asPageShortcuts,
  asSorterShortcuts,
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
  asFilterDialogShortcuts,
  asFilterFieldShortcuts,
  asConfigDialogShortcuts,
  asConfigTabShortcuts,
  asOrderableListShortcuts,
  asSorterShortcuts,
  asWindowTableShortcuts,
  asWindowSkeletonShortcuts,
  asWindowScrollbarShortcuts,
]);
