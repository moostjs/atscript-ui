<script setup lang="ts">
type Variation = {
  to: string;
  title: string;
  description: string;
  mode: "immediate" | "auto" | "manual";
};

const variations: Variation[] = [
  {
    to: "/wf-demo/finish-immediate",
    title: "Immediate redirect",
    description:
      "AsWfFinish triggers the redirect on mount — no countdown, no choice. Soft redirect emits @navigate.",
    mode: "immediate",
  },
  {
    to: "/wf-demo/finish-auto",
    title: "Auto redirect (countdown + skip)",
    description:
      "Countdown ticks down to the action; the optional skip button fires the action immediately.",
    mode: "auto",
  },
  {
    to: "/wf-demo/finish-manual",
    title: "Manual choice (primary + options)",
    description:
      "User picks the outcome. Primary is the Enter-key target; options render alongside.",
    mode: "manual",
  },
];
</script>

<template>
  <div class="min-h-screen p-$l">
    <div class="max-w-[760px] mx-auto flex flex-col gap-$m">
      <h1 class="text-lg font-700 m-0">WfFinished envelope · demo</h1>
      <p class="text-callout text-current/70 m-0">
        Each variation drives one HTTP round-trip and exercises one
        <code>end.mode</code> of the unified <code>WfFinished</code> envelope.
      </p>
      <ul class="flex flex-col gap-$s list-none p-0 m-0">
        <li v-for="v in variations" :key="v.to">
          <RouterLink
            :to="v.to"
            class="block p-$m layer-0 border-1 rounded-r2 hover:scope-primary"
          >
            <span
              class="font-mono text-caption uppercase tracking-[0.14em] scope-primary text-current-hl"
              >mode: {{ v.mode }}</span
            >
            <h2 class="text-body-l font-700 m-0 mt-$xs">{{ v.title }}</h2>
            <p class="text-body text-current/70 m-0 mt-$xxs">{{ v.description }}</p>
          </RouterLink>
        </li>
      </ul>
    </div>
  </div>
</template>
