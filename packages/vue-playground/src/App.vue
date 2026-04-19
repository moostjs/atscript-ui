<script setup lang="ts">
import { onMounted, provide, ref } from "vue";
import { RouterLink, RouterView } from "vue-router";
import vueFormPkg from "@atscript/vue-form/package.json";

const version = `v${vueFormPkg.version}`;

const getStartedRoutes = [{ path: "/", label: "Home", icon: "sun" }];

const formRoutes = [
  { path: "/basic", label: "Basic Fields" },
  { path: "/nested", label: "Nested Objects" },
  { path: "/array", label: "Arrays" },
  { path: "/validation", label: "Validation" },
  { path: "/select-radio", label: "Select / Radio" },
];

const wfRoutes = [
  { path: "/dynamic", label: "Dynamic (ui.fn.*)" },
  { path: "/custom", label: "Custom Components" },
  { path: "/ref", label: "FK Ref (Value Help)" },
  { path: "/wf-auth", label: "Auth Flow" },
  { path: "/wf-profile", label: "Profile Draft" },
];

const tableRoutes = [
  { path: "/products-table", label: "Products" },
  { path: "/customers-table", label: "Customers" },
  { path: "/custom-slots-table", label: "Custom Slots" },
  { path: "/virtual-scroll-table", label: "Virtual Scroll (5k)", count: "5k" },
  { path: "/orders-table", label: "Orders (FK)" },
];

const toastMessage = ref("");
const toastVisible = ref(false);
let toastTimer: ReturnType<typeof setTimeout>;

function showToast(message: string) {
  toastMessage.value = message;
  toastVisible.value = true;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastVisible.value = false;
  }, 2500);
}

provide("showToast", showToast);

const dark = ref(false);

function applyDark(on: boolean) {
  const html = document.documentElement;
  html.classList.toggle("dark", on);
  html.setAttribute("data-theme", on ? "dark" : "light");
  try {
    localStorage.setItem("as-theme", on ? "dark" : "light");
  } catch {}
}

function toggleDark() {
  dark.value = !dark.value;
  applyDark(dark.value);
}

onMounted(() => {
  let initial = false;
  try {
    const saved = localStorage.getItem("as-theme");
    if (saved) initial = saved === "dark";
    else initial = window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {}
  dark.value = initial;
  applyDark(initial);
});
</script>

<template>
  <div class="h-100vh overflow-hidden flex layer-1">
    <aside
      class="w-[15em] shrink-0 sticky top-0 h-100vh overflow-y-auto flex flex-col layer-0 border-r-1"
    >
      <div class="flex items-center gap-$s px-$m pt-$m pb-$m border-b-1">
        <span
          class="w-fingertip-xs h-fingertip-xs rounded-r0 bg-primary-600 text-white grid place-items-center font-700 text-callout tracking-tight font-mono"
          >AS</span
        >
        <span class="font-600 tracking-tight text-grey-800 dark:text-grey-100">UI Playground</span>
        <span
          class="scope-grey ml-auto font-mono text-callout text-current/60 px-$xs py-[0.15em] rounded-r0 layer-2"
          >{{ version }}</span
        >
      </div>
      <nav class="flex flex-col px-$xs pb-$m pt-0 flex-1">
        <span class="nav-section">Getting Started</span>
        <RouterLink
          v-for="r in getStartedRoutes"
          :key="r.path"
          :to="r.path"
          class="nav-link"
          active-class="nav-link-active"
        >
          <span class="i-as-sun w-[1.1em] h-[1.1em] shrink-0 op-65" aria-hidden="true" />
          <span class="flex-1 min-w-0 truncate">{{ r.label }}</span>
        </RouterLink>

        <span class="nav-section">Forms</span>
        <RouterLink
          v-for="r in formRoutes"
          :key="r.path"
          :to="r.path"
          class="nav-link"
          active-class="nav-link-active"
        >
          <span class="i-as-check-square w-[1.1em] h-[1.1em] shrink-0 op-65" aria-hidden="true" />
          <span class="flex-1 min-w-0 truncate">{{ r.label }}</span>
        </RouterLink>

        <span class="nav-section">Workflows</span>
        <RouterLink
          v-for="r in wfRoutes"
          :key="r.path"
          :to="r.path"
          class="nav-link"
          active-class="nav-link-active"
        >
          <span class="i-as-refresh w-[1.1em] h-[1.1em] shrink-0 op-65" aria-hidden="true" />
          <span class="flex-1 min-w-0 truncate">{{ r.label }}</span>
        </RouterLink>

        <span class="nav-section">Tables</span>
        <RouterLink
          v-for="r in tableRoutes"
          :key="r.path"
          :to="r.path"
          class="nav-link"
          active-class="nav-link-active"
        >
          <span class="i-as-columns w-[1.1em] h-[1.1em] shrink-0 op-65" aria-hidden="true" />
          <span class="flex-1 min-w-0 truncate">{{ r.label }}</span>
          <span
            v-if="r.count"
            class="scope-grey font-mono text-callout text-current/60 px-$xs py-[0.08em] rounded-r0 layer-2"
            >{{ r.count }}</span
          >
        </RouterLink>
      </nav>
      <div class="p-$s border-t-1">
        <button
          type="button"
          class="c8-flat scope-grey inline-flex items-center gap-$xs w-full px-$s py-$xs border-1 rounded-base cursor-pointer text-callout font-inherit"
          :aria-label="dark ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggleDark"
        >
          <span :class="dark ? 'i-as-sun' : 'i-as-moon'" aria-hidden="true" />
          <span>{{ dark ? "Light mode" : "Dark mode" }}</span>
        </button>
      </div>
    </aside>
    <main class="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
      <RouterView />
    </main>
    <Transition name="toast">
      <div
        v-if="toastVisible"
        class="fixed bottom-$l right-$l px-$l py-$m bg-primary-600 text-white rounded-r2 text-callout font-500 shadow-popup z-100"
      >
        {{ toastMessage }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
