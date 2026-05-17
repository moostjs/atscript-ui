<script setup lang="ts">
import { computed, getCurrentInstance, onMounted, onUnmounted, ref, watch } from "vue";
import type { WfAction, WfButton, WfFinished } from "@atscript/moost-wf";

const props = defineProps<{
  payload: WfFinished | null;
}>();

const emit = defineEmits<{
  (e: "navigate", payload: { target: string; mode: "soft" | "hard"; reason?: string }): void;
  (e: "dismiss"): void;
  /** Fired whenever an action runs — analytics hook. */
  (e: "action", action: WfAction): void;
}>();

// ── Action execution ───────────────────────────────────────
// Surface vnode listeners so we can detect a missing `@navigate` handler at
// runtime — silent dead-buttons are the worst UX for `redirect/soft` actions.
const instance = getCurrentInstance();
let warnedSoftFallback = false;

function hasListener(name: "onNavigate" | "onDismiss"): boolean {
  return !!instance?.vnode.props && name in (instance.vnode.props as Record<string, unknown>);
}

function runAction(action: WfAction): void {
  // Analytics first so consumers can log even when the action also fires
  // navigation that unloads the page.
  emit("action", action);
  if (action.type === "redirect") {
    if (action.mode === "hard") {
      window.location.href = action.target;
      return;
    }
    if (hasListener("onNavigate")) {
      emit("navigate", {
        target: action.target,
        mode: action.mode,
        reason: action.reason,
      });
      return;
    }
    if (import.meta.env?.DEV !== false && !warnedSoftFallback) {
      warnedSoftFallback = true;
      console.warn(
        "[AsWfFinish] soft redirect requested but no `@navigate` listener is attached; " +
          "falling back to `window.location.href`. Wire `@navigate` to your router's push() " +
          "for SPA navigation.",
      );
    }
    window.location.href = action.target;
    return;
  }
  if (action.type === "reload") {
    window.location.reload();
    return;
  }
  if (action.type === "dismiss") {
    emit("dismiss");
  }
}

// ── Derived state ──────────────────────────────────────────
const end = computed(() => props.payload?.end ?? null);
const message = computed(() => props.payload?.message ?? null);

// ── Auto mode: timer + countdown ───────────────────────────
let autoTimer: ReturnType<typeof setTimeout> | undefined;
let countdownInterval: ReturnType<typeof setInterval> | undefined;
let autoStartedAt = 0;
const totalSeconds = ref(0);
const secondsRemaining = ref(0);
const autoCancelled = ref(false);

function clearAutoTimers(): void {
  if (autoTimer !== undefined) {
    clearTimeout(autoTimer);
    autoTimer = undefined;
  }
  if (countdownInterval !== undefined) {
    clearInterval(countdownInterval);
    countdownInterval = undefined;
  }
}

function startAutoTimer(): void {
  const e = end.value;
  if (!e || e.mode !== "auto") return;
  clearAutoTimers();
  autoCancelled.value = false;
  autoStartedAt = Date.now();
  totalSeconds.value = Math.ceil(e.timeoutMs / 1000);
  secondsRemaining.value = totalSeconds.value;
  autoTimer = setTimeout(() => {
    clearAutoTimers();
    runAction(e.action);
  }, e.timeoutMs);
  // 100ms tick lets consumers render smooth progress rings — but only write
  // the ref when the second changes so the default whole-second template
  // doesn't churn 10× per second.
  countdownInterval = setInterval(() => {
    const elapsed = Date.now() - autoStartedAt;
    const remainMs = Math.max(0, e.timeoutMs - elapsed);
    const next = Math.ceil(remainMs / 1000);
    if (next !== secondsRemaining.value) secondsRemaining.value = next;
  }, 100);
}

