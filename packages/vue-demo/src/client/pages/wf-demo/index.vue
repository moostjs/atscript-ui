<script setup lang="ts">
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
      "AsWfFinish triggers the redirect on mount — no countdown, no choice. Soft redirect emits @navigate.",
    badge: "mode: immediate",
  },
  {
    to: "/wf-demo/finish-auto",
    title: "Auto redirect (countdown + skip)",
    description:
      "Countdown ticks down to the action; the optional skip button fires the action immediately.",
    badge: "mode: auto",
  },
  {
    to: "/wf-demo/finish-manual",
    title: "Manual choice (primary + options)",
    description:
      "User picks the outcome. Primary is the Enter-key target; options render alongside.",
    badge: "mode: manual",
  },
  {
    to: "/wf-demo/finish-data",
    title: "Terminal data payload",
    description:
      "finishWfWithData() emits typed result data + a success banner. Page overrides #wf.finished to render the payload.",
    badge: "helper: data",
  },
  {
    to: "/wf-demo/finish-message",
    title: "Message-only finish",
    description:
      "finishWfWithMessage() — banner only, no data, no end action. The minimal terminal envelope.",
    badge: "helper: message",
  },
  {
    to: "/wf-demo/finish-aborted",
    title: "Abortable form (cancel action)",
    description:
      "Two finish paths: submit succeeds with data; the Cancel action button calls finishWfAborted().",
    badge: "helper: aborted",
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
  <div class="min-h-screen p-$l">
    <div class="max-w-[760px] mx-auto flex flex-col gap-$m">
      <h1 class="text-lg font-700 m-0">WfFinished envelope · demo</h1>
      <p class="text-callout text-current/70 m-0">
        Each variation drives a workflow round-trip and exercises one branch of the unified
        <code>WfFinished</code> envelope or a workflow-loop pattern.
      </p>
      <ul class="flex flex-col gap-$s list-none p-0 m-0">
        <li v-for="v in variations" :key="v.to">
          <RouterLink
            :to="v.to"
            class="block p-$m layer-0 border-1 rounded-r2 hover:scope-primary"
          >
            <span
              class="font-mono text-caption uppercase tracking-[0.14em] scope-primary text-current-hl"
              >{{ v.badge }}</span
            >
            <h2 class="text-body-l font-700 m-0 mt-$xs">{{ v.title }}</h2>
            <p class="text-body text-current/70 m-0 mt-$xxs">{{ v.description }}</p>
          </RouterLink>
        </li>
      </ul>
    </div>
  </div>
</template>
