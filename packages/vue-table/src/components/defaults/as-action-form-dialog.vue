<script setup lang="ts">
import { computed, ref, useId, watch } from "vue";
import { useResizeObserver } from "@vueuse/core";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui";
import {
  createFormData,
  createFormDef,
  getFieldMeta,
  META_LABEL,
  UI_FORM_SUBMIT_TEXT,
  type FormDef,
} from "@atscript/ui";
import { AsForm, createDefaultTypes } from "@atscript/vue-form";
import { formatIdentifier } from "@atscript/db-client";
import { useTableContext } from "../../composables/use-table-state";
import { intentToScope } from "../../composables/state/intent-scope";

const { state, client, formTypes, formComponents } = useTableContext();

const req = state.actionFormRequest;
const open = computed({
  get: () => req.value !== null,
  set: (v: boolean) => {
    if (!v) state.dismissActionForm();
  },
});

const def = ref<FormDef | null>(null);
const formData = ref<{ value: Record<string, unknown> } | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const resolvedTypes = formTypes ?? createDefaultTypes();

watch(req, async (next) => {
  def.value = null;
  formData.value = null;
  error.value = null;
  loading.value = false;
  if (next === null) return;
  if (!next.action.inputForm) {
    error.value = "Action does not declare an input form.";
    return;
  }
  loading.value = true;
  // A second request supersedes the first — `req.value !== next` short-circuits
  // every continuation, so the prior in-flight `getActionForm()` can't paint
  // stale state into the dialog.
  const stale = () => req.value !== next;
  try {
    const annotated = await client.getActionForm(next.action.name);
    if (stale()) return;
    if (annotated === null) {
      error.value = `Form schema "${next.action.inputForm}" not registered on server.`;
      return;
    }
    def.value = createFormDef(annotated);
    formData.value = createFormData(annotated) as { value: Record<string, unknown> };
  } catch (err) {
    if (stale()) return;
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    if (!stale()) loading.value = false;
  }
});

// `recomputeFit` breaks at the first overflow, so cap formatting at 50 — a
// 1000-row bulk action would otherwise format 950 ids + render 950 hidden
// chips that are never visible. `idTotal` keeps the real count for "+N more".
const MEASURE_CAP = 50;

const formId = `as-action-form-${useId()}`;

const view = computed(() => {
  const r = req.value;
  if (!r) return null;
  const d = def.value;
  const ids = r.identifiers;
  const idTotal = ids.length;
  const slice = idTotal > MEASURE_CAP ? ids.slice(0, MEASURE_CAP) : ids;
  const allIds = slice.map((id) => formatIdentifier(id, r.preferredId));
  const intent = r.action.intent;
  const scope = intent ? intentToScope(intent) : undefined;
  return {
    title: (d ? getFieldMeta(d.type, META_LABEL) : undefined) ?? r.action.label ?? r.action.name,
    // Default verb avoids collisions with "Cancel" on negative-intent actions
    // ("Cancel" vs "Cancel orders"); intent colour carries the semantic.
    submitText: (d && getFieldMeta(d.type, UI_FORM_SUBMIT_TEXT)) || "Proceed",
    submitClass: scope ? `as-action-form-submit-${scope}` : undefined,
    description: r.action.description ?? "",
    allIds,
    idTotal,
    needsMeasure: allIds.length > 1,
  };
});

const idsRef = ref<HTMLElement | null>(null);
const measureRef = ref<HTMLElement | null>(null);
const visibleIdsCount = ref(0);

function recomputeFit() {
  const len = view.value?.allIds.length ?? 0;
  if (len <= 1) {
    if (visibleIdsCount.value !== len) visibleIdsCount.value = len;
    return;
  }
  const container = idsRef.value;
  const measure = measureRef.value;
  if (!container || !measure) return;
  const containerWidth = container.clientWidth;
  const chipEls = measure.querySelectorAll<HTMLElement>("[data-id-chip]");
  const moreEl = measure.querySelector<HTMLElement>("[data-id-more]");
  const moreWidth = moreEl?.offsetWidth ?? 0;
  const styles = window.getComputedStyle(measure);
  const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;

  let used = 0;
  let count = 0;
  for (let i = 0; i < chipEls.length; i++) {
    const chipWidth = chipEls[i]!.offsetWidth;
    const sep = i === 0 ? 0 : gap;
    const next = used + sep + chipWidth;
    const isLast = i === chipEls.length - 1;
    const reserve = isLast ? 0 : gap + moreWidth;
    if (next + reserve > containerWidth) break;
    used = next;
    count++;
  }
  if (count !== visibleIdsCount.value) visibleIdsCount.value = count;
}

useResizeObserver(idsRef, recomputeFit);
watch(() => view.value?.allIds, recomputeFit, { flush: "post" });

function onSubmit(payload: unknown) {
  state.acceptActionForm(payload);
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="as-action-form-overlay" />
      <DialogContent class="as-action-form-content">
        <template v-if="view">
          <header class="as-action-form-header">
            <DialogTitle class="as-action-form-title">{{ view.title }}</DialogTitle>
            <div ref="idsRef" class="as-action-form-ids">
              <span
                v-for="(id, idx) in view.allIds.slice(0, visibleIdsCount)"
                :key="idx"
                class="as-action-form-id"
                >{{ id }}</span
              >
              <span v-if="view.idTotal - visibleIdsCount > 0" class="as-action-form-id-more"
                >{{ view.idTotal - visibleIdsCount }} more…</span
              >
            </div>
            <div
              v-if="view.needsMeasure"
              ref="measureRef"
              class="as-action-form-ids-measure"
              aria-hidden="true"
            >
              <span
                v-for="(id, idx) in view.allIds"
                :key="idx"
                data-id-chip
                class="as-action-form-id"
                >{{ id }}</span
              >
              <span data-id-more class="as-action-form-id-more">{{ view.idTotal }} more…</span>
            </div>
            <DialogClose type="button" class="as-action-form-close" aria-label="Close">
              <span class="i-as-close" aria-hidden="true" />
            </DialogClose>
          </header>
          <div class="as-action-form-body">
            <DialogDescription v-if="view.description" class="as-action-form-description">{{
              view.description
            }}</DialogDescription>
            <p v-if="loading" class="as-action-form-status">Loading form…</p>
            <p v-else-if="error" class="as-action-form-error">{{ error }}</p>
            <AsForm
              v-else-if="def && formData"
              :id="formId"
              :def="def"
              :form-data="formData"
              :types="resolvedTypes"
              :components="formComponents"
              hide-root-title
              hide-submit
              @submit="onSubmit"
            />
          </div>
          <footer v-if="def" class="as-action-form-footer">
            <button type="button" class="as-action-form-cancel" @click="state.dismissActionForm()">
              Cancel
            </button>
            <button
              type="submit"
              :form="formId"
              class="as-action-form-submit"
              :class="view.submitClass"
            >
              {{ view.submitText }}
            </button>
          </footer>
        </template>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
