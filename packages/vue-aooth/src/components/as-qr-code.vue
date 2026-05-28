<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { AsFieldShell, type TAsComponentProps } from "@atscript/vue-form";

const props = withDefaults(
  defineProps<
    TAsComponentProps<string | undefined> & {
      size?: number;
      errorCorrection?: "L" | "M" | "Q" | "H";
      manualSecret?: boolean;
    }
  >(),
  {
    size: 192,
    errorCorrection: "M",
    manualSecret: true,
  },
);

// Phantom fields (ui.paragraph + @ui.form.fn.value) deliver the resolved value
// via props.value; data-bound fields use model.value.
const uri = computed<string | undefined>(
  () => (props.value as string | undefined) ?? props.model?.value,
);

const svg = ref<string | undefined>();
const error = ref<string | undefined>();
const secret = ref<string | undefined>();

// Module-level so the dynamic import resolves once per page instead of per
// value-change. Optional peer dep — keeps qrcode out of the base bundle.
let qrcodeModulePromise: Promise<typeof import("qrcode")> | undefined;
function loadQrcode() {
  qrcodeModulePromise ??= import("qrcode");
  return qrcodeModulePromise;
}

// Match the secret query param without constructing a URL — `otpauth://` URIs
// have historically tripped strict URL parsers across engines.
const SECRET_RE = /[?&]secret=([^&]+)/;
function extractSecret(value: string): string | undefined {
  const m = SECRET_RE.exec(value);
  return m ? decodeURIComponent(m[1]) : undefined;
}

// Cancellation token: the watcher fires per uri-change; if a slow render races
// a fast subsequent render, the older write must NOT clobber the newer svg.
let renderToken = 0;

watch(
  uri,
  async (value) => {
    const token = ++renderToken;
    error.value = undefined;
    if (!value) {
      svg.value = undefined;
      secret.value = undefined;
      return;
    }
    secret.value = extractSecret(value);
    let lib: typeof import("qrcode");
    try {
      const mod = await loadQrcode();
      lib = (mod as { default?: typeof import("qrcode") }).default ?? mod;
    } catch (err) {
      if (token !== renderToken) return;
      svg.value = undefined;
      secret.value = undefined;
      console.error("[AsQrCode] qrcode peer dependency is not installed", err);
      error.value = "Install the optional 'qrcode' dependency to render QR codes.";
      return;
    }
    try {
      const out = await lib.toString(value, {
        type: "svg",
        margin: 0,
        width: props.size,
        errorCorrectionLevel: props.errorCorrection,
      });
      if (token !== renderToken) return;
      svg.value = out;
    } catch (err) {
      if (token !== renderToken) return;
      svg.value = undefined;
      secret.value = undefined;
      console.error("[AsQrCode] failed to render QR code", err);
      error.value = "Failed to render QR code.";
    }
  },
  { immediate: true },
);
</script>

<template>
  <AsFieldShell v-bind="$props" field-class="as-qr-code" :error="error">
    <div v-if="uri" class="as-qr-code-stack">
      <div v-if="svg" class="as-qr-code-svg" v-html="svg" />
      <div v-if="manualSecret && secret" class="as-qr-code-secret">{{ secret }}</div>
    </div>
  </AsFieldShell>
</template>
