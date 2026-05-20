<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type { WfActionRequest, WfButton, WfFinished } from "@atscript/moost-wf";

const props = defineProps<{
  payload: WfFinished | null;
  /**
   * Consumer-provided navigation handler. Receives the redirect target URL —
   * the consumer decides cross-origin vs in-app routing. Mirrors the
   * `navigate` option on `@atscript/db-client`'s `Client`: one handler
   * across the stack.
   */
  navigate?: (url: string) => void | Promise<void>;
}>();

const emit = defineEmits<{
  (e: "dismiss"): void;
  /** Fired whenever an action runs — analytics hook. */
  (e: "action", action: WfActionRequest): void;
}>();

// ── Action execution ───────────────────────────────────────
async function dispatchRedirect(url: string): Promise<void> {
  if (props.navigate) {
    await props.navigate(url);
    return;
  }
  const loc = (globalThis as { location?: { assign?: (url: string) => void } }).location;
  if (loc?.assign) {
    loc.assign(url);
    return;
  }
  // Mirrors db-client's SSR-throw posture but soft-fails in the Vue render
  // path — crashing the finish screen is worse than a logged misconfiguration.
  console.error(
    `[AsWfFinish] Cannot redirect to "${url}": no \`navigate\` prop and no browser environment. ` +
      `Pass a \`navigate\` prop to AsWfForm / AsWfFinish.`,
  );
}

function runAction(action: WfActionRequest): void {
  // Analytics first so consumers can log even when the action also fires
  // navigation that unloads the page.
  emit("action", action);
  if (action.type === "redirect") {
    void dispatchRedirect(action.target);
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
const next = computed(() => props.payload?.next ?? null);
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
  const n = next.value;
  if (!n || n.trigger !== "auto") return;
  clearAutoTimers();
  autoCancelled.value = false;
  autoStartedAt = Date.now();
  totalSeconds.value = Math.ceil(n.timeoutMs / 1000);
  secondsRemaining.value = totalSeconds.value;
  autoTimer = setTimeout(() => {
    clearAutoTimers();
    runAction(n.action);
  }, n.timeoutMs);
  // 250ms tick — fast enough that the integer countdown updates feel
  // responsive near second boundaries, slow enough to avoid wasting frames
  // now that the visible progress is driven by CSS keyframes.
  countdownInterval = setInterval(() => {
    const elapsed = Date.now() - autoStartedAt;
    const remainMs = Math.max(0, n.timeoutMs - elapsed);
    const nextSec = Math.ceil(remainMs / 1000);
    if (nextSec !== secondsRemaining.value) secondsRemaining.value = nextSec;
  }, 250);
}

function skipAuto(): void {
  const n = next.value;
  if (!n || n.trigger !== "auto") return;
  const behavior = n.skipButton?.behavior ?? "now";
  clearAutoTimers();
  if (behavior === "now") {
    runAction(n.action);
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
  const n = next.value;
  if (!n) return;
  if (n.trigger === "immediate") {
    runAction(n.action);
    return;
  }
  if (n.trigger === "auto") {
    startAutoTimer();
  }
}

onMounted(() => applyMode());

// Re-run if payload swaps after mount (rare, but defensive).
watch(
  () => props.payload,
  (newPayload, prev) => {
    if (newPayload === prev) return;
    clearAutoTimers();
    applyMode();
  },
);

onUnmounted(() => clearAutoTimers());

// ── Manual mode wiring ────────────────────────────────────
const manualPrimary = computed<WfButton | null>(() =>
  next.value?.trigger === "manual" ? (next.value.primary ?? null) : null,
);
const manualOptions = computed<WfButton[]>(() =>
  next.value?.trigger === "manual" ? (next.value.options ?? []) : [],
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
  const n = next.value;
  if (n?.trigger !== "auto" || !n.skipButton) return null;
  const behavior = n.skipButton.behavior ?? "now";
  return { label: n.skipButton.label, behavior } as const;
});
</script>

<template>
  <span v-if="next?.trigger === 'immediate'" class="sr-only" aria-live="polite">Redirecting…</span>

  <div v-else class="as-wf-finish" @keydown="onKeydown">
    <slot v-if="message" name="message" :message="message">
      <div class="as-wf-finish-message" :data-level="message.level" role="status">
        {{ message.text }}
      </div>
    </slot>

    <template v-if="next?.trigger === 'auto' && !autoCancelled">
      <div v-if="skipScope" class="as-wf-finish-actions">
        <slot name="skip" :button="skipScope" :trigger="skipAuto">
          <button
            type="button"
            class="as-wf-finish-skip"
            :style="{ '--progress-duration': `${next.timeoutMs}ms` }"
            @click="skipAuto"
          >
            <span class="as-wf-finish-skip-fill" />
            <span class="as-wf-finish-skip-label">{{ skipScope.label }}</span>
          </button>
        </slot>
      </div>
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
    </template>

    <template v-if="next?.trigger === 'manual'">
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
