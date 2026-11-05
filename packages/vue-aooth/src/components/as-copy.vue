<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { AsFieldShell, type TAsComponentProps } from "@atscript/vue-form";
import { useAsTexts } from "@atscript/vue-form/locale";

const props = defineProps<
  TAsComponentProps<string | undefined> & {
    /** Default: the UI text `UI_AOOTH_COPIED` ("Copied"). */
    copiedLabel?: string;
    /** Default: the UI text `UI_AOOTH_COPY` ("Copy"). */
    copyLabel?: string;
  }
>();
const { t } = useAsTexts();
const buttonLabel = computed(() =>
  copied.value
    ? (props.copiedLabel ?? t("UI_AOOTH_COPIED"))
    : (props.copyLabel ?? t("UI_AOOTH_COPY")),
);

// Phantom fields (ui.paragraph + @ui.form.fn.value) deliver the resolved value
// via props.value; data-bound fields use model.value.
const text = computed<string>(
  () => ((props.value as string | undefined) ?? props.model?.value ?? "") as string,
);

const copied = ref(false);
const error = ref<string | undefined>();
let revertTimer: ReturnType<typeof setTimeout> | undefined;

async function onCopy() {
  if (!navigator.clipboard?.writeText) {
    copied.value = false;
    error.value = t("UI_AOOTH_COPY_FAILED");
    return;
  }
  try {
    await navigator.clipboard.writeText(text.value);
    error.value = undefined;
    copied.value = true;
    clearTimeout(revertTimer);
    revertTimer = setTimeout(() => {
      copied.value = false;
      revertTimer = undefined;
    }, 1500);
  } catch {
    // Concurrent / failed write: drop the "copied" affordance so the UI never
    // shows "Copied ✓" alongside the error banner.
    copied.value = false;
    clearTimeout(revertTimer);
    revertTimer = undefined;
    error.value = t("UI_AOOTH_COPY_FAILED");
  }
}

function onFocus(e: FocusEvent) {
  (e.target as HTMLInputElement).select();
}

onUnmounted(() => clearTimeout(revertTimer));
</script>

<template>
  <AsFieldShell v-bind="$props" field-class="as-copy" :error="error">
    <div class="as-copy-row">
      <input
        :id="inputId"
        type="text"
        readonly
        :value="text"
        :name="name"
        class="as-copy-input"
        :aria-describedby="ariaDescribedBy"
        @focus="onFocus"
      />
      <button
        type="button"
        class="as-copy-btn"
        :class="{ copied }"
        :disabled="!text"
        :aria-label="buttonLabel"
        @click="onCopy"
      >
        <span
          class="as-copy-icon"
          :class="copied ? 'i-as-check-circle' : 'i-as-copy'"
          aria-hidden="true"
        />
        <span class="as-copy-label" aria-live="polite">{{ buttonLabel }}</span>
      </button>
    </div>
  </AsFieldShell>
</template>
