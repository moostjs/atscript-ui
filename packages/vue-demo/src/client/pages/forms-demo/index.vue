<script setup lang="ts">
import DarkToggle from "./_dark-toggle.vue";
type Variation = {
  to: string;
  title: string;
  description: string;
  status: "ready" | "draft" | "todo";
};

const variations: Variation[] = [
  {
    to: "/forms-demo/nested-collapsible",
    title: "Nested · collapsible sections",
    description:
      "Deeply nested object schema rendered as collapsible sections (custom @ui.type=object override).",
    status: "ready",
  },
  {
    to: "/forms-demo/optional-fields",
    title: "Optional fields · all types",
    description:
      "Every supported field type, all marked optional — toggle each on/off to verify the enable/clear flow.",
    status: "ready",
  },
  {
    to: "/forms-demo/nested-optionals",
    title: "Nested optional structs",
    description:
      "Five cascading optional structs — verify the dashed-island placeholder layout and section/island alternation as you drill in.",
    status: "ready",
  },
  {
    to: "/forms-demo/grid-layout",
    title: "Grid layout",
    description: "12-col grid with col/row span, aliases, and container-query mobile fallback.",
    status: "ready",
  },
  {
    to: "/forms-demo/array-showcase",
    title: "Array showcase",
    description:
      "Optional and required arrays of primitives and objects, plus a nested array.",
    status: "ready",
  },
  {
    to: "/forms-demo/tuples",
    title: "Tuples",
    description: "Fixed-length, mixed-type tuples (e.g. [number, string, boolean]).",
    status: "ready",
  },
  {
    to: "/forms-demo/unions",
    title: "Unions / variants",
    description: "Discriminated unions with inline variant picker.",
    status: "ready",
  },
  {
    to: "/forms-demo/error-dismissal",
    title: "Error dismissal & loading",
    description:
      "External leaf auto-dismiss on edit, dismissable __form banner, and loading overlay. Buttons inject errors so the round-trip behaviours can be exercised without a server.",
    status: "ready",
  },
  {
    to: "/forms-demo/measurements",
    title: "Measurements & dates",
    description:
      "Amount (static + cross-row currency), measure with unit, date / datetime / time inputs.",
    status: "ready",
  },
  {
    to: "/forms-demo/measurements-optional",
    title: "Optional numeric inputs",
    description:
      "Same 10-case adornment matrix as Measurements, but every numeric field is optional — click the empty-state placeholder on each to verify the init flow (the decimal cases regressed without the createFormData primitive-init fallback).",
    status: "ready",
  },
  {
    to: "/forms-demo/dynamic",
    title: "Dynamic (fn-driven)",
    description: "Visibility / labels / options driven by @ui.form.fn.* expressions.",
    status: "todo",
  },
];
</script>

<template>
  <div class="min-h-screen layer-1">
    <div class="max-w-3xl mx-auto p-$l flex flex-col gap-$l">
      <header class="flex flex-col gap-$xs">
        <div class="flex items-center justify-between gap-$s">
          <p class="font-mono text-callout font-600 tracking-[0.14em] uppercase text-current/60 m-0">
            atscript-ui · forms demo
          </p>
          <DarkToggle />
        </div>
        <h1 class="text-h1 m-0">Form variations</h1>
        <p class="text-body text-current-muted m-0">
          Stand-alone test pages for every aspect of form rendering — no authentication required.
        </p>
        <RouterLink to="/login" class="text-callout text-current/60 underline mt-$xs self-start">
          ← back to sign-in
        </RouterLink>
      </header>

      <ul class="flex flex-col gap-$s p-0 list-none m-0">
        <li v-for="v in variations" :key="v.to">
          <component
            :is="v.status === 'ready' ? 'RouterLink' : 'div'"
            :to="v.status === 'ready' ? v.to : undefined"
            class="layer-0 border-1 rounded-r2 p-$m flex items-start gap-$m"
            :class="{
              'cursor-pointer hover:bg-current/5': v.status === 'ready',
              'opacity-60': v.status !== 'ready',
            }"
          >
            <div class="flex-1 flex flex-col gap-$xxs">
              <h3 class="text-body-l font-600 m-0">{{ v.title }}</h3>
              <p class="text-callout text-current-muted m-0">{{ v.description }}</p>
            </div>
            <span
              class="font-mono text-[10px] uppercase tracking-wider px-$xs py-[2px] rounded-base"
              :class="{
                'scope-good text-current-hl bg-current/10': v.status === 'ready',
                'text-current/50 bg-current/5': v.status !== 'ready',
              }"
            >
              {{ v.status }}
            </span>
          </component>
        </li>
      </ul>
    </div>
  </div>
</template>
