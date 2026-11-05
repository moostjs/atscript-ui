<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { useTableContext } from "../../composables/use-table-state";
import { useAsTexts } from "@atscript/vue-form/locale";

/**
 * The "select every row matching the query" strip (Gmail pattern), rendered
 * by `<AsTable>` / `<AsWindowTable>` above their body:
 *
 * - every loaded eligible row is picked and `state.canSelectAllMatching` →
 *   "All {n} rows on this page are selected. Select all {total} matching";
 * - a query selection is held → "All {count} matching rows are selected.
 *   Clear selection".
 *
 * The wrapper is a polite live region that stays mounted while the table is
 * in multi-select, so both switches are announced; focus moves to the other
 * button when one replaces the other. `#selection-banner` replaces the
 * content (rendered only while the banner shows).
 */
const props = defineProps<{
  /** What "loaded" means to the renderer: a page (`<AsTable>`) or the cache (`<AsWindowTable>`). */
  scope: "page" | "loaded";
}>();

const { state } = useTableContext();
const { t } = useAsTexts();

const kind = computed<"offer" | "query" | null>(() => {
  if (state.selectMode.value !== "multi") return null;
  if (state.querySelection.value) return "query";
  if (!state.canSelectAllMatching.value) return null;
  const loaded = state.loadedEligiblePks.value.length;
  return loaded > 0 && state.loadedSelectedCount.value === loaded ? "offer" : null;
});

const loadedCount = computed(() => state.loadedEligiblePks.value.length);

const offerText = computed(() => {
  const count = loadedCount.value;
  const page = props.scope === "page";
  if (count === 1) return t(page ? "UI_TABLE_SELECTED_PAGE_ONE" : "UI_TABLE_SELECTED_LOADED_ONE");
  return t(page ? "UI_TABLE_SELECTED_PAGE" : "UI_TABLE_SELECTED_LOADED", { count });
});

const queryText = computed(() => {
  const count = state.selectedCount.value;
  return count === 1
    ? t("UI_TABLE_SELECTED_MATCHING_ONE")
    : t("UI_TABLE_SELECTED_MATCHING", { count });
});

const rootRef = ref<HTMLElement | null>(null);
const btnRef = ref<HTMLButtonElement | null>(null);

/**
 * Keep keyboard focus when the banner's button is swapped — on the new
 * button, or, once the banner is gone, on the table's select-all checkbox.
 */
async function refocus(hadFocus: boolean) {
  if (!hadFocus) return;
  await nextTick();
  if (btnRef.value) {
    btnRef.value.focus();
    return;
  }
  rootRef.value?.parentElement
    ?.querySelector<HTMLElement>(".as-th-select [role=checkbox][tabindex]")
    ?.focus();
}

function hasFocus(): boolean {
  return !!btnRef.value && btnRef.value === document.activeElement;
}

/** Run a banner action, keeping focus on the banner's button (see `refocus`). */
function keepingFocus(fn: () => void): () => void {
  return () => {
    const focused = hasFocus();
    fn();
    void refocus(focused);
  };
}

const selectAllMatching = keepingFocus(() => state.selectAllMatching());
const clearSelection = keepingFocus(() => state.clearSelection());
</script>

<template>
  <div
    v-if="state.selectMode.value === 'multi'"
    ref="rootRef"
    role="status"
    aria-live="polite"
    :class="kind ? 'as-selection-banner' : 'sr-only'"
    :data-kind="kind ?? undefined"
  >
    <template v-if="kind">
      <slot
        :selection="state.selection.value"
        :can-select-all-matching="state.canSelectAllMatching.value"
        :select-all-matching="selectAllMatching"
        :clear-selection="clearSelection"
        :loaded-count="loadedCount"
      >
        <template v-if="kind === 'offer'">
          <span class="as-selection-banner-text">{{ offerText }}</span>
          <button
            ref="btnRef"
            type="button"
            class="as-selection-banner-btn"
            data-select-all-matching
            @click="selectAllMatching"
          >
            {{ t("UI_TABLE_SELECT_ALL_MATCHING", { count: state.totalCount.value }) }}
          </button>
        </template>
        <template v-else>
          <span class="as-selection-banner-text">{{ queryText }}</span>
          <button
            ref="btnRef"
            type="button"
            class="as-selection-banner-btn"
            data-clear-selection
            @click="clearSelection"
          >
            {{ t("UI_CLEAR_SELECTION") }}
          </button>
        </template>
      </slot>
    </template>
  </div>
</template>
