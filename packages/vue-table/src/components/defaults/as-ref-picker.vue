<script setup lang="ts">
import { ref } from "vue";
import { AsRef, type TAsComponentProps } from "@atscript/vue-form";
import { useAsTexts } from "@atscript/vue-form/locale";
import AsValueHelpDialog from "./as-value-help-dialog.vue";

/**
 * The reference field with a picker dialog (since 0.1.190): `AsRef` plus a
 * button after the input and a "See all" entry under its list, both opening
 * `AsValueHelpDialog` with the typed text as its search. A row picked there
 * goes through the field's one pick path (`selectItem`), so the binding's
 * fills apply. Register it for the `ref` type: `{ ...createDefaultTypes(),
 * ref: AsRefPicker }`.
 */
const props = defineProps<TAsComponentProps>();
const { t } = useAsTexts();

const dialogOpen = ref(false);
const dialogSearch = ref("");

function browse(searchText: string, close: () => void) {
  close();
  dialogSearch.value = searchText;
  dialogOpen.value = true;
}

const canPick = () => !props.disabled && !props.readonly;
</script>

<template>
  <AsRef v-bind="$props">
    <template #trailing="{ searchText, selectItem, scope, clientFactory, close }">
      <template v-if="valueHelp && canPick()">
        <button
          type="button"
          class="as-ref-picker-browse"
          :aria-label="t('UI_FORM_BROWSE', { field: label ?? name ?? '' })"
          :title="t('UI_FORM_BROWSE', { field: label ?? name ?? '' })"
          @click="browse(searchText, close)"
        >
          <span class="i-as-value-help" aria-hidden="true" />
        </button>
        <AsValueHelpDialog
          v-model:open="dialogOpen"
          :info="valueHelp"
          :scope="scope"
          :search="dialogSearch"
          :title="label ?? name"
          :client-factory="clientFactory"
          @pick="selectItem"
        />
      </template>
    </template>
    <template #list-end="{ searchText, close }">
      <button
        v-if="valueHelp && canPick()"
        type="button"
        class="as-ref-picker-see-all"
        @click="browse(searchText, close)"
      >
        {{ t("UI_FORM_SEE_ALL") }}
      </button>
    </template>
  </AsRef>
</template>
