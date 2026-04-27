<script setup lang="ts">
import { RouterLink } from "vue-router";

interface Demo {
  path: string;
  label: string;
  kind: string;
  desc: string;
}

interface Section {
  title: string;
  icon: string;
  lede?: string;
  items: Demo[];
}

const sections: Section[] = [
  {
    title: "Forms",
    icon: "check-square",
    lede: "Auto-generated forms driven by atscript types.",
    items: [
      {
        path: "/basic",
        label: "Basic Fields",
        kind: "BasicFields",
        desc: "Required, optional, disabled, read-only",
      },
      {
        path: "/nested",
        label: "Nested Objects",
        kind: "NestedObjects",
        desc: "Nested structs with indented rails",
      },
      {
        path: "/array",
        label: "Arrays",
        kind: "Arrays",
        desc: "Arrays of scalars and of structs",
      },
      {
        path: "/validation",
        label: "Validation",
        kind: "Validation",
        desc: "Required, format, range and collection rules",
      },
      {
        path: "/select-radio",
        label: "Select / Radio",
        kind: "SelectRadio",
        desc: "Enum-typed fields as dropdown or radio",
      },
    ],
  },
  {
    title: "Workflows",
    icon: "refresh",
    lede: "Dynamic field state, custom components, FK refs and multi-step flows.",
    items: [
      {
        path: "/dynamic",
        label: "Dynamic (ui.fn.*)",
        kind: "Dynamic",
        desc: "Computed labels, hidden, disabled, options",
      },
      {
        path: "/custom",
        label: "Custom Components",
        kind: "CustomComponents",
        desc: "Bring-your-own-UI for every field type",
      },
      {
        path: "/ref",
        label: "FK Ref (Value Help)",
        kind: "FkRef",
        desc: "Foreign-key fields with value-help combobox",
      },
      {
        path: "/wf-auth",
        label: "Auth Flow",
        kind: "AuthFlow",
        desc: "Multi-step login → MFA → done",
      },
      {
        path: "/wf-profile",
        label: "Profile Draft",
        kind: "ProfileDraft",
        desc: "Save-draft support with deep-partial validation",
      },
    ],
  },
  {
    title: "Tables",
    icon: "columns",
    lede: "Smart tables with sorting, filtering, column menus, FK value-help and virtual scroll.",
    items: [
      {
        path: "/products-table",
        label: "Products",
        kind: "Products",
        desc: "Catalogue with sorting, filtering and column management",
      },
      {
        path: "/customers-table",
        label: "Customers",
        kind: "Customers",
        desc: "Custom cell slots, multi-select, load-more pagination",
      },
      {
        path: "/single-select-table",
        label: "Single-Select",
        kind: "SingleSelect",
        desc: "select=\"single\" with side-panel showing the picked row",
      },
      {
        path: "/custom-slots-table",
        label: "Custom Slots",
        kind: "CustomSlots",
        desc: "Every table slot customised — cells, header, empty, footer",
      },
      {
        path: "/virtual-scroll-table",
        label: "Virtual Scroll (5k)",
        kind: "VirtualScroll",
        desc: "5,000 rows full-page, only visible rows rendered",
      },
      {
        path: "/window-table",
        label: "Window Table",
        kind: "WindowTable",
        desc: "Pool-based rendering, synthesized scrollbar, random-access on million-row sets",
      },
      {
        path: "/orders-table",
        label: "Orders (FK)",
        kind: "OrdersFk",
        desc: "FK columns with value-help mini-table inside filters",
      },
    ],
  },
];
</script>

<template>
  <div class="flex-1 min-h-0 overflow-y-auto">
    <div class="max-w-[1100px] px-$xl py-$l">
      <div class="font-mono text-callout font-600 tracking-[0.14em] uppercase text-grey-500 mb-$s">
        atscript-ui · Playground
      </div>
      <h1
        class="text-h1 tracking-[-0.03em] m-0 mb-$s leading-[1.15] text-grey-900 dark:text-grey-50"
      >
        Auto-generated forms and smart tables from atscript types.
      </h1>
      <p class="text-body-l text-grey-500 max-w-[72ch] leading-[1.55] m-0 mb-$xl">
        Forms are built directly from your atscript interface. Optional fields stay
        <code
          class="font-mono text-callout px-$xs py-[0.08em] rounded-r0 layer-2 text-grey-700 dark:text-grey-200"
          >undefined</code
        >
        until the user fills them in — and can be cleared back to undefined. Nested structs and
        arrays are rendered with rails so the shape of your data stays visible. Tables come with
        column menus, filter pills, value-help for FK columns and virtual scroll.
      </p>

      <section v-for="sec in sections" :key="sec.title" class="mb-$xl">
        <header class="flex items-baseline gap-$s mb-$m">
          <span
            :class="`i-as-${sec.icon}`"
            class="w-[1.1em] h-[1.1em] op-70 text-primary-600"
            aria-hidden="true"
          />
          <h2 class="m-0 text-h3 font-600 tracking-[-0.01em] text-grey-900 dark:text-grey-50">
            {{ sec.title }}
          </h2>
          <span v-if="sec.lede" class="text-callout text-grey-500"> — {{ sec.lede }} </span>
        </header>

        <div class="grid grid-cols-2 gap-$m md:grid-cols-2 max-md:grid-cols-1">
          <RouterLink
            v-for="d in sec.items"
            :key="d.path"
            :to="d.path"
            class="home-card card border surface-0 flex flex-col gap-$xs px-$m py-$m rounded-r2 no-underline transition-all"
          >
            <div class="flex items-center gap-$s font-600 text-grey-900 dark:text-grey-100">
              <span>{{ d.label }}</span>
              <span class="scope-grey ml-auto font-mono text-callout font-500 text-current/60">{{
                d.kind
              }}</span>
            </div>
            <div class="text-callout text-grey-500 leading-[1.5]">
              {{ d.desc }}
            </div>
          </RouterLink>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.home-card:hover {
  border-color: rgb(37 99 235);
  box-shadow: 0 0 0 3px rgb(37 99 235 / 0.18);
}
</style>
