<script setup lang="ts">
import { computed, toRaw, watch, type Component } from "vue";
import { useWfForm } from "../use-wf-form";
import type { UseWfFormOptions } from "../use-wf-form";
import { AsForm, type TAsTypeComponents } from "@atscript/vue-form";
import type { FormDef, ClientFactory } from "@atscript/ui";
import { getFieldMeta, WF_ACTION_WITH_DATA } from "@atscript/ui";
import type { TFormState } from "@atscript/vue-form";
import type { WfActionRequest } from "@atscript/moost-wf";
import AsWfFinish from "./defaults/as-wf-finish.vue";

interface AsWfFormProps extends UseWfFormOptions {
  /** Type-to-component map for AsForm rendering */
  types: TAsTypeComponents;
  /** First validation strategy passed to AsForm */
  firstValidation?: TFormState["firstValidation"];
  /** Custom components map passed to AsForm */
  components?: Record<string, Component>;
  /** Per-form client factory override (FK value-help). Forwarded to AsForm. */
  clientFactory?: ClientFactory;
  /**
   * Consumer-provided navigation handler forwarded to `<AsWfFinish>`. Pairs
   * with `@atscript/db-client`'s `Client({ navigate })` option so one handler
   * covers both workflow redirects and DB navigate-actions.
   */
  navigate?: (url: string) => void | Promise<void>;
}

const props = withDefaults(defineProps<AsWfFormProps>(), {
  autoStart: true,
  tokenTransport: "body",
  tokenName: "wfs",
  wfidName: "wfid",
});

const emit = defineEmits<{
  (e: "finished", response: unknown): void;
  (e: "error", error: { message: string; status?: number }): void;
  (e: "form", def: FormDef, context?: Record<string, unknown>): void;
  (e: "submit", data: unknown): void;
  (e: "loading", isLoading: boolean): void;
  (e: "dismiss"): void;
  (e: "action", action: WfActionRequest): void;
}>();

// ── Composable ──────────────────────────────────────────────
const wf = useWfForm(props);

// ── Emit side-effects ───────────────────────────────────────
watch(
  () => wf.loading.value,
  (v) => emit("loading", v),
);
watch(
  () => wf.finished.value,
  (v) => {
    if (v) emit("finished", wf.response.value);
  },
);
watch(
  () => wf.error.value,
  (v) => {
    if (v) emit("error", v as { message: string; status?: number });
  },
);
watch([() => wf.formDef.value, () => wf.formContext.value], ([def, ctx]) => {
  if (def) emit("form", def, ctx);
});

// ── Action classification ───────────────────────────────────
// Build a Set of "withData" action IDs from the current FormDef.
const withDataActions = computed<Set<string>>(() => {
  const def = wf.formDef.value;
  if (!def) return new Set();
  const set = new Set<string>();
  for (const field of def.fields) {
    const wfAction = getFieldMeta(field.prop, WF_ACTION_WITH_DATA) as string | undefined;
    if (wfAction) set.add(wfAction);
  }
  return set;
});

// ── Event handlers ──────────────────────────────────────────
function onSubmit(data: unknown) {
  const raw = toRaw(data) as Record<string, unknown>;
  emit("submit", raw);
  wf.submit(raw);
}

function onAction(name: string, data: unknown) {
  if (withDataActions.value.has(name)) {
    wf.actionWithData(name, toRaw(data) as Record<string, unknown>);
  } else {
    wf.action(name);
  }
}
</script>

<template>
  <slot
    :form="{
      def: wf.formDef.value,
      formData: wf.formData.value,
      formContext: wf.formContext.value,
    }"
    :state="{
      loading: wf.loading.value,
      error: wf.error.value,
      finished: wf.finished.value,
      response: wf.response.value,
    }"
    :actions="{ start: wf.start, submit: onSubmit, retry: wf.retry }"
  >
    <div v-if="wf.loading.value && !wf.formDef.value" class="as-wf-form-loading">
      <slot name="wf.loading">
        <div class="as-form-overlay">
          <span class="as-form-overlay-icon" aria-hidden="true" />
        </div>
      </slot>
    </div>

    <div v-else-if="wf.error.value && !wf.formDef.value">
      <slot name="wf.error" :error="wf.error.value" :retry="wf.retry">
        <div>{{ (wf.error.value as any)?.message ?? "Error" }}</div>
      </slot>
    </div>

    <div v-else-if="wf.finished.value">
      <slot name="wf.finished" :response="wf.response.value" :payload="wf.finishedPayload.value">
        <!--
          Per `feedback_vue_empty_slot`: a `<template #x>` registered on a child
          short-circuits the child's default fallback even when its content is
          empty. So we only forward slot names that the AsWfForm consumer
          actually provided — otherwise AsWfFinish's defaults render.
        -->
        <AsWfFinish
          :payload="wf.finishedPayload.value"
          :navigate="navigate"
          @dismiss="() => emit('dismiss')"
          @action="(a) => emit('action', a)"
        >
          <template v-if="$slots['wf.finish.message']" #message="scope">
            <slot name="wf.finish.message" v-bind="scope" />
          </template>
          <template v-if="$slots['wf.finish.countdown']" #countdown="scope">
            <slot name="wf.finish.countdown" v-bind="scope" />
          </template>
          <template v-if="$slots['wf.finish.skip']" #skip="scope">
            <slot name="wf.finish.skip" v-bind="scope" />
          </template>
          <template v-if="$slots['wf.finish.primary']" #primary="scope">
            <slot name="wf.finish.primary" v-bind="scope" />
          </template>
          <template v-if="$slots['wf.finish.option']" #option="scope">
            <slot name="wf.finish.option" v-bind="scope" />
          </template>
        </AsWfFinish>
      </slot>
    </div>

    <div v-else-if="wf.formDef.value && wf.formData.value">
      <slot v-if="wf.error.value" name="form.error" :error="wf.error.value" :retry="wf.retry">
        <div role="alert" class="as-wf-form-error">
          {{ (wf.error.value as { message?: string })?.message ?? "Error" }}
        </div>
      </slot>
      <AsForm
        :key="wf.formKey.value"
        :def="wf.formDef.value"
        :form-data="wf.formData.value"
        :types="types"
        :errors="wf.errors.value"
        :form-context="wf.formContext.value"
        :first-validation="firstValidation"
        :components="components"
        :client-factory="clientFactory"
        :loading="wf.loading.value"
        @submit="onSubmit"
        @action="onAction"
        @unsupported-action="onAction"
      >
        <template #form.header="slotProps">
          <slot name="form.header" v-bind="{ ...slotProps, loading: wf.loading.value }" />
        </template>
        <template #form.before="slotProps">
          <slot name="form.before" v-bind="{ ...slotProps, loading: wf.loading.value }" />
        </template>
        <template #form.after="slotProps">
          <slot name="form.after" v-bind="{ ...slotProps, loading: wf.loading.value }" />
        </template>
        <template v-if="$slots['form.submit']" #form.submit="slotProps">
          <slot name="form.submit" v-bind="{ ...slotProps, loading: wf.loading.value }" />
        </template>
        <template #form.footer="slotProps">
          <slot name="form.footer" v-bind="{ ...slotProps, loading: wf.loading.value }" />
        </template>
      </AsForm>
    </div>
  </slot>
</template>
