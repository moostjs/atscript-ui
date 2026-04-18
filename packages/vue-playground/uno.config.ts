import { asPresetVunor } from "@atscript/unocss-preset";
import { defineConfig } from "unocss";
import { mergeVunorShortcuts, vunorShortcuts } from "vunor/theme";
import { asFormShortcuts } from "../vue-form/src/unocss";
import { asTableShortcuts } from "../vue-table/src/unocss";

export default defineConfig({
  content: {
    filesystem: [
      "src/**/*.{vue,ts,tsx}",
      "../vue-table/src/**/*.{vue,ts}",
      "../vue-form/src/**/*.{vue,ts}",
    ],
  },
  // Build-time safelist for shortcuts referenced in library components —
  // scanning sibling packages is flaky during dev server re-renders.
  safelist: [
    "as-no-data",
    "as-no-data-text",
    "as-no-data-plus",
    "as-dropdown",
    "as-dropdown-anchor",
    "as-dropdown-trigger",
    "as-dropdown-menu",
    "as-dropdown-item",
    "as-dropdown-item--active",
    "as-variant-trigger",
    "as-radio-group",
    "as-checkbox-field",
    "as-structured-header",
    "as-structured-header-content",
    "as-structured-title",
    "as-form-title",
    "as-structured-remove-btn",
    "as-object",
    "as-object--root",
    "as-object--nested",
    "as-object-error",
    "as-array",
    "as-array--root",
    "as-array--nested",
    "as-array-error",
    "as-array-add",
    "as-array-add-btn",
    "as-ref-root",
    "as-ref-anchor",
    "as-ref-input",
    "as-ref-clear",
    "as-ref-content",
    "as-ref-viewport",
    "as-ref-item",
    "as-ref-item-id",
    "as-ref-item-label",
    "as-ref-item-descr",
    "as-ref-status",
    "as-action-field",
    "i-as-plus",
  ],
  presets: asPresetVunor({ iconsDir: ".icons" }),
  shortcuts: [
    vunorShortcuts(mergeVunorShortcuts([asTableShortcuts, asFormShortcuts])),
  ],
});
