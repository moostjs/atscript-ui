<script setup lang="ts">
import DarkToggle from "../forms-demo/_dark-toggle.vue";

type Variation = {
  to: string;
  title: string;
  description: string;
  badge: string;
};

const variations: Variation[] = [
  {
    to: "/wf-demo/finish-immediate",
    title: "Immediate redirect",
    description:
      "AsWfFinish triggers the redirect on mount — no countdown, no choice. Wires the `navigate` prop to the router.",
    badge: "trigger: immediate",
  },
  {
    to: "/wf-demo/finish-auto",
    title: "Auto redirect (countdown + skip)",
    description:
      "Countdown ticks down to the action; the optional skip button fires the action immediately.",
    badge: "trigger: auto",
  },
  {
    to: "/wf-demo/finish-manual",
    title: "Manual choice (primary + options)",
    description:
      "User picks the outcome. Primary is the Enter-key target; options render alongside.",
    badge: "trigger: manual",
  },
  {
    to: "/wf-demo/finish-data",
    title: "Terminal data payload",
    description:
      "finishWf({ data, message }) emits typed result data + a success banner. Page overrides #wf.finished to render the payload.",
    badge: "shape: data",
  },
  {
    to: "/wf-demo/finish-message",
    title: "Message-only finish",
    description:
      "finishWf({ message }) — banner only, no data, no next action. The minimal terminal envelope.",
    badge: "shape: message",
  },
  {
    to: "/wf-demo/finish-aborted",
    title: "Abortable form (cancel action)",
    description:
      "Two finish paths: submit succeeds with data; the Cancel action button calls abortWf().",
    badge: "shape: aborted",
  },
  {
    to: "/wf-demo/multi-step",
    title: "Multi-step (3 rounds)",
    description:
      "Three sequential inputRequired rounds — the form schema swaps automatically on each response.",
    badge: "pattern: multi-step",
  },
  {
    to: "/wf-demo/validation-errors",
    title: "Server-side validation errors",
    description:
      "Server re-issues the same form with inputRequired.context.errors. Same-schema re-validation preserves user-entered values.",
    badge: "pattern: validation",
  },
  {
    to: "/wf-demo/outlet-pause",
    title: "Outlet pause (check your email)",
    description:
      "Workflow emits outletEmail; client sees { sent: true } and treats the session as finished. Real resumption happens out-of-band.",
    badge: "pattern: outlet",
  },
];
</script>

<template>
  <div class="min-h-screen layer-1">
    <div class="max-w-3xl mx-auto p-$l flex flex-col gap-$l">
      <header class="flex flex-col gap-$xs">
        <div class="flex items-center justify-between gap-$s">
          <p
            class="font-mono text-callout font-600 tracking-[0.14em] uppercase text-current/60 m-0"
          >
            atscript-ui · workflows demo
          </p>
          <DarkToggle />
        </div>
        <h1 class="text-h1 m-0">Workflow variations</h1>
        <p class="text-body text-current-muted m-0">
          Each variation drives a workflow round-trip and exercises one branch of the unified
          <code>WfFinished</code> envelope or a workflow-loop pattern.
        </p>
        <RouterLink to="/login" class="text-callout text-current/60 underline mt-$xs self-start">
          ← back to sign-in
        </RouterLink>
      </header>

      <ul class="flex flex-col gap-$s p-0 list-none m-0">
        <li v-for="v in variations" :key="v.to">
          <RouterLink
            :to="v.to"
            class="layer-0 border-1 rounded-r2 p-$m flex items-start gap-$m cursor-pointer hover:bg-current/5"
          >
            <div class="flex-1 flex flex-col gap-$xxs">
              <h3 class="text-body-l font-600 m-0">{{ v.title }}</h3>
              <p class="text-callout text-current-muted m-0">{{ v.description }}</p>
            </div>
            <span
              class="scope-primary font-mono text-[10px] uppercase tracking-wider px-$xs py-[2px] rounded-base text-current-hl bg-current/10"
            >
              {{ v.badge }}
            </span>
          </RouterLink>
        </li>
      </ul>
    </div>
  </div>
</template>
