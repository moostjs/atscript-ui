<script setup lang="ts">
import { computed, toRaw, watch, type Component } from "vue";
import { useWfForm } from "./use-wf-form";
import type { UseWfFormOptions } from "./use-wf-form";
import { AsForm, type TAsTypeComponents } from "@atscript/vue-form";
import type { FormDef, ClientFactory } from "@atscript/ui";
import { getFieldMeta, WF_ACTION_WITH_DATA } from "@atscript/ui";
import type { TFormState } from "@atscript/vue-form";

interface WfFormProps extends UseWfFormOptions {
  /** Type-to-component map for AsForm rendering */
  types: TAsTypeComponents;
  /** First validation strategy passed to AsForm */
  firstValidation?: TFormState["firstValidation"];
  /** Custom components map passed to AsForm */
  components?: Record<string, Component>;
  /** Per-form client factory override (FK value-help). Forwarded to AsForm. */
  clientFactory?: ClientFactory;
}

const props = withDefaults(defineProps<WfFormProps>(), {
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
    <div v-if="wf.loading.value && !wf.formDef.value">
      <slot name="wf.loading" />
    </div>

    <div v-else-if="wf.error.value && !wf.formDef.value">
      <slot name="wf.error" :error="wf.error.value" :retry="wf.retry">
        <div>{{ (wf.error.value as any)?.message ?? "Error" }}</div>
      </slot>
    </div>

    <div v-else-if="wf.finished.value">
      <slot name="wf.finished" :response="wf.response.value" />
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
        <template #form.submit="slotProps">
          <slot name="form.submit" v-bind="{ ...slotProps, loading: wf.loading.value }">
            <button :disabled="slotProps.disabled || wf.loading.value">
              {{ slotProps.text }}
            </button>
          </slot>
        </template>
        <template #form.footer="slotProps">
          <slot name="form.footer" v-bind="{ ...slotProps, loading: wf.loading.value }" />
        </template>
      </AsForm>
    </div>
  </slot>
</template>
