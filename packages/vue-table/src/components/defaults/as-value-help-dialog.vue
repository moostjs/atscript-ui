<script setup lang="ts">
import { nextTick } from "vue";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui";
import type { ClientFactory, ValueHelpInfo, ValueHelpScope } from "@atscript/ui";
import { useAsTexts } from "@atscript/vue-form/locale";
import AsValueHelpTable from "../internal/as-value-help-table.vue";

type Row = Record<string, unknown>;

/**
 * A form field's picker dialog (since 0.1.190): the binding's dictionary as a
 * table — its `@ui.valueHelp.column` columns, else the dictionary view — in
 * the field's scope, searchable and filterable. Enter or a double-click picks
 * a row: `pick` hands it over (wire it to the field's `selectItem`, so the
 * fills apply) and the dialog closes. Mounts its table on open.
 */
const props = defineProps<{
  /** The binding the dialog lists. */
  info: ValueHelpInfo;
  /**
   * The scope with the form's host values (`useAsValueHelp().scope`); its
   * `pinned` fields get no column. Default: the binding's own `filter`.
   */
  scope?: ValueHelpScope;
  /** Text searched for on open, when the dictionary is searchable. */
  search?: string;
  /** The dialog's title — the field's label. */
  title?: string;
  /** Builds the dictionary's client (the form's `clientFactory`). Default: the app's. */
  clientFactory?: ClientFactory;
}>();
const open = defineModel<boolean>("open", { default: false });
const emit = defineEmits<{
  pick: [row: Row];
  /** The dialog is closing and about to give the focus back; `preventDefault()` to place it yourself. */
  closeAutoFocus: [event: Event];
}>();
const { t } = useAsTexts();

function onPick(row: Row) {
  emit("pick", row);
  open.value = false;
}

// Focus the search input once the table mounted, else the rows.
function onOpenAutoFocus(event: Event) {
  event.preventDefault();
  void nextTick(() =>
    requestAnimationFrame(() => {
      const root = document.querySelector<HTMLElement>(".as-value-help-dialog-content");
      const target =
        root?.querySelector<HTMLElement>(".as-filter-value-help-search") ??
        root?.querySelector<HTMLElement>("tbody[tabindex='0']");
      target?.focus();
    }),
  );
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="as-value-help-dialog-overlay" />
      <DialogContent
        class="as-value-help-dialog-content"
        @open-auto-focus="onOpenAutoFocus"
        @close-auto-focus="emit('closeAutoFocus', $event)"
      >
        <div class="as-value-help-dialog-header">
          <DialogTitle class="as-value-help-dialog-title">{{ title }}</DialogTitle>
          <DialogDescription class="sr-only">{{ t("UI_FORM_PICK_HINT") }}</DialogDescription>
          <DialogClose class="as-value-help-dialog-close" :aria-label="t('UI_CLOSE')">
            <span class="i-as-close" aria-hidden="true" />
          </DialogClose>
        </div>
        <AsValueHelpTable
          select="single"
          :info="info"
          :filter="scope ? scope.filter : info.filter"
          :pinned="scope ? scope.pinned : info.pinned"
          :search="search"
          :client-factory="clientFactory"
          @pick="onPick"
        />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
