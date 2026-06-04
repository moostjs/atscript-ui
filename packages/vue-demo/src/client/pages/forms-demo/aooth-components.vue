<script setup lang="ts">
import { ref } from "vue";
import { useRoute } from "vue-router";
import { AsForm, createDefaultTypes, createAsFormDef } from "@atscript/vue-form";
import { AsConsentArray, AsPasswordRules, AsSsoProviders } from "@atscript/vue-aooth";
import { ConsentReviewForm, SetPasswordForm, SsoLoginForm } from "./schemas/aooth-components.as";
import DarkToggle from "./_dark-toggle.vue";

// ── Section A — Backend-driven consent checkboxes ────────────────
// `AsConsentArray` is wired by `@ui.form.component 'AsConsentArray'`
// on the `consents: string[]` field. The `pendingConsents` array
// comes from the backend via `@ui.form.fn.attr` (returning an
// array of `{ id, text, required? }` objects) — required items
// surface a per-consent error message until the user toggles them.
const { def: defA, formData: modelA } = createAsFormDef(ConsentReviewForm);
const typesA = createDefaultTypes();
const componentsA = { AsConsentArray };

// Backend-pushed errors at the `consents` path — used by section-36
// e2e to verify the per-item rendering is the ONLY surface that fires
// (no duplicate shell footer). Query-flag injection keeps this test
// hook out of the visible UX while exercising the public `:errors`
// prop. Set `?inject-consent-error=1` to start with the error live;
// the test-only button below toggles a different message at runtime.
const route = useRoute();
const errorsA = ref<Record<string, string | undefined>>(
  route.query["inject-consent-error"] === "1"
    ? { consents: "Backend: pending consents must be accepted" }
    : {},
);
function pushAltError() {
  errorsA.value = { consents: "Backend: server-side validation failed" };
}

// ── Section B — Live password-policy fulfillment ─────────────────
// `AsPasswordRules` is wired by `@ui.form.component 'AsPasswordRules'`
// on a phantom `rules: ui.paragraph` field. `policies` is fed from
// the backend as serialized rule strings (`(p) => /[A-Z]/.test(p)`)
// compiled at runtime via `compileFieldFn`. The `password` attr is
// a dynamic attr reading `data.newPassword` so each keystroke
// re-evaluates every rule.
const { def: defB, formData: modelB } = createAsFormDef(SetPasswordForm);
const typesB = createDefaultTypes();
const componentsB = { AsPasswordRules };

// ── Section C — Backend-driven SSO provider picker ───────────────
// `AsSsoProviders` is wired by `@ui.form.component 'AsSsoProviders'`
// on the `ssoProvider?: string` field. The provider list comes from
// the backend via `@ui.form.fn.attr 'providers'` (an array of
// `{ id, text, icon, secondary }`). Clicking a provider writes its id
// to the bound model AND fires the form action declared by
// `@ui.form.action 'sso', 'Continue'` — a one-click submit path, no
// separate submit button needed.
const { def: defC, formData: modelC } = createAsFormDef(SsoLoginForm);
const typesC = createDefaultTypes();
const componentsC = { AsSsoProviders };

const lastActionC = ref<{ name: string; data: unknown } | undefined>();

function onSubmitA(data: unknown) {
  console.log("ConsentReviewForm submitted:", data);
}
function onSubmitB(data: unknown) {
  console.log("SetPasswordForm submitted:", data);
}
function onActionC(name: string, data: unknown) {
  console.log("SsoLoginForm action:", name, data);
  lastActionC.value = { name, data };
}
function onSubmitC(data: unknown) {
  console.log("SsoLoginForm submitted:", data);
}
</script>