function skipAuto(): void {
  const e = end.value;
  if (!e || e.mode !== "auto") return;
  const behavior = e.skipButton?.behavior ?? "now";
  clearAutoTimers();
  if (behavior === "now") {
    runAction(e.action);
  } else {
    // "cancel" → flow ends here; consumer must navigate themselves.
    autoCancelled.value = true;
  }
}

function cancelAuto(): void {
  clearAutoTimers();
  autoCancelled.value = true;
}

// ── Mount/unmount: drive immediate + auto modes ────────────
function applyMode(): void {
  const e = end.value;
  if (!e) return;
  if (e.mode === "immediate") {
    runAction(e.action);
    return;
  }
  if (e.mode === "auto") {
    startAutoTimer();
  }
}

onMounted(() => applyMode());

// Re-run if payload swaps after mount (rare, but defensive).
watch(
  () => props.payload,
  (next, prev) => {
    if (next === prev) return;
    clearAutoTimers();
    applyMode();
  },
);

onUnmounted(() => clearAutoTimers());

// ── Manual mode wiring ────────────────────────────────────
const manualPrimary = computed<WfButton | null>(() =>
  end.value?.mode === "manual" ? (end.value.primary ?? null) : null,
);
const manualOptions = computed<WfButton[]>(() =>
  end.value?.mode === "manual" ? (end.value.options ?? []) : [],
);

function onKeydown(ev: KeyboardEvent): void {
  if (ev.key !== "Enter") return;
  // Enter-key target: primary if set, else first option (round-2 delta).
  const target = manualPrimary.value ?? manualOptions.value[0] ?? null;
  if (!target) return;
  ev.preventDefault();
  runAction(target.action);
}

// Render-helpers exposed to slots so consumers can build any UI.
function triggerButton(btn: WfButton): void {
  runAction(btn.action);
}

const skipScope = computed(() => {
  const e = end.value;
  if (e?.mode !== "auto" || !e.skipButton) return null;
  const behavior = e.skipButton.behavior ?? "now";
  return { label: e.skipButton.label, behavior } as const;
});
</script>

<template>
  <span v-if="end?.mode === 'immediate'" class="sr-only" aria-live="polite">Redirecting…</span>

  <div v-else class="as-wf-finish" @keydown="onKeydown">
    <slot v-if="message" name="message" :message="message">
      <div class="as-wf-finish-message" :data-level="message.level" role="status">
        {{ message.text }}
      </div>
    </slot>

    <template v-if="end?.mode === 'auto' && !autoCancelled">
      <slot
        name="countdown"
        :seconds-remaining="secondsRemaining"
        :total-seconds="totalSeconds"
        :skip="skipAuto"
        :cancel="cancelAuto"
      >
        <div class="as-wf-finish-countdown" aria-live="polite">
          Continuing in {{ secondsRemaining }}…
        </div>
      </slot>
      <div v-if="skipScope" class="as-wf-finish-actions">
        <slot name="skip" :button="skipScope" :trigger="skipAuto">
          <button type="button" class="as-wf-finish-skip" @click="skipAuto">
            {{ skipScope.label }}
          </button>
        </slot>
      </div>
    </template>

    <template v-if="end?.mode === 'manual'">
      <div class="as-wf-finish-actions">
        <slot
          v-if="manualPrimary"
          name="primary"
          :button="manualPrimary"
          :trigger="() => triggerButton(manualPrimary!)"
        >
          <button
            type="button"
            class="as-wf-finish-primary"
            autofocus
            @click="triggerButton(manualPrimary!)"
          >
            {{ manualPrimary.label }}
          </button>
        </slot>
        <template v-for="(btn, index) in manualOptions" :key="index">
          <slot name="option" :button="btn" :index="index" :trigger="() => triggerButton(btn)">
            <button
              type="button"
              class="as-wf-finish-option"
              :autofocus="!manualPrimary && index === 0"
              @click="triggerButton(btn)"
            >
              {{ btn.label }}
            </button>
          </slot>
        </template>
      </div>
    </template>
  </div>
</template>
