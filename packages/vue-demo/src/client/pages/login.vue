<script setup lang="ts">
import { useRouter } from "vue-router";
import { AsWfForm } from "@atscript/vue-wf";
import { createDemoTypes } from "../types/demo-types";
import { useMe } from "../api/use-me";
import { sharedFetch } from "../api/fetch";

const router = useRouter();
const { refresh } = useMe();
const types = createDemoTypes();

async function onFinished() {
  await refresh();
  void router.push("/");
}
</script>

<template>
  <div class="min-h-screen grid place-items-center layer-1 py-$xl">
    <div class="flex flex-col items-center gap-$l w-full max-w-[640px] px-$m">
      <div
        class="flex flex-col gap-$s w-full max-w-[480px] min-w-[320px] p-$l layer-0 border-1 rounded-r2 shadow-popup"
      >
        <div class="flex items-center gap-$m mb-$s">
          <img src="/logo.svg" alt="AtShop" class="size-22" />
          <div class="flex flex-col">
            <h1 class="text-lg font-700 m-0">AtShop — Sign In</h1>
            <p
              class="scope-grey font-mono text-callout font-600 tracking-[0.14em] uppercase text-current/60 m-0"
            >
              atscript-ui demo
            </p>
          </div>
        </div>
        <AsWfForm
          path="/api/wf"
          name="api/auth/login"
          :types="types"
          :fetch="sharedFetch"
          first-validation="on-submit"
          @finished="onFinished"
        >
          <template #wf.loading>
            <div class="p-4 text-sm opacity-60">Loading…</div>
          </template>
          <template #wf.error="{ error, retry }">
            <div class="p-4 text-red-600 text-sm">
              <p>{{ (error as any)?.message ?? "Error" }}</p>
              <button class="mt-2 underline" @click="retry">Retry</button>
            </div>
          </template>
          <template #form.submit="{ disabled, loading, text }">
            <button
              type="submit"
              :disabled="disabled || loading"
              class="c8-filled scope-primary h-fingertip-m px-$m rounded-base font-600 disabled:opacity-50"
            >
              {{ loading ? "Signing in…" : (text ?? "Sign In") }}
            </button>
          </template>
        </AsWfForm>
        <p class="text-callout text-current/60 m-0">
          No account?
          <RouterLink to="/register" class="scope-primary text-current-hl underline"
            >Register</RouterLink
          >
        </p>
      </div>
      <section class="flex flex-col items-center gap-$s w-full">
        <p class="as-demo-eyebrow">Explore the demos · no auth required</p>
        <div class="as-demo-grid">
          <RouterLink to="/forms-demo" class="as-demo-card">
            <div class="as-demo-card-head">
              <span class="as-demo-card-icon">
                <span class="i-ph:list-checks" aria-hidden="true" />
              </span>
              <h2 class="as-demo-card-title">Forms</h2>
              <span class="as-demo-card-arrow" aria-hidden="true" />
            </div>
            <p class="as-demo-card-desc">
              15+ patterns: arrays, unions, dates, grid layouts, validation.
            </p>
          </RouterLink>
          <RouterLink to="/wf-demo" class="as-demo-card">
            <div class="as-demo-card-head">
              <span class="as-demo-card-icon">
                <span class="i-ph:flow-arrow" aria-hidden="true" />
              </span>
              <h2 class="as-demo-card-title">Workflows</h2>
              <span class="as-demo-card-arrow" aria-hidden="true" />
            </div>
            <p class="as-demo-card-desc">
              9 scenarios: redirects, branching, multi-step, outlets, finishers.
            </p>
          </RouterLink>
        </div>
      </section>
    </div>
  </div>
</template>