<template>
  <div class="min-h-screen layer-1">
    <div class="max-w-2xl mx-auto p-$l flex flex-col gap-$xl">
      <header class="flex flex-col gap-$xs">
        <div class="flex items-center justify-between gap-$s">
          <p
            class="font-mono text-callout font-600 tracking-[0.14em] uppercase text-current/60 m-0"
          >
            atscript-ui · forms demo
          </p>
          <DarkToggle />
        </div>
        <h1 class="text-h3 m-0">Aooth components</h1>
        <p class="text-callout text-current-muted m-0 mt-$xxs">
          Three Tier-1 components from <code>@atscript/vue-aooth</code>:
          <code>AsConsentArray</code> renders a backend-supplied list of consent checkboxes bound to
          a <code>string[]</code> (Section A), <code>AsPasswordRules</code> evaluates serialized
          policy expressions against a sibling password field on every keystroke (Section B), and
          <code>AsSsoProviders</code> renders a backend-supplied SSO provider list where one click
          both selects a provider and fires the form action (Section C). All three are wired through
          <code>@ui.form.component</code> + <code>@ui.form.fn.attr</code>.
        </p>
        <RouterLink
          to="/forms-demo"
          class="text-callout text-current/60 underline mt-$xs self-start"
        >
          ← back to forms hub
        </RouterLink>
      </header>

      <section class="flex flex-col gap-$m">
        <div class="flex flex-col gap-$xxs">
          <h2 class="text-h5 m-0">Section A — Consent review</h2>
          <p class="text-callout text-current-muted m-0">
            The <code>consents: string[]</code> field is rendered by <code>AsConsentArray</code>.
            The list of pending consents is provided as a typed array of
            <code>{ id, text, required? }</code> via <code>@ui.form.fn.attr</code> — static
            <code>@ui.form.attr</code> only carries string values, so the dynamic variant is
            required for any structured prop. Toggle each row; the model below mirrors the bound
            array. Required items surface their own error message on submit until accepted.
          </p>
        </div>
        <AsForm
          :def="defA"
          :form-data="modelA"
          :types="typesA"
          :components="componentsA"
          :errors="errorsA"
          hide-root-title
          first-validation="on-submit"
          data-testid="aooth-components-section-a-form"
          @submit="onSubmitA"
        />
        <!--
          E2E-only hook: visually hidden trigger that injects a different
          backend error into `errorsA`. Used by section-36's
          backend-error-no-shell-footer test to verify the per-item
          rendering remains the only error surface across multiple
          backend pushes. `sr-only` keeps it out of the visible UX.
        -->
        <button
          type="button"
          class="sr-only"
          data-testid="aooth-section-a-push-alt-error"
          @click="pushAltError"
        >
          push alt error
        </button>
        <details class="layer-0 border-1 rounded-r2 p-$m text-callout">
          <summary class="cursor-pointer font-600 text-current-muted">
            Section A · model preview
          </summary>
          <pre
            class="mt-$s overflow-auto text-callout"
            data-testid="aooth-components-section-a-preview"
            >{{ JSON.stringify(modelA, null, 2) }}</pre
          >
        </details>
      </section>

      <section class="flex flex-col gap-$m">
        <div class="flex flex-col gap-$xxs">
          <h2 class="text-h5 m-0">Section B — Set password with live rules</h2>
          <p class="text-callout text-current-muted m-0">
            The phantom <code>rules: ui.paragraph</code> field is rendered by
            <code>AsPasswordRules</code>. Five policies are supplied as serialized rule strings
            (<code>(p) =&gt; /[A-Z]/.test(p)</code> etc.) via
            <code>@ui.form.fn.attr 'policies'</code>; a second
            <code>@ui.form.fn.attr 'password'</code> reads <code>data.newPassword</code> so the
            rules re-evaluate on every keystroke. Each row's <code>data-passed</code> attribute
            reflects fulfillment for e2e to assert against.
          </p>
        </div>
        <AsForm
          :def="defB"
          :form-data="modelB"
          :types="typesB"
          :components="componentsB"
          hide-root-title
          first-validation="on-submit"
          data-testid="aooth-components-section-b-form"
          @submit="onSubmitB"
        />
        <details class="layer-0 border-1 rounded-r2 p-$m text-callout">
          <summary class="cursor-pointer font-600 text-current-muted">
            Section B · model preview
          </summary>
          <pre
            class="mt-$s overflow-auto text-callout"
            data-testid="aooth-components-section-b-preview"
            >{{ JSON.stringify(modelB, null, 2) }}</pre
          >
        </details>
      </section>

      <section class="flex flex-col gap-$m">
        <div class="flex flex-col gap-$xxs">
          <h2 class="text-h5 m-0">Section C — SSO provider picker</h2>
          <p class="text-callout text-current-muted m-0">
            The <code>ssoProvider?: string</code> field is rendered by
            <code>AsSsoProviders</code> via <code>@ui.form.component</code>. The provider list —
            main full-width buttons plus <code>secondary</code> chips — is supplied as a typed array
            of <code>{ id, text, icon, secondary }</code> through
            <code>@ui.form.fn.attr 'providers'</code>. Each provider button is a one-click action:
            clicking writes its <code>id</code> to the bound model and fires the
            <code>@ui.form.action 'sso'</code> action, surfaced here as
            <code>@action(name, data)</code>. No separate submit button is shown — the provider
            buttons <em>are</em> the action.
          </p>
        </div>
        <AsForm
          :def="defC"
          :form-data="modelC"
          :types="typesC"
          :components="componentsC"
          hide-root-title
          hide-submit
          first-validation="on-submit"
          data-testid="aooth-components-section-c-form"
          @action="onActionC"
          @submit="onSubmitC"
        />
        <div
          class="layer-0 border-1 rounded-r2 p-$m text-callout"
          data-testid="aooth-components-section-c-action"
        >
          <span class="font-600 text-current-muted">Last fired action:</span>
          <span v-if="lastActionC" class="ml-$xs">
            <code>{{ lastActionC.name }}</code> → provider
            <code>{{ (lastActionC.data as { ssoProvider?: string })?.ssoProvider }}</code>
          </span>
          <span v-else class="ml-$xs text-current/60">none yet — click a provider above</span>
        </div>
        <details class="layer-0 border-1 rounded-r2 p-$m text-callout">
          <summary class="cursor-pointer font-600 text-current-muted">
            Section C · model preview
          </summary>
          <pre
            class="mt-$s overflow-auto text-callout"
            data-testid="aooth-components-section-c-preview"
            >{{ JSON.stringify(modelC, null, 2) }}</pre
          >
        </details>
      </section>
    </div>
  </div>
</template>
